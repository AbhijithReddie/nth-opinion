"""
Account endpoints (optional sign-in with Supabase). All need "Authorization: Bearer <token>".

    GET    /api/account/status          -> {"enabled"}  (no sign-in needed)
    GET    /api/me                      -> profile
    PATCH  /api/me                      -> update display name, preferred language
    DELETE /api/me                      -> delete all the user's rows; the app then signs out
    GET    /api/me/export               -> everything we store for the user, as JSON
    GET    /api/personas                -> synced custom personas
    PUT    /api/personas                -> replace the list
    DELETE /api/personas                -> remove them all
    GET    /api/conversations           -> list (id, room, title, dates)
    POST   /api/conversations           -> save a new one
    GET    /api/conversations/{id}      -> one, with setup, messages and result
    PUT    /api/conversations/{id}      -> update (also rename: just "title")
    DELETE /api/conversations/{id}

Errors: {"detail": friendly text, "code"} with code "accounts_disabled" (503, no
DATABASE_URL or SUPABASE_URL), "auth_required" / "session_expired" (401), "not_found",
"limit" (409/413) or "rate_limited" (429). The user id always comes from the verified
token, never from the request body.
"""

import logging
import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Request
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from pydantic import AfterValidator, BaseModel, ConfigDict, Field, StringConstraints

import accounts
import auth
import db
import languages
from rooms import ROOMS

logger = logging.getLogger("nth_opinion.accounts")

# Swappable in tests (tests/test_accounts.py uses an in-memory store and a fake verifier).
STORE: Any = accounts.PostgresStore() if db.enabled() else None
get_verifier = auth.verifier

ACCOUNT_PATHS = ("/api/me", "/api/conversations", "/api/account")


class AccountError(Exception):
    def __init__(self, status: int, message: str, code: str):
        super().__init__(message)
        self.status, self.code = status, code


async def account_error_handler(request: Request, exc: AccountError) -> JSONResponse:
    return JSONResponse(status_code=exc.status, content={"detail": str(exc), "code": exc.code})


def is_account_path(path: str, method: str) -> bool:
    """For main.py's validation handler. /api/personas/generate (the persona builder) isn't one."""
    return path.startswith(ACCOUNT_PATHS) or (path == "/api/personas" and method in {"GET", "PUT", "DELETE"})


def validation_message(fields: set[str]) -> str:
    if "personas" in fields:
        return f"Your friends couldn't be saved: at most {accounts.MAX_PERSONAS}, each with a name and descriptions."
    if "display_name" in fields:
        return "Display names can be at most 60 characters."
    if "preferred_language" in fields:
        return f"Language must be one of: {', '.join(languages.LANGUAGES)}."
    if "title" in fields:
        return "Titles must be between 1 and 120 characters."
    if "room_id" in fields:
        return "That room doesn't exist."
    return "That couldn't be saved: some of the data didn't look right."


# --- models -----------------------------------------------------------------------------
def _language(value: str | None) -> str | None:
    if value is not None and not languages.is_language(value):
        raise ValueError("unknown language")
    return value


def _room(value: str) -> str:
    if value not in ROOMS:
        raise ValueError("unknown room")
    return value


class ProfilePatch(BaseModel):
    display_name: Annotated[str, StringConstraints(strip_whitespace=True, max_length=60)] | None = None
    preferred_language: Annotated[str | None, AfterValidator(_language)] = None


class PersonaIn(BaseModel):
    """A custom persona as the browser stores it (lib/customPersonas.ts); unknown fields are dropped."""

    model_config = ConfigDict(extra="ignore")
    id: Annotated[str, StringConstraints(pattern=r"^custom_[a-z0-9]{4,16}$")]
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=20)]
    emoji: Annotated[str, StringConstraints(min_length=1, max_length=8)]
    colour: Annotated[str, StringConstraints(pattern=r"^#[0-9A-Fa-f]{6}$")]
    personality: Annotated[str, StringConstraints(min_length=1, max_length=300)]
    speaking_habits: Annotated[str, StringConstraints(min_length=1, max_length=200)]
    typical_stance: Annotated[str, StringConstraints(min_length=1, max_length=200)]
    avatar: dict[str, str | int | float]


class PersonasPut(BaseModel):
    personas: list[PersonaIn] = Field(max_length=accounts.MAX_PERSONAS)


Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]


class ConversationIn(BaseModel):
    room_id: Annotated[str, AfterValidator(_room)]
    title: Title
    setup: dict[str, Any] = Field(default_factory=dict)
    messages: list[Any] = Field(default_factory=list)
    result: Any = None
    safety_flagged: bool = False


class ConversationPatch(BaseModel):
    title: Title | None = None
    setup: dict[str, Any] | None = None
    messages: list[Any] | None = None
    result: Any = None
    safety_flagged: bool | None = None


