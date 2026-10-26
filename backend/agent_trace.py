"""
"Behind the scenes" trace events: what the agents are doing, for the frontend's panel.

They are only sent when a request asks for them ("behind_the_scenes": true),
which puts `trace: True` in the graph state; otherwise nothing here does
anything. Events carry node names, timings and plain-language decisions only:
never prompts, persona instructions, model output or error details.

    node_start         {"node", "label"}           (+ "round" in the Debate Arena)
    node_end           {"node", "duration_ms"}
    director_decision  {"action", "persona_id", "reply_to", "reason"}
    safety_check       {"mode": "normal" | "supportive"}
"""

import functools
import re
import time
from typing import Callable

from langgraph.config import get_stream_writer

REASON_MAX_WORDS = 20


def emit(state: dict, event: str, data: dict) -> None:
    """Send one trace event, if this request asked for them."""
    if state.get("trace"):
        get_stream_writer()((event, data))


def traced(describe: Callable[[dict], dict]):
    """Wrap a graph node with node_start / node_end events.

    `describe(state)` returns the node_start data: {"node", "label", ...}.
    Without tracing the node runs exactly as before.
    """

    def decorator(node):
        @functools.wraps(node)
        async def wrapper(state):
            if not state.get("trace"):
                return await node(state)
            info = describe(state)
            write = get_stream_writer()
            write(("node_start", info))
            started = time.perf_counter()
            result = await node(state)
            write(("node_end", {"node": info["node"], "duration_ms": round((time.perf_counter() - started) * 1000)}))
            return result

        return wrapper

    return decorator


def public_reason(text: str) -> str:
    """The director's reason, made safe to show: one short plain line, no internal message ids."""
    text = re.sub(r"\b[\w]+-[0-9a-f]{6,}\b", "a message", text or "")  # ids like "rohit-1a2b3c4d"
    words = text.split()
    short = " ".join(words[:REASON_MAX_WORDS])
    return short + ("…" if len(words) > REASON_MAX_WORDS else "")
