"""
Nth Opinion - FastAPI backend (Debate Arena + rooms).

Endpoints:
    GET  /health                        -> {"status": "ok"}
    POST /api/debate                    -> Server-Sent Events stream of the debate
    GET  /api/rooms                     -> list of rooms
    GET  /api/languages                 -> the languages every room supports (languages.py)
    GET  /api/tts/status                -> which voice engine is available (tts.py)
    /api/me, /api/personas, /api/conversations -> optional accounts (accounts_api.py; needs sign-in)
    POST /api/tts                       -> speech for one message, when TTS_PROVIDER=gemini (audio/wav)
    POST /api/rooms/{room_id}/message   -> SSE stream of the room's replies
    POST /api/rooms/{room_id}/summary   -> the room's final structured output (JSON)
    POST /api/personas/generate         -> a custom persona from a short description (JSON)
    POST /api/documents/extract         -> text + digest of an uploaded PDF / DOCX / TXT (multipart)
    POST /api/documents/digest          -> digest of pasted text (JSON)

Rooms that take documents get them as short digests ("documents"); the files
themselves are processed in memory only and never stored (see documents.py).

Room requests may also carry "guests" (personas from other rooms, or the
user's own) and "custom_personas" (the user's own personas, sent inline: the
API stays stateless). Custom persona text is untrusted; see rooms/engine.py.

SSE events sent by /api/debate (each `data:` field is JSON):
    turn_start  {"speaker", "round"}
    token       {"speaker", "text"}            one chunk of the LLM output
    turn_end    {"speaker", "round", "text"}   final text (word limit applied)
    judge       {"scores", "winner", "memo"}
    done        {}
    error       {"message", "code"}            safe, user-facing message only (codes below)

SSE events sent by /api/rooms/{room_id}/message:
    typing      {"friend_id"}
    message     {"id", "friend_id", "text", "reply_to", "mentions", "emotion"}
    reaction    {"friend_id", "message_id", "emoji"}
    safety      {"helpline_text"}
    mode        {"mode"}                       only rooms with modes
    your_turn   {}
    error       {"message", "code"}

"Behind the scenes": send "behind_the_scenes": true with a debate or room
message and the stream also includes trace events (see agent_trace.py):
    node_start         {"node", "label"}           (+ "round" in the debate)
    node_end           {"node", "duration_ms"}
    director_decision  {"action", "persona_id", "reply_to", "reason"}   rooms only
    safety_check       {"mode": "normal" | "supportive"}               rooms only

Error codes: "quota_exhausted" (Gemini quota / rate limit used up) or
"model_unavailable" (any other model failure). The frontend offers the demo
replay for both. Failed summaries return the same code next to "detail".

Run with:  uvicorn main:app --port 8000
Behind a proxy (e.g. Render):
    uvicorn main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips="*"
"""

import asyncio
import json
import logging
import os
import time
from collections import defaultdict, deque
from typing import Annotated, Literal

from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import AfterValidator, AliasChoices, BaseModel, ConfigDict, Field, StringConstraints
from sse_starlette.sse import EventSourceResponse

from graph import graph, initial_state
from llm import ModelBusyError, content_text
import documents as docs
import languages
import tts
from persona_builder import PersonaRefused, generate_persona
from rooms import ROOMS, SummaryError, get_room, stream_turn, summarize
from rooms.engine import build_cast
# After llm (which loads .env), so DATABASE_URL and SUPABASE_URL are read.
import accounts_api

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

app = FastAPI(title="Nth Opinion API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)


# ---------------------------------------------------------------------------
# Request schema + friendly validation errors
# ---------------------------------------------------------------------------
def _known_language(value: str) -> str:
    if not languages.is_language(value):
        raise ValueError("unknown language")
    return value


# A language id from the shared registry (languages.py).
LanguageId = Annotated[str, AfterValidator(_known_language)]
LANGUAGE_MESSAGE = f"Language must be one of: {', '.join(languages.LANGUAGES)}."


class DebateRequest(BaseModel):
    topic: Annotated[str, StringConstraints(strip_whitespace=True, min_length=5, max_length=200)]
    rounds: int = Field(ge=1, le=3)
    behind_the_scenes: bool = False  # also stream trace events for the "Behind the scenes" panel
    language: LanguageId = "english"


Id = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)]


