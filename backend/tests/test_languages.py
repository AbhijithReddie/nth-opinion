"""The shared language registry: the frontend's bundled copy, the API, and how rooms use it."""

import json
from pathlib import Path

import pytest

import languages
import rooms.engine as engine
from rooms import ROOMS
from tests.conftest import room_body

FRONTEND_COPY = Path(__file__).resolve().parents[2] / "frontend" / "src" / "config" / "languages.json"


def test_frontend_bundled_copy_matches_the_registry():
    # The frontend falls back to this file when /api/languages can't be reached: it must be identical.
    assert json.loads(FRONTEND_COPY.read_text(encoding="utf-8")) == languages.public_languages()


def test_api_lists_every_language(client):
    assert client.get("/api/languages").json() == {"languages": languages.public_languages()}
    ids = [lang["id"] for lang in languages.public_languages()]
    assert ids == ["english", "hinglish", "tenglish", "tanglish", "kanglish", "manglish", "marathi_english", "benglish"]


@pytest.mark.parametrize("language_id", [l for l in languages.LANGUAGES if l != "english"])
def test_mixed_languages_insist_on_roman_script(language_id):
    assert "Roman" in languages.style(language_id) and "never" in languages.style(language_id)


@pytest.mark.parametrize("room_id", list(ROOMS))
@pytest.mark.parametrize("language_id", list(languages.LANGUAGES))
def test_every_room_can_speak_every_language(room_id, language_id):
    instruction = engine.language_instruction(ROOMS[room_id], language_id)
    assert instruction.strip()


def test_rooms_keep_their_own_wording_for_existing_languages():
    room = ROOMS["shark-tank"]
    assert engine.language_instruction(room, "hinglish") == room.languages["hinglish"]
    assert "lakhs" in engine.language_instruction(room, "tanglish")  # registry style + the room's note


def test_new_language_accepted_and_unknown_rejected(client, fake_llm):
    assert client.post("/api/rooms/group-chat/message", json=room_body(language="tanglish")).status_code == 200
    assert client.post("/api/rooms/group-chat/message", json=room_body(language="klingon")).status_code == 422


def test_debate_uses_the_language(client, fake_llm):
    r = client.post("/api/debate", json={"topic": "Pineapple belongs on pizza", "rounds": 1, "language": "benglish"})
    assert r.status_code == 200
    debater_prompts = [s for name, s, _ in fake_llm.prompts if name == "debater"]
    assert debater_prompts and all("Benglish" in s and "well-reasoned" in s for s in debater_prompts)
    assert client.post("/api/debate", json={"topic": "Pineapple belongs on pizza", "rounds": 1, "language": "xx"}).status_code == 422


def test_english_debate_prompt_is_unchanged(client, fake_llm):
    client.post("/api/debate", json={"topic": "Pineapple belongs on pizza", "rounds": 1})
    assert all("Language:" not in s for name, s, _ in fake_llm.prompts if name == "debater")


def test_interview_report_stays_in_english():
    assert ROOMS["interview-panel"].summary_in_english
    english = engine.language_instruction(ROOMS["interview-panel"], "english")
    # summarize() asks for this, not the chat language.
    assert "Indian English" in english
