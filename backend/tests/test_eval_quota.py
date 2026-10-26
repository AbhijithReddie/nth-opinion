"""Eval quota handling (no real AI calls): skipped (quota) cases, incomplete suites, --max-calls,
and incomplete results never overwriting saved ones."""

import asyncio
import json

import pytest

import llm
import rooms.engine as engine
from evals import common, run
from evals.common import Meter, StopRun, SuiteResult, metric
from tests.conftest import room_body

QUOTA = llm.ModelBusyError(llm.QUOTA_MESSAGE, "quota_exhausted")


@pytest.fixture
def meter(monkeypatch):
    """A fresh Meter whose "model" fails with a quota error on the calls listed in `fail_on` (1-based)."""
    m = Meter(delay=0)
    m.fail_on: set[int] = set()
    m.real_calls = 0

    async def fake(*args, **kwargs):
        m.real_calls += 1
        if m.real_calls in m.fail_on:
            raise QUOTA
        return "ok"

    m._real = fake
    monkeypatch.setattr(common, "METER", m)
    monkeypatch.setattr(run, "METER", m)
    monkeypatch.setattr(common, "langsmith_client", lambda: None)  # run locally
    return m


def cases(n: int) -> list[dict]:
    return [{"id": f"case-{i}", "inputs": {"i": i}} for i in range(1, n + 1)]


async def target(inputs: dict) -> dict:
    return {"answer": await common.METER.invoke([], temperature=0)}


def scored(inputs: dict, outputs: dict, reference_outputs: dict) -> dict:
    return {"key": "ok", "score": 1.0, "comment": "fine"}


def test_stop_run_is_a_model_busy_error():
    # So the room engine passes it up instead of turning it into a fallback decision.
    assert issubclass(StopRun, llm.ModelBusyError)


def test_quota_mid_suite_skips_the_case_and_stops(meter):
    meter.fail_on = {2}
    rows, _ = asyncio.run(common.run_cases("demo", cases(4), target, [scored]))
    assert [r.case["id"] for r in rows] == ["case-1"]  # case-2 skipped (quota), 3 and 4 never ran
    assert all(r.error is None for r in rows)  # nothing was counted as a failure
    assert meter.skipped == 1
    assert meter.real_calls == 2
    assert "quota" in meter.stop_reason


def test_after_a_stop_nothing_reaches_the_model(meter):
    meter.fail_on = {1}
    with pytest.raises(StopRun):
        asyncio.run(meter.invoke([], temperature=0))
    with pytest.raises(StopRun):
        asyncio.run(meter.invoke([], temperature=0))
    assert meter.real_calls == 1


def test_max_calls_stops_cleanly(meter):
    meter.max_calls = 2
    rows, _ = asyncio.run(common.run_cases("demo", cases(5), target, [scored]))
    assert len(rows) == 2 and meter.real_calls == 2
    assert meter.skipped == 1 and meter.stop_reason == "--max-calls 2 reached"


def test_other_model_errors_still_fail_the_case(meter):
    async def flaky(inputs):
        raise llm.ModelBusyError()  # overloaded / timeout, not quota

    rows, _ = asyncio.run(common.run_cases("demo", cases(2), flaky, [scored]))
    assert len(rows) == 2 and all(r.error for r in rows)
    assert meter.stop_reason is None and meter.skipped == 0


def test_engine_does_not_swallow_a_stop(client, monkeypatch):
    async def stop(*args, **kwargs):
        raise StopRun("quota exhausted")

    async def safe(*args, **kwargs):
        return False

    monkeypatch.setattr(engine, "invoke", stop)
    monkeypatch.setattr(engine, "classify_message", safe)

    async def turn():
        async for _ in engine.stream_turn(engine.get_room("group-chat"), message="hi", history=[], participants=room_body()["friends"], language="english"):
            pass

    with pytest.raises(StopRun):  # not quietly turned into an "end the turn" decision
        asyncio.run(turn())


# --- the runner ---------------------------------------------------------------------
def suite(calls: int):
    """A fake suite module that makes `calls` AI calls."""

    class Module:
        @staticmethod
        async def run(quick: bool) -> SuiteResult:
            for _ in range(calls):
                await common.METER.invoke([], temperature=0)
            return SuiteResult(id="x", headline=metric("Score", 1.0, "percent"), metrics=[], sample_size=calls, passed=calls, failed=0, examples=[])

    return Module


def test_runner_keeps_only_complete_suites(meter, monkeypatch):
    meter.fail_on = {3}
    monkeypatch.setattr(run, "SUITES", {"first": suite(2), "second": suite(2), "third": suite(1)})
    results, status = asyncio.run(run.main_async(["first", "second", "third"], quick=True))
    assert list(results) == ["first"]
    assert status["first"] == "complete"
    assert status["second"].startswith("incomplete")
    assert status["third"].startswith("not run")
    assert meter.real_calls == 3


def test_saving_keeps_previous_results_for_incomplete_suites(tmp_path, monkeypatch):
    path = tmp_path / "latest.json"
    path.write_text(json.dumps({"updated_at": "2026-10-01T00:00:00+00:00", "suites": {"second": {"headline": "old, complete"}}}))
    monkeypatch.setattr(common, "RESULTS_FILE", path)
    common.save_results({"first": {"headline": "new"}})  # "second" was incomplete this time, so it isn't passed in
    saved = json.loads(path.read_text())
    assert saved["suites"] == {"second": {"headline": "old, complete"}, "first": {"headline": "new"}}
