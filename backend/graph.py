"""
AI Debate Arena - LangGraph core.

The debate is modelled as a small state machine:

    START -> pro -> con -> (another round?) --yes--> pro
                                            --no---> judge -> END

* pro   : argues FOR the topic (and answers Con's last point in later rounds)
* con   : argues AGAINST the topic and rebuts Pro's most recent argument
* judge : reads the full transcript and returns structured scores + a memo
"""

import operator
import os
from pathlib import Path
from typing import Annotated, Literal, TypedDict

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field

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
MAX_WORDS = 150


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
# Debaters get some temperature for livelier arguments; the judge is kept
# deterministic and bound to the Verdict schema so it always returns valid JSON.
debater_llm = ChatGoogleGenerativeAI(model=MODEL_NAME, temperature=0.8)
judge_llm = ChatGoogleGenerativeAI(model=MODEL_NAME, temperature=0).with_structured_output(Verdict)


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


def _speak(system_prompt: str, user_prompt: str) -> str:
    response = debater_llm.invoke(
        [SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)]
    )
    return _enforce_word_limit(_content_text(response.content))


# ---------------------------------------------------------------------------
# Nodes
# ---------------------------------------------------------------------------
def pro_node(state: DebateState) -> dict:
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

    text = _speak(system, user)
    return {
        "current_round": round_no,
        "transcript": [{"speaker": "pro", "round": round_no, "text": text}],
    }


def con_node(state: DebateState) -> dict:
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

    text = _speak(system, user)
    return {"transcript": [{"speaker": "con", "round": round_no, "text": text}]}


def judge_node(state: DebateState) -> dict:
    """The JUDGE scores both sides and writes a balanced decision memo."""
    system = (
        "You are an impartial debate judge. Evaluate only the arguments made in the "
        "transcript, not your own views on the motion. Score each side from 1 to 10 on "
        "logic, evidence and rebuttal, pick a winner, and write a balanced decision memo."
    )
    user = f"Motion: {state['topic']}\n\nTranscript:\n{_format_transcript(state['transcript'])}"

    verdict: Verdict = judge_llm.invoke(
        [SystemMessage(content=system), HumanMessage(content=user)]
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
