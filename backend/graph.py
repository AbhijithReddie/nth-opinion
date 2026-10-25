"""
AI Debate Arena - LangGraph core.

The debate is modelled as a small state machine:

    START -> pro -> con -> (another round?) --yes--> pro
                                            --no---> judge -> END

* pro   : argues FOR the topic (and answers Con's last point in later rounds)
* con   : argues AGAINST the topic and rebuts Pro's most recent argument
* judge : reads the full transcript and returns structured scores + a memo
"""

import asyncio
import functools
import logging
import operator
import os
import time
from pathlib import Path
from typing import Annotated, Literal, TypedDict

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_google_genai.chat_models import GoogleInvalidRequestError, GoogleRateLimitError
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field

logger = logging.getLogger("debate-arena.graph")

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
# Optional second model, tried once when the main one is overloaded (503) or rate limited (429).
FALLBACK_MODEL_NAME = os.getenv("GEMINI_FALLBACK_MODEL", "").strip() or None
MAX_WORDS = 150

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
# State
# ---------------------------------------------------------------------------
class Turn(TypedDict):
    """One spoken argument in the debate."""

    speaker: Literal["pro", "con"]
    round: int
    text: str


class DebateState(TypedDict, total=False):
    """Shared state passed between every node in the graph.

    Each node returns only the keys it changes; LangGraph merges them in.
    `transcript` uses an `operator.add` reducer, so nodes return a list with
    just their new turn and LangGraph appends it instead of overwriting.
    """

    topic: str
    max_rounds: int
    current_round: int
    transcript: Annotated[list[Turn], operator.add]
    scores: dict
    winner: str
    memo: str


# ---------------------------------------------------------------------------
# Structured output schema for the judge
# ---------------------------------------------------------------------------
class SideScores(BaseModel):
    logic: int = Field(ge=1, le=10, description="Soundness and coherence of reasoning, 1-10")
    evidence: int = Field(ge=1, le=10, description="Use of facts, examples and data, 1-10")
    rebuttal: int = Field(ge=1, le=10, description="How well they answered the opponent, 1-10")


class Verdict(BaseModel):
    pro: SideScores = Field(description="Scores for the side arguing FOR the topic")
    con: SideScores = Field(description="Scores for the side arguing AGAINST the topic")
    winner: Literal["pro", "con", "tie"] = Field(description="Which side won the debate")
    memo: str = Field(
        description="A balanced 120-200 word decision memo: strongest points of each "
        "side, where each fell short, and why the winner was chosen"
    )


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
Role = Literal["debater", "judge"]


