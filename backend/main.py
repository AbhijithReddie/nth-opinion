"""
AI Debate Arena - FastAPI backend.

Endpoints:
    GET  /health      -> {"status": "ok"}
    POST /api/debate  -> Server-Sent Events stream of the debate

SSE events sent by /api/debate (each `data:` field is JSON):
    turn_start  {"speaker", "round"}
    token       {"speaker", "text"}            one chunk of the LLM output
    turn_end    {"speaker", "round", "text"}   final text (word limit applied)
    judge       {"scores", "winner", "memo"}
    done        {}
    error       {"message"}                    safe, user-facing message only

Run with:  uvicorn main:app --port 8000
"""

import json
import logging
import os
import time
from collections import defaultdict, deque
from typing import Annotated

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, StringConstraints
from sse_starlette.sse import EventSourceResponse

from graph import _content_text, graph, initial_state

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

RATE_LIMIT = 5  # debates per IP...
RATE_WINDOW_SECONDS = 60 * 60  # ...per hour

app = FastAPI(title="AI Debate Arena")

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


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Return a short readable message instead of Pydantic's raw error list."""
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
_requests_by_ip: dict[str, deque[float]] = defaultdict(deque)


def _client_ip(request: Request) -> str:
    # Behind a proxy, start uvicorn with --proxy-headers so this is the real client IP.
    return request.client.host if request.client else "unknown"


def _allow_request(ip: str) -> bool:
    now = time.monotonic()
    timestamps = _requests_by_ip[ip]
    while timestamps and now - timestamps[0] > RATE_WINDOW_SECONDS:
        timestamps.popleft()
    if len(timestamps) >= RATE_LIMIT:
        return False
    timestamps.append(now)
    return True


# ---------------------------------------------------------------------------
# Debate streaming
# ---------------------------------------------------------------------------
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
                text = _content_text(message.content)
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
    if not _allow_request(ip):
        logger.info("Rate limit hit for %s", ip)
        return JSONResponse(
            status_code=429,
            content={
                "detail": f"You've reached the limit of {RATE_LIMIT} debates per hour. "
                "Please take a break and try again later."
            },
        )

    logger.info("Debate started from %s: %r (%d rounds)", ip, body.topic, body.rounds)
    return EventSourceResponse(
        _debate_events(body.topic, body.rounds),
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        ping=15,  # keep-alive comments so proxies don't drop the connection while the judge thinks
    )