class HistoryMessage(BaseModel):
    id: Id
    sender: Id  # "user" or a persona id
    text: Annotated[str, StringConstraints(max_length=2000)]
    reply_to: Id | None = None


class Participant(BaseModel):
    id: Id
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=20)]


def _text(min_length: int, max_length: int):
    return Annotated[str, StringConstraints(strip_whitespace=True, min_length=min_length, max_length=max_length)]


class CustomPersona(BaseModel):
    """One of the user's own personas, sent inline. Every field is checked strictly; the text is untrusted."""

    model_config = ConfigDict(extra="forbid")

    id: Annotated[str, StringConstraints(pattern=r"^custom_[a-z0-9]{4,16}$")]
    name: _text(1, 20)
    emoji: _text(1, 8)
    colour: Annotated[str, StringConstraints(pattern=r"^#[0-9A-Fa-f]{6}$")]
    personality: _text(1, 300)
    speaking_habits: _text(1, 200)
    typical_stance: _text(1, 200)


class RoomDocument(BaseModel):
    model_config = ConfigDict(extra="forbid")

    doc_type: docs.DocType
    filename: _text(1, 120)
    digest: _text(1, 2000)


class RoomContext(BaseModel):
    """What every room request carries: the recent chat, who's in the room, and the language.

    The API is stateless, so the client sends the history each time; only the
    last 40 messages are used. Participants are sent as "friends" by the Group
    Chat ("participants" is accepted too, for other rooms).
    """

    history: list[HistoryMessage] = Field(default_factory=list, max_length=500)
    participants: list[Participant] = Field(validation_alias=AliasChoices("friends", "participants"))
    language: LanguageId = "english"
    # Room-specific details from the setup screen, e.g. {"startup": "...", "ask": "..."} in Shark Tank.
    # Each room checks its own per-field limits; 8000 is just an upper bound (pasted resumes can be long).
    context: dict[Id, Annotated[str, StringConstraints(max_length=8000)]] = Field(default_factory=dict, max_length=10)
    # Cross-room guests (built-in personas from other rooms, or ids from custom_personas).
    guests: list[Participant] = Field(default_factory=list, max_length=2)
    # The user's own personas used as members or guests in this request.
    custom_personas: list[CustomPersona] = Field(default_factory=list, max_length=6)
    # The user's documents, as digests only (POST /api/documents/*). Untrusted; never traced or logged.
    documents: list[RoomDocument] = Field(default_factory=list, max_length=3)


class RoomMessageRequest(RoomContext):
    message: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)]
    message_id: Id | None = None  # the client's id for this message, so replies can quote it
    mode: Id | None = None  # rooms with modes: the mode from the last `mode` event
    behind_the_scenes: bool = False  # also stream trace events for the "Behind the scenes" panel


