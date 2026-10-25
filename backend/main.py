"""
Huddle - FastAPI backend (Debate Arena + rooms).

Endpoints:
    GET  /health                        -> {"status": "ok"}
    POST /api/debate                    -> Server-Sent Events stream of the debate
    GET  /api/rooms                     -> list of rooms
    POST /api/rooms/{room_id}/message   -> SSE stream of the room's replies
    POST /api/rooms/{room_id}/summary   -> the room's final structured output (JSON)

SSE events sent by /api/debate (each `data:` field is JSON):
    turn_start  {"speaker", "round"}
    token       {"speaker", "text"}            one chunk of the LLM output
    turn_end    {"speaker", "round", "text"}   final text (word limit applied)
    judge       {"scores", "winner", "memo"}
    done        {}
    error       {"message"}                    safe, user-facing message only

SSE events sent by /api/rooms/{room_id}/message:
    typing      {"friend_id"}
    message     {"id", "friend_id", "text", "reply_to", "mentions"}
    reaction    {"friend_id", "message_id", "emoji"}
    safety      {"helpline_text"}
    mode        {"mode"}                       only rooms with modes
    your_turn   {}
    error       {"message"}

Run with:  uvicorn main:app --port 8000
"""

import asyncio
import json
import logging
import os
import time
from collections import defaultdict, deque
from typing import Annotated, Literal

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import AliasChoices, BaseModel, Field, StringConstraints
from sse_starlette.sse import EventSourceResponse

from graph import graph, initial_state
from llm import ModelBusyError, content_text
from rooms import ROOMS, SummaryError, get_room, stream_turn, summarize

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("debate-arena")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
FRONTEND_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in os.getenv("FRONTEND_ORIGIN", "http://localhost:3000").split(",")
    if origin.strip()
]

RATE_WINDOW_SECONDS = 60 * 60  # all limits are per IP per hour

app = FastAPI(title="Huddle API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


# ---------------------------------------------------------------------------
# Request schema + friendly validation errors
# ---------------------------------------------------------------------------
class DebateRequest(BaseModel):
    topic: Annotated[str, StringConstraints(strip_whitespace=True, min_length=5, max_length=200)]
    rounds: int = Field(ge=1, le=3)


Id = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)]


class HistoryMessage(BaseModel):
    id: Id
    sender: Id  # "user" or a persona id
    text: Annotated[str, StringConstraints(max_length=2000)]
    reply_to: Id | None = None


class Participant(BaseModel):
    id: Id
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=20)]


class RoomContext(BaseModel):
    """What every room request carries: the recent chat, who's in the room, and the language.

    The API is stateless, so the client sends the history each time; only the
    last 40 messages are used. Participants are sent as "friends" by the Group
    Chat ("participants" is accepted too, for other rooms).
    """

    history: list[HistoryMessage] = Field(default_factory=list, max_length=500)
    participants: list[Participant] = Field(validation_alias=AliasChoices("friends", "participants"))
    language: Literal["english", "hinglish", "tenglish"] = "english"
    # Room-specific details from the setup screen, e.g. {"startup": "...", "ask": "..."} in Shark Tank.
    context: dict[Id, Annotated[str, StringConstraints(max_length=2000)]] = Field(default_factory=dict, max_length=10)


class RoomMessageRequest(RoomContext):
    message: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)]
    message_id: Id | None = None  # the client's id for this message, so replies can quote it
    mode: Id | None = None  # rooms with modes: the mode from the last `mode` event


def _room_validation_message(fields: set[str]) -> str:
    """A friendly sentence for an invalid room request, based on which fields failed."""
    if "message" in fields:
        return "Your message must be between 1 and 1000 characters."
    if "history" in fields:
        return "The chat history couldn't be read. Try clearing the chat."
    if "name" in fields:
        return "Names must be between 1 and 20 characters."
    if fields & {"friends", "participants", "id"}:
        return "Pick 3 or 4 friends for the group."
    if "language" in fields:
        return "Language must be english, hinglish or tenglish."
    if "context" in fields:
        return "Some of the room details couldn't be read. Try editing the room setup."
    return 'Invalid request. Send JSON like {"message": "...", "history": [], "friends": [...], "language": "english"}.'


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Return a short readable message instead of Pydantic's raw error list."""
    if request.url.path.startswith("/api/rooms"):
        fields = {str(part) for err in exc.errors() for part in err.get("loc", ())}
        return JSONResponse(status_code=422, content={"detail": _room_validation_message(fields)})
    fields = {str(err["loc"][-1]) for err in exc.errors() if err.get("loc")}
    if "topic" in fields:
        message = "Topic must be between 5 and 200 characters."
    elif "rounds" in fields:
        message = "Rounds must be a whole number from 1 to 3."
    else:
        message = 'Invalid request. Send JSON like {"topic": "...", "rounds": 2}.'
    return JSONResponse(status_code=422, content={"detail": message})


