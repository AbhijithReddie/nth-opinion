"""
Account data: profiles, synced custom personas and saved conversations.

Every method takes the *verified* user id (from auth.py) as its first argument and
every SQL statement filters by it, so one user can never read or change another's
rows (tests/test_accounts.py checks each statement). Postgres Row Level Security is
a second line of defence (db/migrations/001_accounts.sql).

What is never stored: uploaded documents or their digests, camera or voice audio.
`clean_setup` keeps only known setup fields and `strip_private` drops document keys
anywhere in what's saved.
"""

import json
from typing import Any

from psycopg.types.json import Jsonb

import db

# --- limits -------------------------------------------------------------------------
MAX_CONVERSATIONS = 50  # saved conversations per user
MAX_MESSAGES = 200  # items per conversation
MAX_CONVERSATION_BYTES = 200_000  # setup + messages + result, as JSON
MAX_PERSONAS = 12  # the same cap as the browser's list (frontend/src/lib/customPersonas.ts)
MAX_PERSONA_BYTES = 4_000

# Setup fields kept when saving a conversation: who's in it, the language and the room details.
SETUP_KEYS = {"title", "participants", "guests", "language", "context", "custom", "mode"}
# Never saved, wherever they appear: uploaded documents and their digests, camera and audio.
PRIVATE_KEYS = {"documents", "document", "digest", "digests", "files", "file", "camera", "audio"}


class LimitError(Exception):
    """Too much data. str() is a friendly message."""


def strip_private(value: Any) -> Any:
    """A copy of `value` without PRIVATE_KEYS at any depth."""
    if isinstance(value, dict):
        return {k: strip_private(v) for k, v in value.items() if k not in PRIVATE_KEYS}
    if isinstance(value, list):
        return [strip_private(v) for v in value]
    return value


def clean_setup(setup: dict) -> dict:
    return strip_private({k: v for k, v in setup.items() if k in SETUP_KEYS})


def json_size(*values: Any) -> int:
    return sum(len(json.dumps(v, ensure_ascii=False, separators=(",", ":")).encode()) for v in values)


def check_conversation_size(setup: dict, messages: list, result: Any) -> None:
    if len(messages) > MAX_MESSAGES:
        raise LimitError(f"A saved conversation can hold at most {MAX_MESSAGES} messages.")
    if json_size(setup, messages, result) > MAX_CONVERSATION_BYTES:
        raise LimitError("This conversation is too long to save (at most 200 KB). Start a new one to keep saving.")


CONVERSATION_LIST_FIELDS = "id, room_id, title, safety_flagged, created_at, updated_at"
CONVERSATION_FIELDS = f"{CONVERSATION_LIST_FIELDS}, setup, messages, result"


class PostgresStore:
    """All account queries. Each one is scoped to `user_id`."""

    def _all(self, sql: str, params: tuple) -> list[dict]:
        with db.pool().connection() as conn:
            return conn.execute(sql, params).fetchall()

    def _one(self, sql: str, params: tuple) -> dict | None:
        with db.pool().connection() as conn:
            return conn.execute(sql, params).fetchone()

    # --- profile ------------------------------------------------------------------
    def get_profile(self, user_id: str) -> dict:
        # Created on first use; Supabase owns the auth user, we own this row.
        row = self._one(
            "insert into profiles (user_id) values (%s) on conflict (user_id) do update set user_id = excluded.user_id "
            "returning user_id, display_name, preferred_language, memory_enabled, created_at, updated_at",
            (user_id,),
        )
        return row

    def update_profile(self, user_id: str, changes: dict) -> dict:
        self.get_profile(user_id)
        allowed = {k: v for k, v in changes.items() if k in {"display_name", "preferred_language", "memory_enabled"}}
        if allowed:
            sets = ", ".join(f"{k} = %s" for k in allowed)  # keys come from the allow-list above, never the client
            self._one(f"update profiles set {sets} where user_id = %s returning user_id", (*allowed.values(), user_id))
        return self.get_profile(user_id)

    # --- custom personas ---------------------------------------------------------------
    def list_personas(self, user_id: str) -> list[dict]:
        rows = self._all("select data from custom_personas where user_id = %s order by created_at, id", (user_id,))
        return [r["data"] for r in rows]

    def replace_personas(self, user_id: str, personas: list[dict]) -> list[dict]:
        """The user's full list: removes the ones not in `personas`, upserts the rest."""
        with db.pool().connection() as conn, conn.transaction():
            ids = [p["id"] for p in personas]
            conn.execute("delete from custom_personas where user_id = %s and not (id = any(%s))", (user_id, ids))
            for p in personas:
                conn.execute(
                    "insert into custom_personas (user_id, id, data) values (%s, %s, %s) "
                    "on conflict (user_id, id) do update set data = excluded.data where custom_personas.user_id = %s",
                    (user_id, p["id"], Jsonb(p), user_id),
                )
        return self.list_personas(user_id)

    def delete_personas(self, user_id: str) -> None:
        self._all("delete from custom_personas where user_id = %s returning id", (user_id,))

    # --- conversations ----------------------------------------------------------------
    def list_conversations(self, user_id: str) -> list[dict]:
        return self._all(
            f"select {CONVERSATION_LIST_FIELDS} from conversations where user_id = %s order by updated_at desc", (user_id,)
        )

    def get_conversation(self, user_id: str, conversation_id: str) -> dict | None:
        return self._one(f"select {CONVERSATION_FIELDS} from conversations where user_id = %s and id = %s", (user_id, conversation_id))

    def count_conversations(self, user_id: str) -> int:
        return self._one("select count(*) as n from conversations where user_id = %s", (user_id,))["n"]

    def create_conversation(self, user_id: str, data: dict) -> dict:
        return self._one(
            "insert into conversations (user_id, room_id, title, setup, messages, result, safety_flagged) "
            f"values (%s, %s, %s, %s, %s, %s, %s) returning {CONVERSATION_LIST_FIELDS}",
            (user_id, data["room_id"], data["title"], Jsonb(data["setup"]), Jsonb(data["messages"]), Jsonb(data["result"]), data["safety_flagged"]),
        )

    def update_conversation(self, user_id: str, conversation_id: str, changes: dict) -> dict | None:
        allowed = {k: v for k, v in changes.items() if k in {"title", "setup", "messages", "result", "safety_flagged"}}
        if not allowed:
            return self.get_conversation(user_id, conversation_id)
        values = [Jsonb(v) if k in {"setup", "messages", "result"} else v for k, v in allowed.items()]
        sets = ", ".join(f"{k} = %s" for k in allowed)  # keys from the allow-list above
        return self._one(
            f"update conversations set {sets} where user_id = %s and id = %s returning {CONVERSATION_LIST_FIELDS}",
            (*values, user_id, conversation_id),
        )

    def delete_conversation(self, user_id: str, conversation_id: str) -> bool:
        return self._one("delete from conversations where user_id = %s and id = %s returning id", (user_id, conversation_id)) is not None

    # --- the whole account ---------------------------------------------------------------
    def export(self, user_id: str) -> dict:
        return {
            "profile": self.get_profile(user_id),
            "custom_personas": self.list_personas(user_id),
            "conversations": self._all(f"select {CONVERSATION_FIELDS} from conversations where user_id = %s order by created_at", (user_id,)),
        }

    def delete_user_data(self, user_id: str) -> None:
        """Every row of ours for this user (the Supabase auth user itself is deleted in the dashboard)."""
        with db.pool().connection() as conn, conn.transaction():
            for table in ("conversations", "custom_personas", "profiles"):  # fixed names, not input
                conn.execute(f"delete from {table} where user_id = %s", (user_id,))