def _room_validation_message(fields: set[str]) -> str:
    """A friendly sentence for an invalid room request, based on which fields failed.

    The nested lists come first: their items have fields like "id" and "name" too.
    """
    if "custom_personas" in fields:
        return "One of your own friends couldn't be read. Check their name and descriptions on the My Friends page."
    if "guests" in fields:
        return "Rooms take at most 2 guests."
    if "documents" in fields:
        return "A document couldn't be read. Remove it and add it again (at most 3 per room)."
    if "message" in fields:
        return "Your message must be between 1 and 1000 characters."
    if "history" in fields:
        return "The chat history couldn't be read. Try clearing the chat."
    if "name" in fields:
        return "Names must be between 1 and 20 characters."
    if fields & {"friends", "participants", "id"}:
        return "Pick 3 or 4 friends for the group."
    if "language" in fields:
        return LANGUAGE_MESSAGE
    if "context" in fields:
        return "Some of the room details couldn't be read. Try editing the room setup."
    return 'Invalid request. Send JSON like {"message": "...", "history": [], "friends": [...], "language": "english"}.'


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Return a short readable message instead of Pydantic's raw error list."""
    if accounts_api.is_account_path(request.url.path, request.method):
        fields = {str(part) for err in exc.errors() for part in err.get("loc", ())}
        return JSONResponse(status_code=422, content={"detail": accounts_api.validation_message(fields), "code": "invalid"})
    if request.url.path.startswith("/api/documents"):
        fields = {str(part) for err in exc.errors() for part in err.get("loc", ())}
        message = (
            f"Paste between {docs.MIN_PASTED} and {docs.MAX_TEXT:,} characters."
            if "text" in fields
            else "Choose a file and a document type (resume, job_description, pitch_deck or notes)."
        )
        return JSONResponse(status_code=422, content={"detail": message})
    if request.url.path.startswith("/api/personas"):
        fields = {str(part) for err in exc.errors() for part in err.get("loc", ())}
        return JSONResponse(status_code=422, content={"detail": _persona_validation_message(fields)})
    if request.url.path.startswith("/api/rooms"):
        fields = {str(part) for err in exc.errors() for part in err.get("loc", ())}
        return JSONResponse(status_code=422, content={"detail": _room_validation_message(fields)})
    fields = {str(err["loc"][-1]) for err in exc.errors() if err.get("loc")}
    if "topic" in fields:
        message = "Topic must be between 5 and 200 characters."
    elif "rounds" in fields:
        message = "Rounds must be a whole number from 1 to 3."
    elif "language" in fields:
        message = LANGUAGE_MESSAGE
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
document_limiter = RateLimiter(
    15, "That's 15 documents this hour. Take a break and try again a little later, or paste the key parts instead."
)
tts_limiter = RateLimiter(60, "That's a lot of listening for one hour! Voices switch back to your browser's for now.")
persona_limiter = RateLimiter(
    10, "That's 10 new friends this hour! Give the builder a break and try again a little later."
)
summary_limiter = RateLimiter(
    10, "That's 10 votes and offer rounds this hour. Give the room a break and try again a little later."
)


def _client_ip(request: Request) -> str:
    """The visitor's IP, used as the rate-limit key.

    Behind Render's proxy, uvicorn runs with --proxy-headers --forwarded-allow-ips="*",
    so its ProxyHeadersMiddleware has already replaced request.client with the
    first address in X-Forwarded-For (the original visitor). We deliberately don't
    parse X-Forwarded-For here: without those flags (e.g. local dev) the header
    is ignored, so a client can't fake it to dodge the limits.
    """
    return request.client.host if request.client else "unknown"


# ---------------------------------------------------------------------------
# Debate streaming
# ---------------------------------------------------------------------------
SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}


def _sse(event: str, data: dict) -> dict:
    return {"event": event, "data": json.dumps(data)}