# ---------------------------------------------------------------------------
# Rate limiting (in-memory, per IP, sliding window)
# ---------------------------------------------------------------------------
# Single-process only: counts reset on restart and are not shared between
# workers, which is fine for a small demo deployment.
class RateLimiter:
    """Allows `limit` requests per IP per hour. Each feature has its own limiter."""

    def __init__(self, limit: int, message: str):
        self.limit = limit
        self.message = message  # friendly text for the 429 response
        self._requests_by_ip: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, ip: str) -> bool:
        now = time.monotonic()
        timestamps = self._requests_by_ip[ip]
        while timestamps and now - timestamps[0] > RATE_WINDOW_SECONDS:
            timestamps.popleft()
        if len(timestamps) >= self.limit:
            return False
        timestamps.append(now)
        return True

    def reject(self, ip: str, what: str) -> JSONResponse:
        logger.info("Rate limit hit for %s (%s)", ip, what)
        return JSONResponse(status_code=429, content={"detail": self.message})


debate_limiter = RateLimiter(
    5, "You've reached the limit of 5 debates per hour. Please take a break and try again later."
)
room_message_limiter = RateLimiter(
    40, "Your friends need a breather! You've sent 40 messages this hour. Try again a little later."
)
summary_limiter = RateLimiter(
    10, "That's 10 votes and offer rounds this hour. Give the room a break and try again a little later."
)


def _client_ip(request: Request) -> str:
    # Behind a proxy, start uvicorn with --proxy-headers so this is the real client IP.
    return request.client.host if request.client else "unknown"


# ---------------------------------------------------------------------------
# Debate streaming
# ---------------------------------------------------------------------------
SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}


def _sse(event: str, data: dict) -> dict:
    return {"event": event, "data": json.dumps(data)}


async def _debate_events(topic: str, rounds: int):
    """Run the graph and translate its output into SSE events.

    stream_mode="messages" yields LLM tokens as they are generated (LangGraph
    turns on streaming for the model calls inside the nodes), tagged with the
    node that produced them. stream_mode="updates" yields each node's state
    changes once it finishes, which gives us the final turn text and verdict.
    """
    speaker: str | None = None  # debater currently speaking
    pro_turns_done = 0

    def start_turn(node: str) -> dict:
        nonlocal speaker
        speaker = node
        # PRO opens each round; CON replies in the same round.
        round_no = pro_turns_done + 1 if node == "pro" else pro_turns_done
        return _sse("turn_start", {"speaker": node, "round": round_no})

    try:
        async for mode, chunk in graph.astream(
            initial_state(topic, rounds), stream_mode=["messages", "updates"]
        ):
            if mode == "messages":
                message, metadata = chunk
                node = metadata.get("langgraph_node")
                if node not in ("pro", "con"):
                    continue  # the judge's structured-output tokens are not shown
                text = content_text(message.content)
                if not text:
                    continue
                if speaker != node:
                    yield start_turn(node)
                yield _sse("token", {"speaker": node, "text": text})

            else:  # "updates": {node_name: changes}
                for node, changes in chunk.items():
                    if node in ("pro", "con"):
                        for turn in changes["transcript"]:
                            if speaker != node:  # node finished without streaming tokens
                                yield start_turn(node)
                            yield _sse("turn_end", dict(turn))
                            if node == "pro":
                                pro_turns_done += 1
                        speaker = None
                    elif node == "judge":
                        yield _sse(
                            "judge",
                            {
                                "scores": changes["scores"],
                                "winner": changes["winner"],
                                "memo": changes["memo"],
                            },
                        )

        yield _sse("done", {})
    except ModelBusyError as exc:
        # Timeout or overload: llm.py has already logged the details.
        logger.warning("Debate stopped, model busy (topic=%r, rounds=%d)", topic, rounds)
        yield _sse("error", {"message": str(exc)})
    except Exception:
        # Full details stay in the server log; the client gets a generic message.
        logger.exception("Debate failed (topic=%r, rounds=%d)", topic, rounds)
        yield _sse("error", {"message": "Something went wrong while running the debate. Please try again."})


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.post("/api/debate")
async def debate(body: DebateRequest, request: Request):
    ip = _client_ip(request)
    if not debate_limiter.allow(ip):
        return debate_limiter.reject(ip, "debate")

    logger.info("Debate started from %s: %r (%d rounds)", ip, body.topic, body.rounds)
    return EventSourceResponse(
        _debate_events(body.topic, body.rounds),
        headers=SSE_HEADERS,
        ping=15,  # keep-alive comments so proxies don't drop the connection while the judge thinks
    )


