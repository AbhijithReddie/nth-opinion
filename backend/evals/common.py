"""
Shared plumbing for the evaluation suites.

* Meter: every LLM call (rooms, debates, documents, judge) goes through one
  wrapper that spaces calls out for rate limits, counts them, keeps the
  waiting out of the timings, and stops the run cleanly (StopRun) when the
  quota runs out or --max-calls is reached. The case that hit the limit is
  "skipped (quota)", not failed, and the suite is reported as incomplete.
* judge(): an LLM judge on JUDGE_MODEL (a different model from the one tested,
  where possible).
* run_turn() / run_debate(): the real engine, exactly as the API runs it.
  Turns are cached, so quick runs can share them between suites.
* run_cases(): runs a suite's cases as a LangSmith experiment on a synced
  dataset when LangSmith is configured, or locally otherwise, with the same
  evaluator functions either way.
* Results are merged into frontend/public/evals/latest.json for the
  "How we test" page.

Only synthetic cases from evals/datasets/ and the made-up documents in
backend/samples/ are used; no user data ever goes into an eval.
"""

import asyncio
import inspect
import json
import os
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Awaitable, Callable

from langchain_core.messages import HumanMessage, SystemMessage

import documents as docs
import graph as debate_graph
import llm
import persona_builder
import rooms.engine as engine
import rooms.safety as safety
from main import _debate_events
from rooms import get_room, stream_turn

BACKEND = Path(__file__).resolve().parent.parent
DATASETS = Path(__file__).resolve().parent / "datasets"
SAMPLES = BACKEND / "samples"
RESULTS_FILE = BACKEND.parent / "frontend" / "public" / "evals" / "latest.json"

# The judge: JUDGE_MODEL, else the fallback model, else (with a warning in the summary) the tested model itself.
JUDGE_MODEL = os.getenv("JUDGE_MODEL", "").strip() or llm.FALLBACK_MODEL_NAME or llm.MODEL_NAME
MODELS = {"tested": llm.MODEL_NAME, "director": llm.DIRECTOR_MODEL_NAME, "judge": JUDGE_MODEL}


def load_cases(suite: str) -> list[dict]:
    return json.loads((DATASETS / f"{suite}.json").read_text(encoding="utf-8"))["cases"]


def sample(name: str) -> str:
    return (SAMPLES / name).read_text(encoding="utf-8")


# ---------------------------------------------------------------------------
# Rate limits, call counts, clean timings, and stopping cleanly
# ---------------------------------------------------------------------------
class StopRun(llm.ModelBusyError):
    """No more AI calls this run: the quota ran out, or --max-calls was reached.

    A ModelBusyError, so the room engine passes it straight up instead of
    treating it as a bad decision.
    """

    def __init__(self, reason: str):
        super().__init__(f"Evaluation stopped: {reason}", "quota_exhausted")
        self.reason = reason


class Meter:
    """Wraps llm.invoke everywhere: waits `delay` seconds between calls, counts calls, tracks the
    waiting, and stops the run (StopRun) once the quota is out or `max_calls` calls have been made."""

    def __init__(self, delay: float, max_calls: int | None = None):
        self.delay = delay
        self.max_calls = max_calls
        self.calls = 0
        self.judge_calls = 0
        self.waited = 0.0
        self.stop_reason: str | None = None  # set once the run has to stop; every later call fails fast
        self.skipped = 0  # cases "skipped (quota)" so far
        self._last_end: float | None = None
        self._real = llm.invoke

    def now(self) -> float:
        """Seconds on a clock that stops while we wait for rate limits."""
        return time.perf_counter() - self.waited

    async def invoke(self, *args, **kwargs):
        if self.stop_reason:
            raise StopRun(self.stop_reason)
        if self.max_calls is not None and self.calls >= self.max_calls:
            self.stop_reason = f"--max-calls {self.max_calls} reached"
            raise StopRun(self.stop_reason)
        if self._last_end is not None:
            wait = self.delay - (time.perf_counter() - self._last_end)
            if wait > 0:
                await asyncio.sleep(wait)
                self.waited += wait
        self.calls += 1
        try:
            return await self._real(*args, **kwargs)
        except llm.ModelBusyError as exc:
            if exc.code == "quota_exhausted":
                # Every model in the chain is out of quota (or rate limited): stop instead of failing every case.
                self.stop_reason = "quota exhausted (429 RESOURCE_EXHAUSTED)"
                raise StopRun(self.stop_reason) from exc
            raise
        finally:
            self._last_end = time.perf_counter()

    def install(self) -> "Meter":
        for module in (debate_graph, engine, safety, docs, persona_builder):
            module.invoke = self.invoke
        return self