def _thinking_levels_to_try(model_name: str, profile: dict) -> list[str | None]:
    """Thinking levels to try for a model, best first. None means the model's default.

    The arguments are short, so we want the lowest level the model accepts.
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
    """One Gemini model, built for both roles at the lowest thinking level it accepts."""

    def __init__(self, name: str):
        self.name = name
        self._levels = _thinking_levels_to_try(name, ChatGoogleGenerativeAI(model=name).profile or {})
        self._llms: dict[tuple[Role, str | None], object] = {}

    @property
    def thinking_level(self) -> str | None:
        return self._levels[0]

    def llm(self, role: Role):
        """Debaters get some temperature for livelier arguments; the judge is kept
        deterministic and bound to the Verdict schema so it always returns valid JSON."""
        key = (role, self.thinking_level)
        if key not in self._llms:
            kwargs = {"model": self.name, "max_retries": MAX_ATTEMPTS}
            if self.thinking_level:
                kwargs["thinking_level"] = self.thinking_level
            if role == "debater":
                self._llms[key] = ChatGoogleGenerativeAI(temperature=0.8, **kwargs)
            else:
                self._llms[key] = ChatGoogleGenerativeAI(temperature=0, **kwargs).with_structured_output(Verdict)
        return self._llms[key]

    def reject_thinking_level(self) -> bool:
        """The API refused the current level: step to the next one. False if none are left."""
        if len(self._levels) == 1:
            return False
        rejected = self._levels.pop(0)
        logger.warning("%s rejected thinking_level=%r; using %r instead", self.name, rejected, self.thinking_level)
        return True


primary_model = _Gemini(MODEL_NAME)
fallback_model = _Gemini(FALLBACK_MODEL_NAME) if FALLBACK_MODEL_NAME not in (None, MODEL_NAME) else None
logger.info(
    "Model %s (thinking_level=%s), fallback %s",
    primary_model.name,
    primary_model.thinking_level or "model default",
    fallback_model.name if fallback_model else "none",
)


def _is_overloaded(exc: Exception) -> bool:
    """True for 503 (model overloaded) and 429 (rate limited) errors."""
    return isinstance(exc, GoogleRateLimitError) or getattr(exc, "code", None) in (429, 503)


async def _invoke_model(model: _Gemini, role: Role, messages: list):
    """Call one model with the per-call timeout, stepping down the thinking level if it is rejected."""
    while True:
        try:
            return await asyncio.wait_for(model.llm(role).ainvoke(messages), CALL_TIMEOUT_SECONDS)
        except TimeoutError as exc:
            logger.warning("%s timed out after %ds", model.name, CALL_TIMEOUT_SECONDS)
            raise ModelBusyError() from exc
        except GoogleInvalidRequestError as exc:
            if "thinking" in str(exc).lower() and model.reject_thinking_level():
                continue
            raise


async def _invoke(role: Role, messages: list):
    """Call the main model; if it is overloaded even after its retries, try the fallback once."""
    try:
        return await _invoke_model(primary_model, role, messages)
    except Exception as exc:
        if not _is_overloaded(exc):
            raise
        if fallback_model is None:
            raise ModelBusyError() from exc
        logger.warning("%s overloaded (%s); retrying once with %s", primary_model.name, exc, fallback_model.name)

    try:
        return await _invoke_model(fallback_model, role, messages)
    except Exception as exc:
        if _is_overloaded(exc):
            raise ModelBusyError() from exc
        raise


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _format_transcript(transcript: list[Turn]) -> str:
    if not transcript:
        return "(no arguments yet)"
    return "\n\n".join(
        f"[Round {t['round']}] {t['speaker'].upper()}: {t['text']}" for t in transcript
    )


def _last_turn_by(transcript: list[Turn], speaker: str) -> Turn | None:
    return next((t for t in reversed(transcript) if t["speaker"] == speaker), None)


def _enforce_word_limit(text: str, limit: int = MAX_WORDS) -> str:
    """Safety net in case the model ignores the word limit in the prompt."""
    words = text.split()
    if len(words) <= limit:
        return text.strip()
    return " ".join(words[:limit]).rstrip(",;:") + "..."


def _content_text(content) -> str:
    """Gemini may return a plain string or a list of content parts."""
    if isinstance(content, str):
        return content
    return "".join(
        part.get("text", "") if isinstance(part, dict) else str(part) for part in content
    )


async def _speak(system_prompt: str, user_prompt: str) -> str:
    response = await _invoke(
        "debater", [SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)]
    )
    return _enforce_word_limit(_content_text(response.content))


def _timed(name: str):
    """Log how long a node takes, so slow model calls are easy to spot in the logs."""

    def decorator(node):
        @functools.wraps(node)
        async def wrapper(state: DebateState) -> dict:
            start = time.perf_counter()
            outcome = "failed"
            try:
                result = await node(state)
                outcome = "finished"
                return result
            finally:
                logger.info("Node %s %s in %.1fs", name, outcome, time.perf_counter() - start)

        return wrapper

    return decorator


# ---------------------------------------------------------------------------
# Nodes
# ---------------------------------------------------------------------------
@_timed("pro")
async def pro_node(state: DebateState) -> dict:
    """PRO opens each round, arguing FOR the topic.

    This node also advances the round counter, since every round starts here.
    From round 2 onward it is shown Con's last argument so it can respond.
    """
    round_no = state.get("current_round", 0) + 1
    transcript = state.get("transcript", [])
    last_con = _last_turn_by(transcript, "con")

    system = (
        "You are PRO in a formal debate. Argue FOR the motion with clear logic and "
        "concrete evidence or examples. Be persuasive and specific. "
        f"Stay strictly under {MAX_WORDS} words. Plain prose, no headings or bullet lists."
    )
    user = f"Motion: {state['topic']}\nRound {round_no} of {state['max_rounds']}.\n\n"
    if last_con:
        user += (
            f"Debate so far:\n{_format_transcript(transcript)}\n\n"
            "Directly answer CON's latest argument, then strengthen your case."
        )
    else:
        user += "Give your opening argument."

    text = await _speak(system, user)
    return {
        "current_round": round_no,
        "transcript": [{"speaker": "pro", "round": round_no, "text": text}],
    }


@_timed("con")
async def con_node(state: DebateState) -> dict:
    """CON argues AGAINST the topic and rebuts PRO's most recent argument."""
    round_no = state["current_round"]
    transcript = state.get("transcript", [])
    last_pro = _last_turn_by(transcript, "pro")

    system = (
        "You are CON in a formal debate. Argue AGAINST the motion. Begin by rebutting "
        "PRO's most recent argument point by point, then add your own case with clear "
        "logic and concrete evidence or examples. "
        f"Stay strictly under {MAX_WORDS} words. Plain prose, no headings or bullet lists."
    )
    user = (
        f"Motion: {state['topic']}\nRound {round_no} of {state['max_rounds']}.\n\n"
        f"Debate so far:\n{_format_transcript(transcript)}\n\n"
        f"PRO's argument to rebut:\n{last_pro['text'] if last_pro else '(none)'}"
    )

    text = await _speak(system, user)
    return {"transcript": [{"speaker": "con", "round": round_no, "text": text}]}