# ---------------------------------------------------------------------------
# Rooms
# ---------------------------------------------------------------------------
def _room_or_error(room_id: str, body: RoomContext):
    """Look up the room and check the chosen participants. Returns (room, None) or (None, error response)."""
    room = get_room(room_id)
    if room is None:
        return None, JSONResponse(status_code=404, content={"detail": "That room doesn't exist."})
    problem = room.validate_participants([p.model_dump() for p in body.participants])
    if problem is None and body.language not in room.languages:
        problem = f"This room supports: {', '.join(room.languages)}."
    if problem is None:
        problem = room.validate_context(body.context)
    if problem:
        return None, JSONResponse(status_code=422, content={"detail": problem})
    return room, None


async def _room_events(room, body: RoomMessageRequest, request: Request):
    """Stream one turn of a room as SSE events.

    If the client disconnects (e.g. the user sent a new message mid-reply and
    the browser aborted this request), sse-starlette cancels this generator,
    which cancels the graph and any LLM call in flight. We also check between
    events, so nothing more is generated for a client that has gone.
    """
    started = time.perf_counter()
    try:
        async for event, data in stream_turn(
            room,
            message=body.message,
            message_id=body.message_id,
            history=[m.model_dump() for m in body.history],
            participants=[p.model_dump() for p in body.participants],
            language=body.language,
            mode=body.mode,
            context=body.context,
        ):
            if await request.is_disconnected():
                logger.info("Client left room %s; stopped generating", room.id)
                return
            yield _sse(event, data)
        logger.info("Room %s turn finished in %.1fs", room.id, time.perf_counter() - started)
    except asyncio.CancelledError:
        logger.info(
            "Client disconnected from room %s after %.1fs; stopped generating", room.id, time.perf_counter() - started
        )
        raise
    except ModelBusyError as exc:
        logger.warning("Room %s stopped, model busy", room.id)
        yield _sse("error", {"message": str(exc)})
    except Exception:
        # Full details stay in the server log; the client gets a generic message.
        logger.exception("Room %s turn failed", room.id)
        yield _sse("error", {"message": "Something went wrong in the chat. Please try sending that again."})


@app.get("/api/rooms")
async def list_rooms() -> dict:
    return {"rooms": [room.public() for room in ROOMS.values()]}


@app.post("/api/rooms/{room_id}/message")
async def room_message(room_id: str, body: RoomMessageRequest, request: Request):
    room, error = _room_or_error(room_id, body)
    if error:
        return error
    ip = _client_ip(request)
    if not room_message_limiter.allow(ip):
        return room_message_limiter.reject(ip, f"{room_id} message")

    logger.info(
        "Room %s message from %s (%d history, friends=%s, language=%s)",
        room_id,
        ip,
        len(body.history),
        [p.id for p in body.participants],
        body.language,
    )
    return EventSourceResponse(_room_events(room, body, request), headers=SSE_HEADERS, ping=15)


@app.post("/api/rooms/{room_id}/summary")
async def room_summary(room_id: str, body: RoomContext, request: Request):
    room, error = _room_or_error(room_id, body)
    if error:
        return error
    ip = _client_ip(request)
    if not summary_limiter.allow(ip):
        return summary_limiter.reject(ip, f"{room_id} summary")

    started = time.perf_counter()
    try:
        result = await summarize(
            room,
            history=[m.model_dump() for m in body.history],
            participants=[p.model_dump() for p in body.participants],
            language=body.language,
            context=body.context,
        )
    except SummaryError as exc:
        return JSONResponse(status_code=422, content={"detail": str(exc)})
    except ModelBusyError as exc:
        return JSONResponse(status_code=503, content={"detail": str(exc)})
    except Exception:
        logger.exception("Room %s summary failed", room_id)
        return JSONResponse(status_code=500, content={"detail": "Couldn't run the vote right now. Please try again."})
    logger.info("Room %s summary finished in %.1fs", room_id, time.perf_counter() - started)
    return result