async def _debate_events(topic: str, rounds: int, trace: bool = False, language: str = "english"):
    """Run the graph and translate its output into SSE events.

    stream_mode="messages" yields LLM tokens as they are generated (LangGraph
    turns on streaming for the model calls inside the nodes), tagged with the
    node that produced them. stream_mode="updates" yields each node's state
    changes once it finishes, which gives us the final turn text and verdict.
    With `trace`, stream_mode="custom" adds the nodes' trace events, passed on as they are.
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
        stream_modes = ["messages", "updates", "custom"] if trace else ["messages", "updates"]
        async for mode, chunk in graph.astream(initial_state(topic, rounds, trace, language), stream_mode=stream_modes):
            if mode == "custom":  # trace events: (event, data)
                event, data = chunk
                yield _sse(event, data)
            elif mode == "messages":
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
        logger.warning("Debate stopped, model busy (topic=%r, rounds=%d, code=%s)", topic, rounds, exc.code)
        yield _sse("error", {"message": str(exc), "code": exc.code})
    except Exception:
        # Full details stay in the server log; the client gets a generic message.
        logger.exception("Debate failed (topic=%r, rounds=%d)", topic, rounds)
        yield _sse(
            "error",
            {"message": "Something went wrong while running the debate. Please try again.", "code": "model_unavailable"},
        )


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
        _debate_events(body.topic, body.rounds, body.behind_the_scenes, body.language),
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
    cast = build_cast(room, *_cast_args(body))
    problem = cast if isinstance(cast, str) else None
    if problem is None and not languages.is_language(body.language):
        problem = LANGUAGE_MESSAGE
    if problem is None:
        problem = room.validate_documents([d.model_dump() for d in body.documents]) or room.validate_context(
            body.context, [d.doc_type for d in body.documents]
        )
    if problem:
        return None, JSONResponse(status_code=422, content={"detail": problem})
    return room, None


def _cast_args(body: RoomContext) -> tuple[list[dict], list[dict], list[dict]]:
    """(members, guests, custom personas) as plain dicts for the engine."""
    return (
        [p.model_dump() for p in body.participants],
        [g.model_dump() for g in body.guests],
        [c.model_dump() for c in body.custom_personas],
    )


async def _room_events(room, body: RoomMessageRequest, request: Request):
    """Stream one turn of a room as SSE events.

    If the client disconnects (e.g. the user sent a new message mid-reply and
    the browser aborted this request), sse-starlette cancels this generator,
    which cancels the graph and any LLM call in flight. We also check between
    events, so nothing more is generated for a client that has gone.
    """
    started = time.perf_counter()
    members, guests, custom = _cast_args(body)
    try:
        async for event, data in stream_turn(
            room,
            message=body.message,
            message_id=body.message_id,
            history=[m.model_dump() for m in body.history],
            participants=members,
            guests=guests,
            custom=custom,
            documents=[d.model_dump() for d in body.documents],
            language=body.language,
            mode=body.mode,
            context=body.context,
            trace=body.behind_the_scenes,
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
        logger.warning("Room %s stopped, model busy (code=%s)", room.id, exc.code)
        yield _sse("error", {"message": str(exc), "code": exc.code})
    except Exception:
        # Full details stay in the server log; the client gets a generic message.
        logger.exception("Room %s turn failed", room.id)
        yield _sse(
            "error",
            {"message": "Something went wrong in the chat. Please try sending that again.", "code": "model_unavailable"},
        )


@app.get("/api/languages")
async def list_languages() -> dict:
    return {"languages": languages.public_languages()}


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
    members, guests, custom = _cast_args(body)
    try:
        result = await summarize(
            room,
            history=[m.model_dump() for m in body.history],
            participants=members,
            guests=guests,
            custom=custom,
            documents=[d.model_dump() for d in body.documents],
            language=body.language,
            context=body.context,
        )
    except SummaryError as exc:
        return JSONResponse(status_code=422, content={"detail": str(exc)})
    except ModelBusyError as exc:
        return JSONResponse(status_code=503, content={"detail": str(exc), "code": exc.code})
    except Exception:
        logger.exception("Room %s summary failed", room_id)
        return JSONResponse(
            status_code=500,
            content={"detail": "Couldn't run the vote right now. Please try again.", "code": "model_unavailable"},
        )
    logger.info("Room %s summary finished in %.1fs", room_id, time.perf_counter() - started)
    return result


# ---------------------------------------------------------------------------
# Persona builder ("Build your own friend")
# ---------------------------------------------------------------------------
class PersonaRequest(BaseModel):
    description: _text(10, 300)
    name: _text(1, 20) | None = None
    relationship: _text(1, 40) | None = None
    language: LanguageId = "english"


def _persona_validation_message(fields: set[str]) -> str:
    if "description" in fields:
        return "Describe your friend in 10 to 300 characters."
    if "name" in fields:
        return "Names must be between 1 and 20 characters."
    if "relationship" in fields:
        return "Keep the relationship short, like \"dad\" or \"mentor\" (up to 40 characters)."
    return LANGUAGE_MESSAGE


@app.post("/api/personas/generate")
async def personas_generate(body: PersonaRequest, request: Request):
    ip = _client_ip(request)
    if not persona_limiter.allow(ip):
        return persona_limiter.reject(ip, "persona")
    try:
        persona = await generate_persona(body.description, body.name, body.relationship, body.language)
    except PersonaRefused as exc:
        logger.info("Persona description refused from %s", ip)
        return JSONResponse(status_code=422, content={"detail": str(exc), "code": "persona_refused"})
    except ModelBusyError as exc:
        return JSONResponse(status_code=503, content={"detail": str(exc), "code": exc.code})
    except Exception:
        logger.exception("Persona builder failed")
        return JSONResponse(
            status_code=500,
            content={"detail": "Couldn't build your friend right now. Please try again.", "code": "model_unavailable"},
        )
    return persona


# ---------------------------------------------------------------------------
# Documents (uploads and pasted text -> digest). In memory only; contents never logged.
# ---------------------------------------------------------------------------
def _document_error(exc: Exception) -> JSONResponse:
    if isinstance(exc, docs.DocumentError):
        return JSONResponse(status_code=exc.status, content={"detail": str(exc), "code": exc.code})
    if isinstance(exc, ModelBusyError):
        return JSONResponse(status_code=503, content={"detail": str(exc), "code": exc.code})
    logger.error("Document digest failed (%s)", type(exc).__name__)  # no traceback: it could quote the document
    return JSONResponse(
        status_code=500, content={"detail": "Couldn't read that document right now. Please try again.", "code": "model_unavailable"}
    )


@app.post("/api/documents/extract")
async def documents_extract(
    request: Request,
    file: UploadFile = File(...),
    doc_type: str = Form(...),
):
    if doc_type not in docs.MAX_PAGES:
        return JSONResponse(status_code=422, content={"detail": "Unknown document type.", "code": "bad_type"})
    ip = _client_ip(request)
    if not document_limiter.allow(ip):
        return document_limiter.reject(ip, "document")
    # Read at most one byte past the limit, so a huge upload is never held in memory.
    data = await file.read(docs.MAX_BYTES + 1)
    await file.close()
    try:
        text, pages, _ = await docs.extract(data, doc_type)
        digest = await docs.build_digest(doc_type, text)
    except Exception as exc:  # noqa: BLE001  (every failure becomes a friendly message)
        return _document_error(exc)
    filename = (file.filename or "document").rsplit("/", 1)[-1].rsplit("\\", 1)[-1][:120]
    return {"doc_type": doc_type, "filename": filename, "pages": pages, "char_count": len(text), "digest": digest, "text": text}


class PastedDocument(BaseModel):
    doc_type: docs.DocType
    text: _text(docs.MIN_PASTED, docs.MAX_TEXT)


@app.post("/api/documents/digest")
async def documents_digest(body: PastedDocument, request: Request):
    ip = _client_ip(request)
    if not document_limiter.allow(ip):
        return document_limiter.reject(ip, "document")
    text = docs.truncate(body.text)
    try:
        digest = await docs.build_digest(body.doc_type, text)
    except Exception as exc:  # noqa: BLE001
        return _document_error(exc)
    logger.info("Digested pasted %s: %d characters", body.doc_type, len(text))
    return {"doc_type": body.doc_type, "filename": "Pasted text", "pages": 1, "char_count": len(text), "digest": digest, "text": text}


# ---------------------------------------------------------------------------
# Voices (optional AI text-to-speech; see tts.py). The frontend falls back to
# browser voices whenever this is off or fails.
# ---------------------------------------------------------------------------
class TTSRequest(BaseModel):
    text: _text(1, 1000)
    persona_id: Id
    language: LanguageId = "english"


@app.get("/api/tts/status")
async def tts_status() -> dict:
    return {"provider": tts.PROVIDER, "available": tts.available()}


@app.post("/api/tts")
async def text_to_speech(body: TTSRequest, request: Request):
    if not tts.available():
        return JSONResponse(status_code=404, content={"detail": "AI voices are turned off on this server.", "code": "tts_disabled"})
    ip = _client_ip(request)
    if not tts_limiter.allow(ip):
        return tts_limiter.reject(ip, "tts")
    try:
        audio, cached = await tts.synthesize(body.text, body.persona_id, body.language)
    except tts.TTSError as exc:
        status = 429 if exc.code == "quota_exhausted" else 502
        return JSONResponse(status_code=status, content={"detail": str(exc), "code": exc.code})
    return Response(content=audio, media_type="audio/wav", headers={"Cache-Control": "private, max-age=86400", "X-TTS-Cache": "hit" if cached else "miss"})


# ---------------------------------------------------------------------------
# Optional accounts (Supabase sign-in; see accounts_api.py). Off without
# DATABASE_URL and SUPABASE_URL; guests never need them.
# ---------------------------------------------------------------------------
account_limiter = RateLimiter(300, "That's a lot of saving for one hour. Try again a little later.")
app.add_exception_handler(accounts_api.AccountError, accounts_api.account_error_handler)
app.include_router(accounts_api.build_router(account_limiter))
