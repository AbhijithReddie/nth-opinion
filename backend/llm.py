"""
Shared LLM setup for Nth Opinion (Debate Arena + rooms).

Everything model-related lives here so every feature behaves the same way:

* which Gemini model to use (GEMINI_MODEL, plus DIRECTOR_MODEL for room directors)
* the lowest thinking level each model accepts (short replies don't need deep thinking)
* a per-call timeout and a capped number of SDK retries
* one retry on GEMINI_FALLBACK_MODEL when the main model is overloaded or rate limited
* ModelBusyError, whose message is safe to show to users
* a `timed` decorator that logs how long each graph node takes
"""

import asyncio
import functools
import logging
import os
import time
from pathlib import Path

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

MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
# Model for room directors (who speaks next). Defaults to the main model.
DIRECTOR_MODEL_NAME = os.getenv("DIRECTOR_MODEL", "").strip() or MODEL_NAME
# Optional second model, tried once when the main one is overloaded (503) or rate limited (429).
FALLBACK_MODEL_NAME = os.getenv("GEMINI_FALLBACK_MODEL", "").strip() or None

CALL_TIMEOUT_SECONDS = 90  # per LLM call, including the SDK's own retries
# Attempts per call, including the first. The SDK default (6, with exponential
# backoff) can spend minutes retrying a 503 before giving up.
MAX_ATTEMPTS = 3
THINKING_LEVELS = ("minimal", "low", "medium", "high")  # lowest first

BUSY_MESSAGE = "The AI model is busy right now, please try again in a minute."


class ModelBusyError(Exception):
    """The model timed out or stayed overloaded. str() is safe to show to users."""

    def __init__(self, message: str = BUSY_MESSAGE):
        super().__init__(message)


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

    def reject_thinking_level(self) -> bool:
        """The API refused the current level: step to the next one. False if none are left."""
        if len(self._levels) == 1:
            return False
        rejected = self._levels.pop(0)
        logger.warning("%s rejected thinking_level=%r; using %r instead", self.name, rejected, self.thinking_level)
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
logger.info(
    "Main model %s, director model %s, fallback %s",
    MODEL_NAME,
    DIRECTOR_MODEL_NAME,
    FALLBACK_MODEL_NAME or "none",
)


def _is_overloaded(exc: Exception) -> bool:
    """True for 503 (model overloaded) and 429 (rate limited) errors."""
    return isinstance(exc, GoogleRateLimitError) or getattr(exc, "code", None) in (429, 503)


async def _invoke_model(model: _Gemini, messages: list, temperature: float, schema: type | None, config: dict):
    """Call one model with the per-call timeout, stepping down the thinking level if it is rejected."""
    while True:
        try:
            return await asyncio.wait_for(
                model.llm(temperature, schema).ainvoke(messages, config=config), CALL_TIMEOUT_SECONDS
            )
        except TimeoutError as exc:
            logger.warning("%s timed out after %ds", model.name, CALL_TIMEOUT_SECONDS)
            raise ModelBusyError() from exc
        except GoogleInvalidRequestError as exc:
            if "thinking" in str(exc).lower() and model.reject_thinking_level():
                continue
            raise


async def invoke(
    messages: list,
    *,
    temperature: float,
    schema: type | None = None,
    model: str = MODEL_NAME,
    run_name: str | None = None,
):
    """Call `model`; if it is overloaded even after its retries, try the fallback model once.

    Returns an AIMessage, or an instance of `schema` when one is given.
    `run_name` labels the call in LangSmith traces. Raises ModelBusyError on
    timeouts and persistent overload; other errors propagate unchanged.
    """
    config = {"run_name": run_name} if run_name else {}
    primary = _model(model)
    try:
        return await _invoke_model(primary, messages, temperature, schema, config)
    except Exception as exc:
        if not _is_overloaded(exc):
            raise
        if FALLBACK_MODEL_NAME in (None, model):
            raise ModelBusyError() from exc
        logger.warning("%s overloaded (%s); retrying once with %s", model, exc, FALLBACK_MODEL_NAME)

    try:
        return await _invoke_model(_model(FALLBACK_MODEL_NAME), messages, temperature, schema, config)
    except Exception as exc:
        if _is_overloaded(exc):
            raise ModelBusyError() from exc
        raise


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