@_timed("judge")
async def judge_node(state: DebateState) -> dict:
    """The JUDGE scores both sides and writes a balanced decision memo."""
    system = (
        "You are an impartial debate judge. Evaluate only the arguments made in the "
        "transcript, not your own views on the motion. Score each side from 1 to 10 on "
        "logic, evidence and rebuttal, pick a winner, and write a balanced decision memo."
    )
    user = f"Motion: {state['topic']}\n\nTranscript:\n{_format_transcript(state['transcript'])}"

    verdict: Verdict = await _invoke(
        "judge", [SystemMessage(content=system), HumanMessage(content=user)]
    )
    return {
        "scores": {"pro": verdict.pro.model_dump(), "con": verdict.con.model_dump()},
        "winner": verdict.winner,
        "memo": verdict.memo,
    }


# ---------------------------------------------------------------------------
# Routing
# ---------------------------------------------------------------------------
def after_con(state: DebateState) -> Literal["pro", "judge"]:
    """After CON speaks, loop back to PRO for another round or hand off to the judge."""
    return "pro" if state["current_round"] < state["max_rounds"] else "judge"


# ---------------------------------------------------------------------------
# Graph assembly
# ---------------------------------------------------------------------------
def build_graph():
    builder = StateGraph(DebateState)

    builder.add_node("pro", pro_node)
    builder.add_node("con", con_node)
    builder.add_node("judge", judge_node)

    builder.add_edge(START, "pro")  # every debate opens with PRO
    builder.add_edge("pro", "con")  # CON always replies to PRO
    builder.add_conditional_edges("con", after_con, ["pro", "judge"])  # loop or finish
    builder.add_edge("judge", END)

    return builder.compile()


graph = build_graph()


def initial_state(topic: str, max_rounds: int) -> DebateState:
    return {
        "topic": topic,
        "max_rounds": max_rounds,
        "current_round": 0,
        "transcript": [],
        "scores": {},
        "winner": "",
        "memo": "",
    }
