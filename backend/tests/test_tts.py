"""Optional AI voices (tts.py, /api/tts): provider switch, cache, rate limit, errors. The Gemini call is mocked."""

import io
import wave

import pytest

import main
import rooms.engine as engine
import tts
from rooms import get_room
from tests.conftest import GROUP


@pytest.fixture
def gemini(monkeypatch):
    """TTS_PROVIDER=gemini with a fake model that returns a short beep of PCM and counts calls."""
    calls = []

    async def fake(prompt: str, voice: str) -> bytes:
        calls.append((prompt, voice))
        return b"\x00\x01" * 2400  # 0.1 s of 16-bit mono at 24 kHz

    monkeypatch.setattr(tts, "PROVIDER", "gemini")
    monkeypatch.setattr(tts, "_gemini_tts", fake)
    monkeypatch.setattr(tts, "CACHE", tts.AudioCache())
    main.tts_limiter._requests_by_ip.clear()
    return calls


def test_browser_provider_turns_the_endpoint_off(client, monkeypatch):
    monkeypatch.setattr(tts, "PROVIDER", "browser")
    assert client.get("/api/tts/status").json() == {"provider": "browser", "available": False}
    r = client.post("/api/tts", json={"text": "Hello", "persona_id": "rohit"})
    assert r.status_code == 404 and r.json()["code"] == "tts_disabled"


def test_audio_is_wav_and_cached(client, gemini):
    assert client.get("/api/tts/status").json()["available"] is True
    body = {"text": "Bro, just tell her.", "persona_id": "rohit", "language": "english"}
    first = client.post("/api/tts", json=body)
    assert first.status_code == 200 and first.headers["content-type"] == "audio/wav"
    with wave.open(io.BytesIO(first.content)) as w:
        assert (w.getnchannels(), w.getsampwidth(), w.getframerate()) == (1, 2, 24_000)
    second = client.post("/api/tts", json=body)
    assert second.headers["x-tts-cache"] == "hit" and second.content == first.content
    assert len(gemini) == 1  # the second request cost no quota


def test_mixed_languages_get_a_reading_hint(client, gemini):
    client.post("/api/tts", json={"text": "Machan, sema idea", "persona_id": "priya", "language": "tanglish"})
    prompt, voice = gemini[-1]
    assert "Tanglish" in prompt and prompt.endswith("Machan, sema idea") and voice == "Leda"


def test_voices_are_distinct_and_stable():
    group = [tts.voice_for(p["id"]) for p in GROUP]
    assert len(set(group)) == len(group)
    assert len({tts.voice_for(s) for s in ("pro", "con", "judge")}) == 3
    assert tts.voice_for("custom_abc123") == tts.voice_for("custom_abc123") in tts.FALLBACK_VOICES


def test_lru_cache_evicts_the_oldest():
    cache = tts.AudioCache(max_items=2)
    cache.put("a", b"1")
    cache.put("b", b"2")
    cache.get("a")  # a is now the most recent
    cache.put("c", b"3")
    assert cache.get("b") is None and cache.get("a") == b"1" and len(cache) == 2
    by_size = tts.AudioCache(max_bytes=5)
    by_size.put("x", b"123")
    by_size.put("y", b"456")
    assert by_size.get("x") is None and by_size.get("y") == b"456"


def test_quota_and_failures_let_the_browser_take_over(client, gemini, monkeypatch):
    async def quota(prompt, voice):
        raise Exception("429 RESOURCE_EXHAUSTED")

    monkeypatch.setattr(tts, "_gemini_tts", quota)
    r = client.post("/api/tts", json={"text": "Hi", "persona_id": "rohit"})
    assert r.status_code == 429 and r.json()["code"] == "quota_exhausted"

    async def broken(prompt, voice):
        raise ValueError("boom")

    monkeypatch.setattr(tts, "_gemini_tts", broken)
    r = client.post("/api/tts", json={"text": "Hi", "persona_id": "rohit"})
    assert r.status_code == 502 and r.json()["code"] == "tts_failed" and "boom" not in r.text


def test_rate_limit_60_per_hour(client, gemini):
    codes = [client.post("/api/tts", json={"text": f"Line {i}", "persona_id": "rohit"}).status_code for i in range(61)]
    assert codes[:60] == [200] * 60 and codes[60] == 429


def test_validation(client, gemini):
    assert client.post("/api/tts", json={"text": "", "persona_id": "rohit"}).status_code == 422
    assert client.post("/api/tts", json={"text": "x" * 1001, "persona_id": "rohit"}).status_code == 422
    assert client.post("/api/tts", json={"text": "Hi", "persona_id": "rohit", "language": "klingon"}).status_code == 422


def test_native_script_input_is_understood_but_replies_stay_roman(fake_llm, monkeypatch):
    import asyncio

    fake_llm.director_script = [engine.DirectorDecision(reason="r", action="speak", friend_id="rohit")]

    async def turn():
        async for _ in engine.stream_turn(get_room("group-chat"), message="నేను ఏం చేయాలి?", history=[], participants=GROUP, language="tenglish"):
            pass

    asyncio.run(turn())
    prompt = fake_llm.system_prompts("group-chat_rohit")[0]
    assert engine.NATIVE_INPUT_NOTE in prompt and "Roman script" in prompt