# --- the router -----------------------------------------------------------------------------
def build_router(limiter) -> APIRouter:
    """`limiter` is main.py's RateLimiter, keyed here by user id instead of IP."""
    router = APIRouter()

    def store():
        if STORE is None or get_verifier() is None:
            raise AccountError(503, "Accounts aren't available right now. Everything else works as a guest.", "accounts_disabled")
        return STORE

    def current_user(request: Request) -> auth.User:
        store()
        token = auth.bearer_token(request.headers.get("authorization"))
        if not token:
            raise AccountError(401, "Sign in to use this.", "auth_required")
        try:
            user = get_verifier().verify(token)
        except auth.AuthError as exc:
            raise AccountError(401, str(exc), exc.code) from exc
        if not limiter.allow(f"user:{user.id}"):
            raise AccountError(429, "That's a lot of saving for one hour. Try again a little later.", "rate_limited")
        return user

    User = Annotated[auth.User, Depends(current_user)]

    def conversation_id(value: str) -> str:
        try:
            return str(uuid.UUID(value))
        except ValueError:
            raise AccountError(404, "That conversation doesn't exist.", "not_found") from None

    def prepared(setup: dict, messages: list, result: Any) -> tuple[dict, list, Any]:
        """Drops documents and other private keys, then checks the size limits."""
        setup, messages, result = accounts.clean_setup(setup), accounts.strip_private(messages), accounts.strip_private(result)
        try:
            accounts.check_conversation_size(setup, messages, result)
        except accounts.LimitError as exc:
            raise AccountError(413, str(exc), "limit") from exc
        return setup, messages, result

    @router.get("/api/account/status")
    def account_status() -> dict:
        return {"enabled": STORE is not None and get_verifier() is not None}

    # --- profile ---------------------------------------------------------------------------
    @router.get("/api/me")
    def get_me(user: User):
        return jsonable_encoder({**store().get_profile(user.id), "email": user.email})

    @router.patch("/api/me")
    def patch_me(body: ProfilePatch, user: User):
        changes = body.model_dump(exclude_unset=True)
        if "display_name" in changes:
            changes["display_name"] = changes["display_name"] or None
        return jsonable_encoder({**store().update_profile(user.id, changes), "email": user.email})

    @router.delete("/api/me")
    def delete_me(user: User):
        store().delete_user_data(user.id)
        logger.info("Deleted account data for a user")
        return {"deleted": True, "sign_out": True}

    @router.get("/api/me/export")
    def export_me(user: User):
        data = jsonable_encoder({"exported_for": user.email, **store().export(user.id)})
        return JSONResponse(data, headers={"Content-Disposition": 'attachment; filename="nth-opinion-my-data.json"'})

    # --- custom personas -------------------------------------------------------------------------
    @router.get("/api/personas")
    def get_personas(user: User):
        return {"personas": store().list_personas(user.id)}

    @router.put("/api/personas")
    def put_personas(body: PersonasPut, user: User):
        personas, seen = [], set()
        for p in body.personas:
            data = p.model_dump()
            if p.id in seen:
                continue  # duplicates: the first one wins
            if accounts.json_size(data) > accounts.MAX_PERSONA_BYTES:
                raise AccountError(413, f"{p.name} is too big to save.", "limit")
            seen.add(p.id)
            personas.append(data)
        return {"personas": store().replace_personas(user.id, personas)}

    @router.delete("/api/personas")
    def delete_personas(user: User):
        store().delete_personas(user.id)
        return {"personas": []}

    # --- conversations ----------------------------------------------------------------------------
    @router.get("/api/conversations")
    def list_conversations(user: User):
        return jsonable_encoder({"conversations": store().list_conversations(user.id), "max": accounts.MAX_CONVERSATIONS})

    @router.post("/api/conversations", status_code=201)
    def create_conversation(body: ConversationIn, user: User):
        s = store()
        if s.count_conversations(user.id) >= accounts.MAX_CONVERSATIONS:
            raise AccountError(
                409,
                f"You've saved {accounts.MAX_CONVERSATIONS} conversations, the most we keep. "
                "Delete one on My conversations to save this one.",
                "limit",
            )
        setup, messages, result = prepared(body.setup, body.messages, body.result)
        row = s.create_conversation(
            user.id,
            {"room_id": body.room_id, "title": body.title, "setup": setup, "messages": messages, "result": result, "safety_flagged": body.safety_flagged},
        )
        return jsonable_encoder(row)

    @router.get("/api/conversations/{cid}")
    def get_conversation(cid: str, user: User):
        row = store().get_conversation(user.id, conversation_id(cid))
        if row is None:
            raise AccountError(404, "That conversation doesn't exist.", "not_found")
        return jsonable_encoder(row)

    @router.put("/api/conversations/{cid}")
    def update_conversation(cid: str, body: ConversationPatch, user: User):
        s, cid = store(), conversation_id(cid)
        changes = body.model_dump(exclude_unset=True)
        if {"setup", "messages", "result"} & changes.keys():
            current = s.get_conversation(user.id, cid)
            if current is None:
                raise AccountError(404, "That conversation doesn't exist.", "not_found")
            setup, messages, result = prepared(
                changes.get("setup", current["setup"]), changes.get("messages", current["messages"]), changes.get("result", current["result"])
            )
            changes.update(setup=setup, messages=messages, result=result)
        row = s.update_conversation(user.id, cid, changes)
        if row is None:
            raise AccountError(404, "That conversation doesn't exist.", "not_found")
        return jsonable_encoder(row)

    @router.delete("/api/conversations/{cid}")
    def delete_conversation(cid: str, user: User):
        if not store().delete_conversation(user.id, conversation_id(cid)):
            raise AccountError(404, "That conversation doesn't exist.", "not_found")
        return {"deleted": True}

    return router
