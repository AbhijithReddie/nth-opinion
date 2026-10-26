"""Optional accounts: token verification, access control, limits and privacy. No network, no database."""

import time
import uuid
from datetime import datetime, timezone

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec

import accounts
import accounts_api
import auth
import main

URL = "https://demo-project.supabase.co"
ALICE, BOB = str(uuid.uuid4()), str(uuid.uuid4())

# --- tokens ---------------------------------------------------------------------------------
SIGNING_KEY = ec.generate_private_key(ec.SECP256R1())
OTHER_KEY = ec.generate_private_key(ec.SECP256R1())


class FakeJWKS:
    """Stands in for PyJWKClient: the project's public signing key, no network."""

    def get_signing_key_from_jwt(self, token):
        return type("Key", (), {"key": SIGNING_KEY.public_key()})()


def token(sub=ALICE, *, key=SIGNING_KEY, iss=f"{URL}/auth/v1", aud="authenticated", exp_in=3600, alg="ES256", **extra):
    claims = {"sub": sub, "iss": iss, "aud": aud, "exp": int(time.time()) + exp_in, "email": "a@example.com", **extra}
    return jwt.encode(claims, key, algorithm=alg, headers={"kid": "test"})


VERIFIER = auth.TokenVerifier(URL, jwks_client=FakeJWKS())


def test_valid_token():
    assert VERIFIER.verify(token()) == auth.User(id=ALICE, email="a@example.com")


@pytest.mark.parametrize(
    "bad",
    [
        token(exp_in=-120),  # expired (beyond the 30 s leeway)
        token(iss="https://evil.supabase.co/auth/v1"),  # wrong issuer
        token(aud="anon"),  # wrong audience
        token(key=OTHER_KEY),  # wrong signature
        token(sub="not-a-uuid"),
        jwt.encode({"sub": ALICE, "iss": f"{URL}/auth/v1", "aud": "authenticated", "exp": int(time.time()) + 60}, None, algorithm="none"),
        jwt.encode({"sub": ALICE, "iss": f"{URL}/auth/v1", "aud": "authenticated", "exp": int(time.time()) + 60}, "g" * 32, algorithm="HS256"),
        "not even a token",
    ],
)
def test_bad_tokens_are_rejected(bad):
    with pytest.raises(auth.AuthError):
        VERIFIER.verify(bad)


def test_expired_says_so():
    with pytest.raises(auth.AuthError, match="expired"):
        VERIFIER.verify(token(exp_in=-120))


def test_legacy_shared_secret():
    legacy = auth.TokenVerifier(URL, jwt_secret="s" * 32, jwks_client=FakeJWKS())
    good = token(key="s" * 32, alg="HS256")
    assert legacy.verify(good).id == ALICE
    with pytest.raises(auth.AuthError):
        legacy.verify(token(key="t" * 32, alg="HS256"))


def test_bearer_header():
    assert auth.bearer_token("Bearer abc") == "abc"
    assert auth.bearer_token("Basic abc") is None and auth.bearer_token(None) is None


# --- the API, with an in-memory store that keeps rows per user like the SQL does ------------------
class MemoryStore:
    def __init__(self):
        self.profiles, self.personas, self.conversations = {}, {}, {}

    def get_profile(self, uid):
        return self.profiles.setdefault(uid, {"user_id": uid, "display_name": None, "preferred_language": None, "memory_enabled": False})

    def update_profile(self, uid, changes):
        self.get_profile(uid).update(changes)
        return self.get_profile(uid)

    def list_personas(self, uid):
        return list(self.personas.get(uid, []))

    def replace_personas(self, uid, personas):
        self.personas[uid] = list(personas)
        return self.list_personas(uid)

    def delete_personas(self, uid):
        self.personas.pop(uid, None)

    def _mine(self, uid):
        return [c for c in self.conversations.values() if c["user_id"] == uid]

    def list_conversations(self, uid):
        return [{k: c[k] for k in ("id", "room_id", "title", "updated_at")} for c in self._mine(uid)]

    def get_conversation(self, uid, cid):
        c = self.conversations.get(cid)
        return c if c and c["user_id"] == uid else None

    def count_conversations(self, uid):
        return len(self._mine(uid))

    def create_conversation(self, uid, data):
        cid = str(uuid.uuid4())
        self.conversations[cid] = {**data, "id": cid, "user_id": uid, "updated_at": datetime.now(timezone.utc)}
        return self.conversations[cid]

    def update_conversation(self, uid, cid, changes):
        c = self.get_conversation(uid, cid)
        if c:
            c.update(changes)
        return c

    def delete_conversation(self, uid, cid):
        return self.conversations.pop(cid, None) is not None if self.get_conversation(uid, cid) else False

    def export(self, uid):
        return {"profile": self.get_profile(uid), "custom_personas": self.list_personas(uid), "conversations": self._mine(uid)}

    def delete_user_data(self, uid):
        self.profiles.pop(uid, None)
        self.personas.pop(uid, None)
        for c in self._mine(uid):
            del self.conversations[c["id"]]


