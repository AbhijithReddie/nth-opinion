"""
AI Debate Arena - LangGraph core.

The debate is modelled as a small state machine:

    START -> pro -> con -> (another round?) --yes--> pro
                                            --no---> judge -> END

* pro   : argues FOR the topic (and answers Con's last point in later rounds)
* con   : argues AGAINST the topic and rebuts Pro's most recent argument
* judge : reads the full transcript and returns structured scores + a memo

With trace=True ("Behind the scenes"), each node also reports node_start
(with the round) and node_end events (see agent_trace.py).
"""

import logging
import operator
from typing import Annotated, Literal, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field

from agent_trace import traced
from languages import style as language_style
from llm import ModelBusyError, content_text, invoke, timed

logger = logging.getLogger("debate-arena.graph")

__all__ = ["ModelBusyError", "graph", "initial_state"]

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
    trace: bool  # send "Behind the scenes" trace events
    language: str  # a languages.py id; arguments stay clear and well-reasoned in any language


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


async def _speak(system_prompt: str, user_prompt: str) -> str:
    # Debaters get some temperature for livelier arguments.
    response = await invoke(
        [SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)],
        temperature=0.8,
        run_name="debater",
    )
    return _enforce_word_limit(content_text(response.content))


# ---------------------------------------------------------------------------
# Nodes
# ---------------------------------------------------------------------------
def _language_rule(state: DebateState) -> str:
    """The debate's language, as a prompt line (nothing extra for plain English, as before)."""
    language = state.get("language", "english")
    if language == "english":
        return ""
    return (
        f" Language: {language_style(language)} Whatever the language, keep the argument clear, well-structured and "
        "well-reasoned. The motion may be written in a native script (e.g. from voice input); still write in Roman script."
    )


def _node_info(node: str, label: str, round_no: int | None = None) -> dict:
    """node_start data for the trace; debaters include the round they argue in."""
    if round_no is None:
        return {"node": node, "label": label}
    return {"node": node, "label": f"{label} (round {round_no})", "round": round_no}


@traced(lambda s: _node_info("pro", "Pro argues for", s.get("current_round", 0) + 1))
@timed("pro", logger)
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
    ) + _language_rule(state)
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


@traced(lambda s: _node_info("con", "Con argues against", s["current_round"]))
@timed("con", logger)
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
    ) + _language_rule(state)
    user = (
        f"Motion: {state['topic']}\nRound {round_no} of {state['max_rounds']}.\n\n"
        f"Debate so far:\n{_format_transcript(transcript)}\n\n"
        f"PRO's argument to rebut:\n{last_pro['text'] if last_pro else '(none)'}"
    )

    text = await _speak(system, user)
    return {"transcript": [{"speaker": "con", "round": round_no, "text": text}]}


@traced(lambda s: _node_info("judge", "Judge scores the debate"))
@timed("judge", logger)
async def judge_node(state: DebateState) -> dict:
    """The JUDGE scores both sides and writes a balanced decision memo."""
    system = (
        "You are an impartial debate judge. Evaluate only the arguments made in the "
        "transcript, not your own views on the motion. Score each side from 1 to 10 on "
        "logic, evidence and rebuttal, pick a winner, and write a balanced decision memo."
    ) + _language_rule(state)
    user = f"Motion: {state['topic']}\n\nTranscript:\n{_format_transcript(state['transcript'])}"

    # The judge is kept deterministic and bound to the Verdict schema so it always returns valid JSON.
    verdict: Verdict = await invoke(
        [SystemMessage(content=system), HumanMessage(content=user)],
        temperature=0,
        schema=Verdict,
        run_name="judge",
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


def initial_state(topic: str, max_rounds: int, trace: bool = False, language: str = "english") -> DebateState:
    return {
        "trace": trace,
        "language": language,
        "topic": topic,
        "max_rounds": max_rounds,
        "current_round": 0,
        "transcript": [],
        "scores": {},
        "winner": "",
        "memo": "",
    }