METER = Meter(delay=4.0)


async def judge(schema, system: str, prompt: str):
    """One structured-output call on the judge model (only that model: no falling back along the
    chain, so the judge never quietly becomes the model it is judging)."""
    result = await METER.invoke(
        [SystemMessage(content=system), HumanMessage(content=prompt)],
        temperature=0,
        schema=schema,
        model=JUDGE_MODEL,
        run_name="eval_judge",
        use_chain=False,
    )
    METER.judge_calls += 1
    return result


# ---------------------------------------------------------------------------
# Rooms and debates, run exactly as the API runs them
# ---------------------------------------------------------------------------
# A typical setup per room (members and context fields); cases can override the context.
SETUPS: dict[str, dict] = {
    "group-chat": {
        "participants": [{"id": "rohit", "name": "Rohit"}, {"id": "priya", "name": "Priya"}, {"id": "meera", "name": "Meera"}],
        "context": {},
    },
    "shark-tank": {
        "participants": [{"id": "kavya", "name": "Kavya"}, {"id": "aditya", "name": "Aditya"}, {"id": "rustom", "name": "Rustom"}],
        "context": {"startup": "ChaiCart", "ask": "₹25 lakh for 10%", "sector": "Electric chai carts outside metro stations"},
    },
    "interview-panel": {
        "participants": [{"id": "pooja", "name": "Pooja"}, {"id": "karthik", "name": "Karthik"}, {"id": "devraj", "name": "Devraj"}],
        "context": {"role": "Junior Data Analyst", "company": "a retail analytics company"},
        "resume_from_sample": True,
    },
    "roast-and-toast": {
        "participants": [{"id": "kabir", "name": "Kabir"}, {"id": "nandini", "name": "Nandini"}, {"id": "sameer", "name": "Sameer"}],
        "context": {"title": "My fresher resume", "goal": "Junior web developer roles"},
        "material_from_sample": True,
    },
    "future-you": {
        "participants": [{"id": "you30", "name": "You at 30"}, {"id": "you50", "name": "You at 50"}],
        "context": {"decision": "Should I take a job in another city or stay near my family?", "age": "22", "about": "Final-year student."},
    },
    "study-group": {
        "participants": [{"id": "bunty", "name": "Bunty"}, {"id": "ishaan", "name": "Ishaan"}, {"id": "tanvi", "name": "Tanvi"}],
        "context": {"topic": "How neural networks learn", "level": "B.Tech 2nd year"},
    },
}


def setup_for(room_id: str, context: dict | None = None) -> dict:
    base = SETUPS[room_id]
    ctx = {**base["context"], **(context or {})}
    if base.get("resume_from_sample"):
        ctx.setdefault("resume", sample("sample_resume.txt"))
    if base.get("material_from_sample"):
        ctx.setdefault("material", sample("sample_resume.txt"))
    return {"participants": base["participants"], "context": ctx}


@dataclass
class Turn:
    """One user message and everything the room did in reply."""

    room_id: str
    message: str
    events: list[tuple[str, dict]]
    duration_ms: float
    first_message_ms: float | None
    calls: int

    @property
    def messages(self) -> list[dict]:
        return [d for e, d in self.events if e == "message"]

    @property
    def safety_event(self) -> bool:
        return any(e == "safety" for e, _ in self.events)


_turn_cache: dict[str, Turn] = {}


async def run_turn(
    room_id: str,
    message: str,
    *,
    language: str = "english",
    context: dict | None = None,
    history: list[dict] | None = None,
    custom: list[dict] = (),
    documents: list[dict] = (),
    participants: list[dict] | None = None,
) -> Turn:
    """Run one room turn through the real engine (cached by its inputs, so suites can share turns)."""
    setup = setup_for(room_id, context)
    people = participants or setup["participants"]
    key = json.dumps([room_id, message, language, setup["context"], history or [], list(custom), list(documents), people], sort_keys=True)
    if key in _turn_cache:
        return _turn_cache[key]
    start, calls_before, first, events = METER.now(), METER.calls, None, []
    async for event, data in stream_turn(
        get_room(room_id),
        message=message,
        history=history or [],
        participants=people,
        language=language,
        context=setup["context"],
        custom=list(custom),
        documents=list(documents),
    ):
        events.append((event, data))
        if event == "message" and first is None:
            first = (METER.now() - start) * 1000
    turn = Turn(room_id, message, events, (METER.now() - start) * 1000, first, METER.calls - calls_before)
    _turn_cache[key] = turn
    return turn


