"""
Shared LLM setup for Nth Opinion (Debate Arena + rooms).

Everything model-related lives here so every feature behaves the same way:

* which Gemini models to use: GEMINI_MODEL_CHAIN (models to try in order), or
  GEMINI_MODEL plus an optional GEMINI_FALLBACK_MODEL; DIRECTOR_MODEL for room directors
* quota memory: a model that hits its quota (429 / RESOURCE_EXHAUSTED) is skipped
  until its quota resets (midnight Pacific time for daily limits), so no requests
  are wasted on it; an overloaded model (503) is simply passed over for that call
* the lowest thinking level each model accepts, learned once per process
* a per-call timeout and a capped number of SDK retries
* ModelBusyError, whose message is safe to show to users and whose code says why
  ("quota_exhausted" or "model_unavailable"), so the frontend can offer the demo replay
* a `timed` decorator that logs how long each graph node takes
"""

import asyncio
import functools
import logging
import os
import re
import time
from collections import Counter
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_google_genai.chat_models import GoogleInvalidRequestError, GoogleRateLimitError

logger = logging.getLogger("nth_opinion.llm")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
# Load backend/.env regardless of the current working directory. This sets
# GOOGLE_API_KEY, GEMINI_MODEL and the LANGSMITH_* variables in os.environ.
# LangChain picks up GOOGLE_API_KEY and LangSmith tracing from the environment
# automatically, so the keys are never read into, or printed by, this code.
load_dotenv(Path(__file__).resolve().parent / ".env")

if not os.getenv("GOOGLE_API_KEY"):
    raise RuntimeError("GOOGLE_API_KEY is missing - add it to backend/.env")

def parse_chain(chain: str, main: str, fallback: str) -> list[str]:
    """The models to try, in order: GEMINI_MODEL_CHAIN if set, else GEMINI_MODEL then GEMINI_FALLBACK_MODEL."""
    models = [m.strip() for m in chain.split(",") if m.strip()] or [main.strip(), fallback.strip()]
    return list(dict.fromkeys(m for m in models if m))  # no blanks, no duplicates, order kept


MODEL_CHAIN = parse_chain(
    os.getenv("GEMINI_MODEL_CHAIN", ""), os.getenv("GEMINI_MODEL", "") or "gemini-3.8-flash", os.getenv("GEMINI_FALLBACK_MODEL", "")
)
MODEL_NAME = MODEL_CHAIN[0]
# Model for room directors (who speaks next). Defaults to the main model; falls back along the chain.
DIRECTOR_MODEL_NAME = os.getenv("DIRECTOR_MODEL", "").strip() or MODEL_NAME
# The second model in the chain (kept for code that wants "a different model", e.g. the eval judge).
FALLBACK_MODEL_NAME = MODEL_CHAIN[1] if len(MODEL_CHAIN) > 1 else None

# Gemini's daily quotas reset at midnight Pacific time.
QUOTA_TIMEZONE = ZoneInfo("America/Los_Angeles")
# Successful calls per model in this process (the eval runner reports which models actually answered).
USAGE: Counter = Counter()

CALL_TIMEOUT_SECONDS = 90  # per LLM call, including the SDK's own retries
# Attempts per call, including the first. The SDK default (6, with exponential
# backoff) can spend minutes retrying a 503 before giving up.
MAX_ATTEMPTS = 3
THINKING_LEVELS = ("minimal", "low", "medium", "high")  # lowest first

BUSY_MESSAGE = "The AI model is busy right now, please try again in a minute."
QUOTA_MESSAGE = "The AI has used up its free quota for now. Please try again a little later."


class ModelBusyError(Exception):
    """The model timed out, stayed overloaded or ran out of quota. str() is safe to show to users.

    `code` is sent to the frontend with the error: "quota_exhausted" (429 / RESOURCE_EXHAUSTED)
    or "model_unavailable" (anything else).
    """

    def __init__(self, message: str = BUSY_MESSAGE, code: str = "model_unavailable"):
        super().__init__(message)
        self.code = code


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
def _thinking_levels_to_try(model_name: str, profile: dict) -> list[str | None]:
    """Thinking levels to try for a model, best first. None means the model's default.

    Replies are short, so we want the lowest level the model accepts.
    langchain-google-genai's model profile lists the supported levels for many
    models; when it doesn't, we try the lowest levels and step down if the API
    rejects them (see _Gemini.reject_thinking_level).
    """
    if model_name.startswith("gemini-2"):
        return [None]  # Gemini 2.x uses thinking_budget, not levels; leave it alone
    levels = [lvl for lvl in profile.get("reasoning_effort_levels") or [] if lvl in THINKING_LEVELS]
    if levels:
        return [min(levels, key=THINKING_LEVELS.index), None]
    if profile.get("reasoning_output"):
        return ["minimal", "low", None]  # a thinking model, but its levels are unknown
    return [None]  # not a thinking model


