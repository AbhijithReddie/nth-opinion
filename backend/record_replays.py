"""
Record the demo replays the frontend plays when the AI is unavailable.

For each live room this runs the room's example (the "Try this example" input in
frontend/src/config/rooms.ts) against the real agents, captures every SSE event
with its time offset from the start (including the "Behind the scenes" trace
events, so replays can drive that panel too), plus the room's final summary, and
saves it to frontend/public/replays/<room-id>.json. The Debate Arena is recorded
with 1 round.

    python record_replays.py                  # every room that has no recording yet
    python record_replays.py --room debate    # just one room
    python record_replays.py --force          # re-record rooms that already have one
    python record_replays.py --gap 8          # seconds between LLM calls (default 5)

Rooms that take documents get made-up sample documents from backend/samples/
(never real personal data): the Interview Panel a resume and a job description,
the Pitch Tank a pitch deck. The recording keeps their digests.

The examples are read with Node through the frontend's own TypeScript loader
(jiti), so run `npm install` in frontend/ first. Needs backend/.env like the API.
"""

import argparse
import asyncio
import json
import logging
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import documents as docs
import graph as debate_graph
import llm
import rooms.engine as room_engine
import rooms.safety as room_safety
from main import _debate_events
from rooms import get_room, stream_turn, summarize

FRONTEND = Path(__file__).resolve().parent.parent / "frontend"
REPLAY_DIR = FRONTEND / "public" / "replays"
SAMPLES = Path(__file__).resolve().parent / "samples"
# Made-up documents for rooms that take them: (doc type, file in backend/samples/).
SAMPLE_DOCS = {
    "interview-panel": [("resume", "sample_resume.txt"), ("job_description", "sample_job_description.txt")],
    "shark-tank": [("pitch_deck", "sample_pitch_deck.txt")],
}
DEBATE_ROUNDS = 1
LANGUAGE = "english"

# Prints each live room's example and default cast (persona ids + display names) as JSON.
EXPORT_EXAMPLES_JS = r"""
const { createJiti } = require("jiti");
const load = createJiti(process.cwd() + "/");
const { ROOMS } = load("./src/config/rooms.ts");
const { ROOM_CHATS } = load("./src/config/roomChats.ts");
const out = {};
for (const room of ROOMS.filter((r) => r.status === "live")) {
  const chat = Object.values(ROOM_CHATS).find((c) => c.roomId === room.id);
  out[room.id] = {
    fill: room.example.fill,
    chat: chat
      ? {
          contextKey: chat.title.contextKey ?? null,
          cast: chat.cast.defaults.map((id) => ({ id, name: chat.personas.find((p) => p.id === id).name })),
        }
      : null,
  };
}
process.stdout.write(JSON.stringify(out));
"""


def load_examples() -> dict:
    """Each live room's example input and default cast, straight from the frontend config."""
    try:
        result = subprocess.run(
            ["node", "-e", EXPORT_EXAMPLES_JS], cwd=FRONTEND, capture_output=True, text=True, encoding="utf-8", check=True
        )
    except (OSError, subprocess.CalledProcessError) as exc:
        detail = getattr(exc, "stderr", "") or exc
        sys.exit(f"Couldn't read the examples from frontend/src/config (is Node installed and `npm install` done?)\n{detail}")
    return json.loads(result.stdout)


# ---------------------------------------------------------------------------
# Timing: event offsets, minus the time spent waiting between LLM calls
# ---------------------------------------------------------------------------
class Clock:
    """Measures event offsets and spaces out LLM calls to stay under per-minute rate limits.

    The waits are subtracted from the offsets, so the recording keeps the real
    pace of the conversation.
    """

    def __init__(self, gap: float):
        self.gap = gap
        self.started = 0.0
        self.waited = 0.0
        self.last_call_end: float | None = None

    def restart(self) -> None:
        self.started = time.perf_counter()
        self.waited = 0.0

    def offset_ms(self) -> int:
        return round((time.perf_counter() - self.started - self.waited) * 1000)

    async def before_call(self) -> None:
        if self.last_call_end is not None:
            wait = self.gap - (time.perf_counter() - self.last_call_end)
            if wait > 0:
                await asyncio.sleep(wait)
                self.waited += wait

    def throttle(self, invoke):
        """Wrap llm.invoke so every call waits for the gap first."""

        async def throttled(*args, **kwargs):
            await self.before_call()
            try:
                return await invoke(*args, **kwargs)
            finally:
                self.last_call_end = time.perf_counter()

        return throttled


# ---------------------------------------------------------------------------
# Recording
# ---------------------------------------------------------------------------
class RecordingFailed(Exception):
    pass