def history_after(history: list[dict], turn: Turn, user_id: str) -> list[dict]:
    """The chat history after a turn: the user's message plus every reply."""
    return history + [{"id": user_id, "sender": "user", "text": turn.message}] + [
        {"id": m["id"], "sender": m["friend_id"], "text": m["text"], "reply_to": m.get("reply_to")} for m in turn.messages
    ]


@dataclass
class Debate:
    topic: str
    turns: list[dict]
    verdict: dict | None
    duration_ms: float
    first_token_ms: float | None
    calls: int


_debate_cache: dict[str, Debate] = {}


async def run_debate(topic: str, rounds: int = 1) -> Debate:
    """A debate through the real graph (cached by topic)."""
    if topic in _debate_cache:
        return _debate_cache[topic]
    start, calls_before, first, turns, verdict = METER.now(), METER.calls, None, [], None
    async for sse in _debate_events(topic, rounds):
        data = json.loads(sse["data"])
        if sse["event"] == "token" and first is None:
            first = (METER.now() - start) * 1000
        elif sse["event"] == "turn_end":
            turns.append(data)
        elif sse["event"] == "judge":
            verdict = data
        elif sse["event"] == "error":
            # The debate turns errors into an event; a stopped run must still stop.
            raise StopRun(METER.stop_reason) if METER.stop_reason else RuntimeError(data["message"])
    debate = Debate(topic, turns, verdict, (METER.now() - start) * 1000, first, METER.calls - calls_before)
    _debate_cache[topic] = debate
    return debate


def persona_description(room_id: str, persona_id: str) -> str:
    p = get_room(room_id).persona(persona_id)
    return f"{p.name}: {p.personality} Talks like: {p.speaking_style} Usual take: {p.stance}"


# ---------------------------------------------------------------------------
# Running cases: LangSmith experiments when configured, locally otherwise
# ---------------------------------------------------------------------------
# An evaluator: def name(inputs: dict, outputs: dict, reference_outputs: dict) -> {"key", "score", "comment"}.
# LangSmith matches its parameters BY NAME (inputs, outputs, reference_outputs, run, example, attachments),
# so no partials, lambdas or *args: tests/test_eval_evaluators.py checks every suite's EVALUATORS.
Evaluator = Callable[..., dict | Awaitable[dict]]


@dataclass
class Row:
    """One case: its inputs, what the system produced, and each evaluator's {"score", "comment"}."""

    case: dict
    outputs: dict | None
    results: dict[str, dict] = field(default_factory=dict)
    error: str | None = None

    def score(self, key: str) -> float | None:
        return self.results.get(key, {}).get("score")


def langsmith_client():
    """A LangSmith client if an API key is configured and works, else None (the suite then runs locally)."""
    key = os.getenv("LANGSMITH_API_KEY", "")
    if not key or key.startswith("your-") or os.getenv("EVALS_LANGSMITH", "true").lower() == "false":
        return None
    try:
        from langsmith import Client

        client = Client()
        next(iter(client.list_datasets(limit=1)), None)  # fails fast on a bad key or no network
        return client
    except Exception as exc:  # noqa: BLE001
        print(f"   (LangSmith unavailable: {type(exc).__name__}; running locally)")
        return None


def sync_dataset(client, suite: str, cases: list[dict]):
    """Make sure every case is an example in the LangSmith dataset "nth-opinion-<suite>"; return those to run."""
    name = f"nth-opinion-{suite}"
    if client.has_dataset(dataset_name=name):
        dataset = client.read_dataset(dataset_name=name)
    else:
        dataset = client.create_dataset(name, description=f"Nth Opinion eval suite: {suite} (synced from backend/evals/datasets/)")
    existing = {(ex.metadata or {}).get("case_id") for ex in client.list_examples(dataset_id=dataset.id)}
    new = [c for c in cases if c["id"] not in existing]
    if new:
        client.create_examples(
            dataset_id=dataset.id,
            examples=[{"inputs": c["inputs"], "outputs": c.get("expected", {}), "metadata": {"case_id": c["id"]}} for c in new],
        )
    wanted = {c["id"] for c in cases}
    return [ex for ex in client.list_examples(dataset_id=dataset.id) if (ex.metadata or {}).get("case_id") in wanted]


async def _call(evaluator: Evaluator, inputs: dict, outputs: dict, expected: dict) -> dict:
    """Call an evaluator the way LangSmith does: by parameter name."""
    result = evaluator(inputs=inputs, outputs=outputs, reference_outputs=expected)
    return await result if inspect.isawaitable(result) else result