class _Gemini:
    """One Gemini model, built at the lowest thinking level it accepts.

    Clients are cached per (temperature, output schema, thinking level), so each
    distinct configuration is only built once.
    """

    def __init__(self, name: str):
        self.name = name
        self._levels = _thinking_levels_to_try(name, ChatGoogleGenerativeAI(model=name).profile or {})
        self._llms: dict[tuple, object] = {}

    @property
    def thinking_level(self) -> str | None:
        return self._levels[0]

    def llm(self, temperature: float, schema: type | None):
        """A chat model, or one bound to `schema` so it always returns that Pydantic object."""
        key = (temperature, schema, self.thinking_level)
        if key not in self._llms:
            kwargs = {"model": self.name, "max_retries": MAX_ATTEMPTS, "temperature": temperature}
            if self.thinking_level:
                kwargs["thinking_level"] = self.thinking_level
            llm = ChatGoogleGenerativeAI(**kwargs)
            self._llms[key] = llm.with_structured_output(schema) if schema else llm
        return self._llms[key]

    def reject_thinking_level(self, rejected: str | None) -> bool:
        """The API refused `rejected`: move on to the next level, once, and remember it for this process.

        Only steps down if `rejected` is still the current level, so calls that failed
        at the same time don't skip past the level that works. False if none are left.
        """
        if self._levels[0] != rejected:
            return True  # another call already stepped down: just retry with the current level
        if len(self._levels) == 1:
            return False
        self._levels.pop(0)
        logger.warning("%s rejected thinking_level=%r; using %r from now on", self.name, rejected, self.thinking_level)
        return True


_models: dict[str, _Gemini] = {}


def _model(name: str) -> _Gemini:
    """One shared _Gemini per model name, so a learned thinking level is reused everywhere."""
    if name not in _models:
        _models[name] = _Gemini(name)
        logger.info("Model %s ready (thinking_level=%s)", name, _models[name].thinking_level or "model default")
    return _models[name]


# Build the configured models at import time so a bad model name fails fast.
_model(MODEL_NAME)
_model(DIRECTOR_MODEL_NAME)
logger.info("Model chain %s, director model %s", " -> ".join(MODEL_CHAIN), DIRECTOR_MODEL_NAME)


# ---------------------------------------------------------------------------
# Quota memory: skip a model until its quota resets
# ---------------------------------------------------------------------------
_exhausted_until: dict[str, datetime] = {}


def _now() -> datetime:
    return datetime.now(QUOTA_TIMEZONE)


def next_quota_reset(now: datetime | None = None) -> datetime:
    """The next midnight, Pacific time (when Gemini's daily quotas reset)."""
    now = (now or _now()).astimezone(QUOTA_TIMEZONE)
    tomorrow = (now + timedelta(days=1)).date()
    return datetime(tomorrow.year, tomorrow.month, tomorrow.day, tzinfo=QUOTA_TIMEZONE)


def _retry_delay_seconds(text: str) -> float | None:
    """The retry delay Gemini suggests, e.g. "'retryDelay': '597s'" or "Please retry in 9m57.36s"."""
    if m := re.search(r"retryDelay['\"]?\s*:\s*['\"]?(\d+(?:\.\d+)?)s", text):
        return float(m.group(1))
    if m := re.search(r"retry in (?:(\d+)h)?\s*(?:(\d+)m)?\s*(\d+(?:\.\d+)?)s", text):
        h, mins, secs = m.groups()
        return int(h or 0) * 3600 + int(mins or 0) * 60 + float(secs)
    return None


def quota_cooldown_until(exc: Exception, now: datetime | None = None) -> datetime:
    """How long to leave a model alone after a 429.

    A daily quota (quotaId "...PerDay...") lasts until the next midnight Pacific
    time. A per-minute rate limit only needs the retry delay Gemini suggests
    (or a minute if it doesn't say).
    """
    now = now or _now()
    text = str(exc)
    if "PerDay" in text or "per day" in text.lower():
        return next_quota_reset(now)
    return now + timedelta(seconds=_retry_delay_seconds(text) or 60)


def is_exhausted(model: str, now: datetime | None = None) -> bool:
    until = _exhausted_until.get(model)
    if until is None:
        return False
    if (now or _now()) >= until:
        del _exhausted_until[model]  # the quota has reset
        return False
    return True


