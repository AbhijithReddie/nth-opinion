"""
Optional natural AI voices: POST /api/tts turns one message into speech.

TTS_PROVIDER picks the engine:
  * "browser" (default): this endpoint is off; the frontend uses the browser's
    own speechSynthesis voices.
  * "gemini": a TTS-capable Gemini model (TTS_MODEL) with the same GOOGLE_API_KEY,
    and a prebuilt voice per persona (VOICES below).

Generated audio is cached in memory (LRU, keyed by a hash of text + voice + model)
so replaying a message costs no quota. Message text is never logged.
Whenever this fails, the frontend quietly falls back to browser voices.
"""

import asyncio
import hashlib
import io
import logging
import os
import wave
from collections import OrderedDict

from languages import LANGUAGES

logger = logging.getLogger("nth_opinion.tts")

PROVIDER = (os.getenv("TTS_PROVIDER", "browser").strip().lower() or "browser")
MODEL = os.getenv("TTS_MODEL", "").strip() or "gemini-2.5-flash-preview-tts"
TIMEOUT_SECONDS = 30
SAMPLE_RATE = 24_000  # Gemini returns 16-bit mono PCM at 24 kHz
CACHE_MAX_ITEMS = 200
CACHE_MAX_BYTES = 40 * 1024 * 1024

# A distinct Gemini prebuilt voice per persona (the same ids as the rooms and the debate).
VOICES: dict[str, str] = {
    # The Group Chat
    "rohit": "Puck", "priya": "Leda", "vikram": "Charon", "ananya": "Zephyr", "arjun": "Fenrir", "meera": "Aoede",
    # Pitch Tank
    "kavya": "Kore", "aditya": "Orus", "rustom": "Iapetus",
    # Interview Panel
    "pooja": "Despina", "karthik": "Enceladus", "devraj": "Algieba",
    # Roast & Toast
    "kabir": "Umbriel", "nandini": "Erinome", "sameer": "Algenib",
    # Future You
    "you30": "Achird", "you50": "Schedar",
    # Study Group
    "bunty": "Sadachbia", "ishaan": "Rasalgethi", "tanvi": "Laomedeia",
    # Debate Arena
    "pro": "Puck", "con": "Kore", "judge": "Gacrux",
    # Safety and other system lines: calm and gentle
    "system": "Sulafat",
}
# For custom personas and guests: a stable pick from these, by id.
FALLBACK_VOICES = ["Zephyr", "Puck", "Kore", "Charon", "Leda", "Orus", "Aoede", "Fenrir"]


class TTSError(Exception):
    """Speech couldn't be made. `code` is "quota_exhausted" or "tts_failed"; str() is safe to show."""

    def __init__(self, message: str, code: str = "tts_failed"):
        super().__init__(message)
        self.code = code


def available() -> bool:
    return PROVIDER == "gemini"


def voice_for(persona_id: str) -> str:
    if persona_id in VOICES:
        return VOICES[persona_id]
    digest = int(hashlib.sha256(persona_id.encode()).hexdigest(), 16)
    return FALLBACK_VOICES[digest % len(FALLBACK_VOICES)]


def cache_key(text: str, voice: str) -> str:
    return hashlib.sha256(f"{MODEL}\n{voice}\n{text}".encode()).hexdigest()


class AudioCache:
    """A small LRU cache of generated audio, bounded by item count and total bytes."""

    def __init__(self, max_items: int = CACHE_MAX_ITEMS, max_bytes: int = CACHE_MAX_BYTES):
        self.max_items, self.max_bytes = max_items, max_bytes
        self._items: OrderedDict[str, bytes] = OrderedDict()
        self._bytes = 0

    def get(self, key: str) -> bytes | None:
        audio = self._items.get(key)
        if audio is not None:
            self._items.move_to_end(key)  # most recently used
        return audio

    def put(self, key: str, audio: bytes) -> None:
        if key in self._items:
            self._bytes -= len(self._items.pop(key))
        self._items[key] = audio
        self._bytes += len(audio)
        while self._items and (len(self._items) > self.max_items or self._bytes > self.max_bytes):
            _, old = self._items.popitem(last=False)  # least recently used
            self._bytes -= len(old)

    def __len__(self) -> int:
        return len(self._items)


CACHE = AudioCache()


def pcm_to_wav(pcm: bytes, sample_rate: int = SAMPLE_RATE) -> bytes:
    """Wrap raw 16-bit mono PCM in a WAV header, so browsers can play it."""
    out = io.BytesIO()
    with wave.open(out, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(pcm)
    return out.getvalue()


def _prompt(text: str, language: str) -> str:
    """Gemini TTS follows short style directions. Roman-script mixes get a hint so they aren't read as plain English."""
    if language == "english":
        return text
    return f"Read this {LANGUAGES[language].label} chat message aloud naturally, with an Indian accent: {text}"


_client = None


async def _gemini_tts(prompt: str, voice: str) -> bytes:
    """One Gemini TTS call; returns raw PCM."""
    global _client
    from google import genai
    from google.genai import types

    if _client is None:
        _client = genai.Client(api_key=os.environ["GOOGLE_API_KEY"])
    response = await _client.aio.models.generate_content(
        model=MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice))
            ),
        ),
    )
    return response.candidates[0].content.parts[0].inline_data.data


async def synthesize(text: str, persona_id: str, language: str) -> tuple[bytes, bool]:
    """(WAV audio, served from cache). Raises TTSError."""
    voice = voice_for(persona_id)
    key = cache_key(f"{language}\n{text}", voice)
    if (cached := CACHE.get(key)) is not None:
        return cached, True
    try:
        pcm = await asyncio.wait_for(_gemini_tts(_prompt(text, language), voice), TIMEOUT_SECONDS)
    except TimeoutError as exc:
        raise TTSError("The voice took too long.") from exc
    except Exception as exc:  # noqa: BLE001  (the frontend falls back to browser voices either way)
        from llm import _is_quota

        if _is_quota(exc):
            raise TTSError("The AI voice quota is used up for now.", "quota_exhausted") from exc
        logger.warning("TTS failed (%s, %d characters)", type(exc).__name__, len(text))
        raise TTSError("Couldn't make the AI voice.") from exc
    if not pcm:
        raise TTSError("The AI voice came back empty.")
    audio = pcm_to_wav(pcm)
    CACHE.put(key, audio)
    logger.info("TTS %s: %d characters -> %d bytes", voice, len(text), len(audio))
    return audio, False