@pytest.fixture
def store(monkeypatch):
    s = MemoryStore()
    monkeypatch.setattr(accounts_api, "STORE", s)
    monkeypatch.setattr(accounts_api, "get_verifier", lambda: VERIFIER)
    main.account_limiter._requests_by_ip.clear()
    return s


def as_user(uid):
    return {"Authorization": f"Bearer {token(uid)}"}


CONVERSATION = {
    "room_id": "group-chat",
    "title": "Goa trip",
    "setup": {
        "title": "Goa trip",
        "participants": [{"id": "rohit", "name": "Rohit"}],
        "language": "english",
        "documents": [{"kind": "resume", "digest": "secret resume digest"}],
        "uploaded": "dropped: not a setup field",
    },
    "messages": [{"kind": "message", "id": "m1", "sender": "user", "text": "Should I go?", "document": "x"}],
    "result": None,
    "safety_flagged": False,
}


def test_accounts_off_without_a_database(client, monkeypatch):
    monkeypatch.setattr(accounts_api, "STORE", None)
    assert client.get("/api/account/status").json() == {"enabled": False}
    r = client.get("/api/me", headers=as_user(ALICE))
    assert r.status_code == 503 and r.json()["code"] == "accounts_disabled"


def test_sign_in_required(client, store):
    assert client.get("/api/account/status").json() == {"enabled": True}
    r = client.get("/api/conversations")
    assert r.status_code == 401 and r.json()["code"] == "auth_required"
    r = client.get("/api/conversations", headers={"Authorization": f"Bearer {token(exp_in=-120)}"})
    assert r.status_code == 401 and r.json()["code"] == "session_expired"


def test_user_a_cannot_touch_user_b(client, store):
    cid = client.post("/api/conversations", json=CONVERSATION, headers=as_user(ALICE)).json()["id"]
    assert client.get(f"/api/conversations/{cid}", headers=as_user(ALICE)).status_code == 200
    assert client.get(f"/api/conversations/{cid}", headers=as_user(BOB)).status_code == 404
    assert client.put(f"/api/conversations/{cid}", json={"title": "mine now"}, headers=as_user(BOB)).status_code == 404
    assert client.delete(f"/api/conversations/{cid}", headers=as_user(BOB)).status_code == 404
    assert client.get("/api/conversations", headers=as_user(BOB)).json()["conversations"] == []
    assert store.conversations[cid]["title"] == "Goa trip"


def test_the_user_id_comes_only_from_the_token(client, store):
    body = {**CONVERSATION, "user_id": BOB}
    cid = client.post("/api/conversations", json=body, headers=as_user(ALICE)).json()["id"]
    assert store.conversations[cid]["user_id"] == ALICE


def test_documents_are_never_saved(client, store):
    cid = client.post("/api/conversations", json=CONVERSATION, headers=as_user(ALICE)).json()["id"]
    saved = store.conversations[cid]
    assert "documents" not in saved["setup"] and "uploaded" not in saved["setup"]
    assert "document" not in saved["messages"][0]
    assert "secret resume digest" not in str(saved)
    # Updates are cleaned too.
    client.put(f"/api/conversations/{cid}", json={"setup": {**CONVERSATION["setup"], "digests": ["x"]}}, headers=as_user(ALICE))
    assert "digests" not in store.conversations[cid]["setup"] and "documents" not in store.conversations[cid]["setup"]


def test_strip_private_at_any_depth():
    assert accounts.strip_private({"a": [{"digest": 1, "b": {"documents": 2, "c": 3}}]}) == {"a": [{"b": {"c": 3}}]}


def test_conversation_limits(client, store):
    too_many = {**CONVERSATION, "messages": [{"text": "hi"}] * 201}
    r = client.post("/api/conversations", json=too_many, headers=as_user(ALICE))
    assert r.status_code == 413 and "200 messages" in r.json()["detail"]
    too_big = {**CONVERSATION, "messages": [{"text": "x" * 2000}] * 120}  # ~240 KB
    assert client.post("/api/conversations", json=too_big, headers=as_user(ALICE)).status_code == 413
    for i in range(accounts.MAX_CONVERSATIONS):
        assert client.post("/api/conversations", json={**CONVERSATION, "title": f"#{i}"}, headers=as_user(ALICE)).status_code == 201
    full = client.post("/api/conversations", json=CONVERSATION, headers=as_user(ALICE))
    assert full.status_code == 409 and "Delete one" in full.json()["detail"]
    # Bob's quota is his own.
    assert client.post("/api/conversations", json=CONVERSATION, headers=as_user(BOB)).status_code == 201