def mark_exhausted(model: str, exc: Exception) -> None:
    until = quota_cooldown_until(exc)
    _exhausted_until[model] = until
    logger.warning("%s is out of quota; skipping it until %s", model, until.strftime("%Y-%m-%d %H:%M %Z"))


def exhausted_models() -> dict[str, datetime]:
    """Models currently being skipped, and until when."""
    return {m: t for m, t in _exhausted_until.items() if is_exhausted(m)}


def _is_quota(exc: Exception) -> bool:
    """True when the quota or rate limit is used up (429 / RESOURCE_EXHAUSTED)."""
    return (
        isinstance(exc, GoogleRateLimitError)
        or getattr(exc, "code", None) == 429
        or "RESOURCE_EXHAUSTED" in str(exc)
    )


def _is_overloaded(exc: Exception) -> bool:
    """True for 503 (model overloaded) and 429 (rate limited) errors."""
    return _is_quota(exc) or getattr(exc, "code", None) == 503


def _busy_error(exc: Exception) -> ModelBusyError:
    """The user-facing error for an overloaded model: quota exhausted, or just unavailable."""
    return ModelBusyError(QUOTA_MESSAGE, "quota_exhausted") if _is_quota(exc) else ModelBusyError()


async def _invoke_model(model: _Gemini, messages: list, temperature: float, schema: type | None, config: dict):
    """Call one model with the per-call timeout, stepping down the thinking level if it is rejected."""
    while True:
        level = model.thinking_level
        try:
            return await asyncio.wait_for(
                model.llm(temperature, schema).ainvoke(messages, config=config), CALL_TIMEOUT_SECONDS
            )
        except TimeoutError as exc:
            logger.warning("%s timed out after %ds", model.name, CALL_TIMEOUT_SECONDS)
            raise ModelBusyError() from exc
        except GoogleInvalidRequestError as exc:
            if "thinking" in str(exc).lower() and model.reject_thinking_level(level):
                continue
            raise


def candidates(model: str, use_chain: bool = True) -> list[str]:
    """The models to try for a call: `model`, then the rest of the chain, minus any out of quota."""
    order = [model, *MODEL_CHAIN] if use_chain else [model]
    return [m for m in dict.fromkeys(order) if not is_exhausted(m)]


async def invoke(
    messages: list,
    *,
    temperature: float,
    schema: type | None = None,
    model: str = MODEL_NAME,
    run_name: str | None = None,
    use_chain: bool = True,
):
    """Call `model`, moving down the model chain while models are overloaded or out of quota.

    Models out of quota are remembered and skipped (no request is sent) until their
    quota resets. `use_chain=False` tries only `model` (e.g. an eval judge that must
    stay a different model). Returns an AIMessage, or an instance of `schema` when
    one is given. `run_name` labels the call in LangSmith traces. Raises
    ModelBusyError on timeouts, when every model is out of quota or overloaded;
    other errors propagate unchanged.
    """
    config = {"run_name": run_name} if run_name else {}
    names = candidates(model, use_chain)
    if not names:
        raise ModelBusyError(QUOTA_MESSAGE, "quota_exhausted")  # everything is out of quota: don't send anything
    last: Exception | None = None
    for i, name in enumerate(names):
        try:
            result = await _invoke_model(_model(name), messages, temperature, schema, config)
            USAGE[name] += 1
            return result
        except ModelBusyError:
            raise  # a timeout: the next model would likely be just as slow
        except Exception as exc:
            if not _is_overloaded(exc):
                raise
            last = exc
            if _is_quota(exc):
                mark_exhausted(name, exc)
            nxt = names[i + 1] if i + 1 < len(names) else None
            logger.warning("%s %s%s", name, "out of quota" if _is_quota(exc) else "overloaded", f"; trying {nxt}" if nxt else "")
    raise _busy_error(last) from last


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def content_text(content) -> str:
    """Gemini may return a plain string or a list of content parts."""
    if isinstance(content, str):
        return content
    return "".join(
        part.get("text", "") if isinstance(part, dict) else str(part) for part in content
    )


def timed(name: str, log: logging.Logger = logger):
    """Log how long a graph node takes, so slow model calls are easy to spot in the logs."""

    def decorator(node):
        @functools.wraps(node)
        async def wrapper(state) -> dict:
            start = time.perf_counter()
            outcome = "failed"
            try:
                result = await node(state)
                outcome = "finished"
                return result
            finally:
                log.info("Node %s %s in %.1fs", name, outcome, time.perf_counter() - start)

        return wrapper

    return decorator
