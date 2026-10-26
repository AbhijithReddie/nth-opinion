"""SSE formatting: the event helper, and full room and debate streams (with a fake LLM)."""

import json

import main
import rooms.engine as engine
from tests.conftest import room_body


def parse_sse(text: str) -> list[tuple[str, dict]]:
    events = []
    for block in text.replace("\r\n", "\n").split("\n\n"):
        fields = dict(line.split(": ", 1) for line in block.split("\n") if ": " in line and not line.startswith(":"))
        if "event" in fields:
            events.append((fields["event"], json.loads(fields["data"])))
    return events


def test_sse_helper():
    assert main._sse("typing", {"friend_id": "rohit"}) == {"event": "typing", "data": '{"friend_id": "rohit"}'}
    # Non-ASCII stays valid JSON.
    assert json.loads(main._sse("message", {"text": "₹40 lakh 🔥"})["data"]) == {"text": "₹40 lakh 🔥"}


def test_room_stream_events(client, fake_llm):
    fake_llm.director_script = [
        engine.DirectorDecision(reason="first", action="speak", friend_id="rohit"),
        engine.DirectorDecision(reason="second", action="speak", friend_id="priya"),
        engine.DirectorDecision(reason="third", action="speak", friend_id="meera"),
        engine.DirectorDecision(reason="done", action="end"),
    ]
    r = client.post("/api/rooms/group-chat/message", json=room_body())
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/event-stream")
    events = parse_sse(r.text)
    names = [e for e, _ in events]
    assert names == ["typing", "message", "typing", "message", "typing", "message", "your_turn"]
    message = next(d for e, d in events if e == "message")
    assert set(message) == {"id", "friend_id", "text", "reply_to", "mentions", "emotion"}


def test_behind_the_scenes_adds_trace_events_only(client, fake_llm):
    plain = [e for e, _ in parse_sse(client.post("/api/rooms/group-chat/message", json=room_body()).text)]
    traced = [e for e, _ in parse_sse(client.post("/api/rooms/group-chat/message", json=room_body(behind_the_scenes=True)).text)]
    trace_events = {"node_start", "node_end", "director_decision", "safety_check"}
    assert [e for e in traced if e not in trace_events] == plain
    assert trace_events <= set(traced)


def test_debate_stream(client, fake_llm):
    r = client.post("/api/debate", json={"topic": "Pineapple belongs on pizza", "rounds": 1})
    names = [e for e, _ in parse_sse(r.text)]
    assert names[0] == "turn_start" and names[-2:] == ["judge", "done"]
    assert names.count("turn_end") == 2


def test_model_errors_have_codes(client, monkeypatch):
    async def busy(*args, **kwargs):
        raise main.ModelBusyError("The AI has used up its free quota for now.", "quota_exhausted")

    monkeypatch.setattr(engine, "invoke", busy)
    monkeypatch.setattr(engine, "classify_message", lambda *a, **k: _false())
    events = parse_sse(client.post("/api/rooms/group-chat/message", json=room_body()).text)
    assert events[-1] == ("error", {"message": "The AI has used up its free quota for now.", "code": "quota_exhausted"})


async def _false():
    return False