def test_input_validation(client, store):
    assert client.post("/api/conversations", json={**CONVERSATION, "room_id": "nope"}, headers=as_user(ALICE)).status_code == 422
    assert client.post("/api/conversations", json={**CONVERSATION, "title": "x" * 121}, headers=as_user(ALICE)).status_code == 422
    assert client.get("/api/conversations/not-a-uuid", headers=as_user(ALICE)).status_code == 404
    r = client.patch("/api/me", json={"preferred_language": "klingon"}, headers=as_user(ALICE))
    assert r.status_code == 422 and "Language" in r.json()["detail"]


PERSONA = {
    "id": "custom_abcd1234",
    "name": "Papa",
    "emoji": "🧔",
    "colour": "#A0521D",
    "personality": "Strict but caring",
    "speaking_habits": "Short sentences",
    "typical_stance": "Safety first",
    "avatar": {"face": "oval", "skin": 3, "hair": "short", "hair_colour": "grey", "accessory": "glasses", "expression": "smile"},
}


def test_personas_sync(client, store):
    r = client.put("/api/personas", json={"personas": [PERSONA, PERSONA, {**PERSONA, "id": "custom_zzzz9999", "secret": 1}]}, headers=as_user(ALICE))
    assert [p["id"] for p in r.json()["personas"]] == ["custom_abcd1234", "custom_zzzz9999"]
    assert "secret" not in r.json()["personas"][1]
    assert client.get("/api/personas", headers=as_user(BOB)).json() == {"personas": []}
    too_many = [{**PERSONA, "id": f"custom_{i:04d}aaaa"} for i in range(13)]
    assert client.put("/api/personas", json={"personas": too_many}, headers=as_user(ALICE)).status_code == 422
    client.delete("/api/personas", headers=as_user(ALICE))
    assert client.get("/api/personas", headers=as_user(ALICE)).json() == {"personas": []}


def test_profile_export_and_delete(client, store):
    me = client.patch("/api/me", json={"display_name": "  Asha ", "preferred_language": "tanglish"}, headers=as_user(ALICE)).json()
    assert me["display_name"] == "Asha" and me["preferred_language"] == "tanglish" and me["memory_enabled"] is False
    client.post("/api/conversations", json=CONVERSATION, headers=as_user(ALICE))
    client.post("/api/conversations", json=CONVERSATION, headers=as_user(BOB))
    export = client.get("/api/me/export", headers=as_user(ALICE))
    assert "attachment" in export.headers["content-disposition"]
    assert len(export.json()["conversations"]) == 1 and export.json()["profile"]["display_name"] == "Asha"
    assert client.delete("/api/me", headers=as_user(ALICE)).json() == {"deleted": True, "sign_out": True}
    assert store.count_conversations(ALICE) == 0 and store.count_conversations(BOB) == 1


# --- every SQL statement is scoped to the user -----------------------------------------------
class RecordingConnection:
    def __init__(self, log):
        self.log = log

    def execute(self, sql, params=()):
        self.log.append((sql, params))
        row = {"n": 0, "data": {}, "user_id": ALICE, "id": "x"}
        return type("Cursor", (), {"fetchall": lambda s: [], "fetchone": lambda s: row})()

    def transaction(self):
        return self

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def test_every_query_filters_by_the_user(monkeypatch):
    log = []
    pool = type("Pool", (), {"connection": lambda s: RecordingConnection(log)})()
    monkeypatch.setattr(accounts.db, "pool", lambda: pool)
    s, cid = accounts.PostgresStore(), str(uuid.uuid4())
    s.get_profile(ALICE)
    s.update_profile(ALICE, {"display_name": "A", "user_id": BOB})  # user_id can't be changed
    s.list_personas(ALICE)
    s.replace_personas(ALICE, [PERSONA])
    s.delete_personas(ALICE)
    s.list_conversations(ALICE)
    s.get_conversation(ALICE, cid)
    s.count_conversations(ALICE)
    s.create_conversation(ALICE, {"room_id": "group-chat", "title": "t", "setup": {}, "messages": [], "result": None, "safety_flagged": False})
    s.update_conversation(ALICE, cid, {"title": "t", "user_id": BOB})
    s.delete_conversation(ALICE, cid)
    s.export(ALICE)
    s.delete_user_data(ALICE)
    assert log
    for sql, params in log:
        assert "user_id" in sql and ALICE in params, sql
        assert BOB not in params, sql