async def record_debate(example: dict, clock: Clock) -> dict:
    topic = example["fill"]["message"]
    events = []
    clock.restart()
    async for sse in _debate_events(topic, DEBATE_ROUNDS, trace=True):
        data = json.loads(sse["data"])
        if sse["event"] == "error":
            raise RecordingFailed(data["message"])
        events.append({"t": clock.offset_ms(), "event": sse["event"], "data": data})
    return {"setup": {"topic": topic, "rounds": DEBATE_ROUNDS}, "events": events}


async def record_room(room_id: str, example: dict, clock: Clock) -> dict:
    room = get_room(room_id)
    if room is None or not example.get("chat"):
        raise RecordingFailed(f"{room_id} isn't a backend room")
    fill, chat = example["fill"], example["chat"]

    # The setup exactly as the frontend stores it (RoomSetup), so the replay renders like a real session.
    setup = {
        "title": fill.get("title", ""),
        "participants": chat["cast"],
        "language": LANGUAGE,
        "context": fill.get("context", {}),
    }
    # What the frontend sends: the title also goes to the backend as a context field in most rooms.
    context = dict(setup["context"])
    if chat["contextKey"]:
        context[chat["contextKey"]] = setup["title"]
    documents = [
        {"doc_type": t, "filename": f, "digest": await docs.build_digest(t, docs.truncate((SAMPLES / f).read_text(encoding="utf-8")))}
        for t, f in SAMPLE_DOCS.get(room_id, [])
    ]
    problem = (
        room.validate_participants(setup["participants"])
        or room.validate_documents(documents)
        or room.validate_context(context, [d["doc_type"] for d in documents])
    )
    if problem:
        raise RecordingFailed(problem)

    message = {"id": "u-demo-1", "text": fill["message"]}
    events = []
    clock.restart()
    async for event, data in stream_turn(
        room,
        message=message["text"],
        message_id=message["id"],
        history=[],
        participants=setup["participants"],
        language=LANGUAGE,
        context=context,
        trace=True,
        documents=documents,
    ):
        events.append({"t": clock.offset_ms(), "event": event, "data": data})

    # The summary sees the same history the frontend would send: your message plus every reply.
    history = [{"id": message["id"], "sender": "user", "text": message["text"]}] + [
        {"id": e["data"]["id"], "sender": e["data"]["friend_id"], "text": e["data"]["text"], "reply_to": e["data"].get("reply_to")}
        for e in events
        if e["event"] == "message"
    ]
    result = None
    if room.summary:
        result = await summarize(
            room, history=history, participants=setup["participants"], language=LANGUAGE, context=context, documents=documents
        )
    # The sample documents' digests are kept (they're made up); the frontend never sends them anywhere.
    return {"setup": setup, "message": message, "documents": documents, "events": events, "summary": result}


async def record(room_ids: list[str], examples: dict, gap: float) -> int:
    clock = Clock(gap)
    # Every LLM call (debate, safety check, director, personas, summary) goes through llm.invoke.
    throttled = clock.throttle(llm.invoke)
    debate_graph.invoke = room_engine.invoke = room_safety.invoke = docs.invoke = throttled

    failures = 0
    REPLAY_DIR.mkdir(parents=True, exist_ok=True)
    for room_id in room_ids:
        print(f"Recording {room_id} ...", flush=True)
        try:
            if room_id == "debate":
                body = await record_debate(examples[room_id], clock)
            else:
                body = await record_room(room_id, examples[room_id], clock)
        except (RecordingFailed, llm.ModelBusyError) as exc:
            print(f"  failed: {exc}", flush=True)
            failures += 1
            continue
        recording = {
            "version": 1,
            "room_id": room_id,
            "recorded_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            **body,
        }
        path = REPLAY_DIR / f"{room_id}.json"
        path.write_text(json.dumps(recording, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        seconds = body["events"][-1]["t"] / 1000 if body["events"] else 0
        print(f"  saved {path.relative_to(FRONTEND.parent)} ({len(body['events'])} events, {seconds:.0f}s)", flush=True)
    return failures


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    examples = load_examples()

    parser = argparse.ArgumentParser(description="Record demo replays of each room's example conversation.")
    parser.add_argument("--room", choices=sorted(examples), help="Record just this room")
    parser.add_argument("--force", action="store_true", help="Re-record rooms that already have a recording")
    parser.add_argument("--gap", type=float, default=5.0, help="Seconds to wait between LLM calls (default 5)")
    args = parser.parse_args()

    # main.py sets up INFO logging on import; only warnings matter here.
    logging.getLogger().setLevel(logging.WARNING)

    room_ids = [args.room] if args.room else list(examples)
    todo = [r for r in room_ids if args.force or not (REPLAY_DIR / f"{r}.json").exists()]
    for skipped in sorted(set(room_ids) - set(todo)):
        print(f"Skipping {skipped}: already recorded (use --force to re-record)")
    if not todo:
        return
    failures = asyncio.run(record(todo, examples, args.gap))
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