async def run_cases(suite: str, cases: list[dict], target: Callable[[dict], Awaitable[dict]], evaluators: list[Evaluator]) -> tuple[list[Row], str | None]:
    """Run each case's target, then every evaluator. Returns the rows and the LangSmith experiment name (if any)."""
    client = langsmith_client()
    if client is not None:
        from langsmith import aevaluate

        examples = sync_dataset(client, suite, cases)
        by_id = {c["id"]: c for c in cases}
        results = await aevaluate(
            target,
            data=examples,
            evaluators=evaluators,
            experiment_prefix=f"nth-opinion-{suite}",
            metadata={"suite": suite, **MODELS},
            max_concurrency=1,
            client=client,
        )
        rows = []
        async for r in results:
            case = by_id[(r["example"].metadata or {}).get("case_id")]
            if METER.stop_reason:
                # This case (or its judging) ran out of quota; later cases fail fast without any requests.
                skip(case)
                break
            run = r["run"]
            row = Row(case, run.outputs, error=run.error)
            for ev in r["evaluation_results"]["results"]:
                row.results[ev.key] = {"score": ev.score, "comment": ev.comment}
            rows.append(row)
        return rows, results.experiment_name

    rows = []
    for case in cases:
        try:
            outputs = await target(case["inputs"])
            row = Row(case, outputs)
            for evaluator in evaluators:
                result = await _call(evaluator, case["inputs"], outputs, case.get("expected", {}))
                row.results[result["key"]] = {"score": result.get("score"), "comment": result.get("comment")}
        except Exception as exc:  # noqa: BLE001  (a failing case is a result, not a crash)
            if METER.stop_reason:
                skip(case)
                break  # out of quota (or --max-calls): the rest of the suite can't run
            rows.append(Row(case, None, error=f"{type(exc).__name__}: {exc}"[:200]))
            continue
        rows.append(row)
    return rows, None


def skip(case: dict) -> None:
    """A case that hit the quota: "skipped (quota)", never counted as a failure."""
    METER.skipped += 1
    print(f"   {case['id']}: skipped (quota): {METER.stop_reason}")


# ---------------------------------------------------------------------------
# Results
# ---------------------------------------------------------------------------
def metric(label: str, value: float | None, fmt: str = "number", **extra) -> dict:
    """One number for the page. fmt: percent (0-1), score5, ms, number."""
    return {"label": label, "value": None if value is None else round(float(value), 4), "format": fmt, **extra}


def example(inputs: str, output: str, passed: bool, note: str = "") -> dict:
    clip = lambda t: (t[:400] + "…") if len(t) > 400 else t  # noqa: E731
    return {"input": clip(inputs), "output": clip(output), "verdict": "pass" if passed else "fail", "note": clip(note)}


def pick_examples(candidates: list[dict], n: int = 3) -> list[dict]:
    """A few examples for the page: failures first (they're the most useful), then passes."""
    fails = [c for c in candidates if c["verdict"] == "fail"]
    passes = [c for c in candidates if c["verdict"] == "pass"]
    return (fails[:1] + passes + fails[1:])[:n]


@dataclass
class SuiteResult:
    id: str
    headline: dict
    metrics: list[dict]
    sample_size: int
    passed: int
    failed: int
    examples: list[dict]
    experiment: str | None = None
    notes: list[str] = field(default_factory=list)

    def to_json(self, quick: bool, calls: int, models: dict[str, str]) -> dict[str, Any]:
        return {
            "headline": self.headline,
            "metrics": self.metrics,
            "sample_size": self.sample_size,
            "passed": self.passed,
            "failed": self.failed,
            "run_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "quick": quick,
            "llm_calls": calls,
            "models": models,
            "langsmith_experiment": self.experiment,
            "examples": self.examples,
            "notes": self.notes,
        }


def models_used(before: dict[str, int], judge_calls: int) -> dict[str, str]:
    """The models that actually answered since `before` (a copy of llm.USAGE): the chain may have
    moved past a model that ran out of quota."""
    used = {m: n - before.get(m, 0) for m, n in llm.USAGE.items() if n > before.get(m, 0)}
    if JUDGE_MODEL in used:
        used[JUDGE_MODEL] -= judge_calls  # the judge's own calls
    tested = ", ".join(m for m, n in used.items() if n > 0) or MODELS["tested"]
    return {"tested": tested, "director": MODELS["director"], "judge": JUDGE_MODEL}


def save_results(results: dict[str, dict]) -> None:
    """Merge suite results into latest.json, keeping suites that weren't run this time.

    Only complete suites are passed in: an incomplete one keeps its previous results.
    """
    data = {"updated_at": None, "suites": {}}
    if RESULTS_FILE.exists():
        data = json.loads(RESULTS_FILE.read_text(encoding="utf-8"))
    data["suites"].update(results)
    data["updated_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    RESULTS_FILE.parent.mkdir(parents=True, exist_ok=True)
    RESULTS_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
