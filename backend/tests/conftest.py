"""
Test setup: no API keys, no LLM calls, no tracing.

Environment variables are set before the app is imported (python-dotenv never
overrides existing variables), so a local backend/.env is never used by tests.
The `fake_llm` fixture replaces every LLM call with a scripted fake and records
the prompts it was given.
"""

import os
import sys
from pathlib import Path

import pytest

os.environ["GOOGLE_API_KEY"] = "test-key-not-used"
os.environ["LANGSMITH_TRACING"] = "false"
os.environ["LANGSMITH_API_KEY"] = ""
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient  # noqa: E402
from langchain_core.messages import AIMessage  # noqa: E402

import documents as docs  # noqa: E402
import graph as debate_graph  # noqa: E402
import main  # noqa: E402
import persona_builder  # noqa: E402
import rooms.engine as engine  # noqa: E402
import rooms.safety as safety  # noqa: E402


class FakeLLM:
    """Stands in for llm.invoke: answers by output schema, and keeps every prompt."""

    def __init__(self):
        self.prompts: list[tuple[str | None, str, str]] = []  # (run_name, system, human)
        self.director_script: list = []

    async def __call__(self, messages, *, temperature, schema=None, model=None, run_name=None):
        self.prompts.append((run_name, messages[0].content, messages[-1].content))
        if schema is safety.SafetyCheck:
            return schema(category="normal", reason="test")
        if schema is engine.DirectorDecision:
            return self.director_script.pop(0) if self.director_script else schema(reason="done", action="end")
        if schema is docs.Digest:
            return schema(digest="Skills: SQL and Python.", ai_instructions_found=False)
        if schema is debate_graph.Verdict:
            s = debate_graph.SideScores(logic=7, evidence=7, rebuttal=7)
            return schema(pro=s, con=s, winner="tie", memo="Even.")
        if schema is not None:
            raise AssertionError(f"FakeLLM has no answer for {schema}")
        return AIMessage(content="A short test reply.")

    def system_prompts(self, run_name: str) -> list[str]:
        return [system for name, system, _ in self.prompts if name == run_name]


@pytest.fixture
def fake_llm(monkeypatch) -> FakeLLM:
    fake = FakeLLM()
    for module in (engine, safety, debate_graph, docs, persona_builder):
        monkeypatch.setattr(module, "invoke", fake)
    return fake


@pytest.fixture
def client() -> TestClient:
    # Fresh rate limiters for every test, so earlier tests can't use up the limits.
    for limiter in (main.debate_limiter, main.room_message_limiter, main.summary_limiter, main.persona_limiter, main.document_limiter):
        limiter._requests_by_ip.clear()
    return TestClient(main.app)


GROUP = [{"id": "rohit", "name": "Rohit"}, {"id": "priya", "name": "Priya"}, {"id": "meera", "name": "Meera"}]


def room_body(**overrides) -> dict:
    """A valid Group Chat message request."""
    return {"message": "Should I learn guitar or keyboard?", "friends": GROUP, "language": "english", **overrides}
