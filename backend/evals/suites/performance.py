"""Performance: time per turn, AI calls per turn, time to the first message (rooms)
and to the first streamed token (debates). Rate-limit waiting is excluded from
every timing (see Meter). Quick runs reuse turns other suites already ran.
"""

import statistics

from evals.common import SuiteResult, example, load_cases, metric, pick_examples, run_cases, run_debate, run_turn


async def target(inputs: dict) -> dict:
    if inputs["kind"] == "debate":
        d = await run_debate(inputs["topic"])
        return {"kind": "debate", "duration_ms": d.duration_ms, "first_ms": d.first_token_ms, "calls": d.calls}
    t = await run_turn(inputs["room"], inputs["message"])
    return {"kind": "room", "duration_ms": t.duration_ms, "first_ms": t.first_message_ms, "calls": t.calls, "messages": len(t.messages)}


def completed(inputs: dict, outputs: dict, reference_outputs: dict) -> dict:
    return {"key": "completed", "score": 1.0, "comment": f"{outputs['duration_ms'] / 1000:.1f}s, {outputs['calls']} AI calls"}


# Passed to LangSmith's evaluate(): plain functions whose parameters are named (inputs, outputs, reference_outputs).
EVALUATORS = [completed]


async def run(quick: bool) -> SuiteResult:
    cases = [c for c in load_cases("performance") if c.get("quick") or not quick]
    rows, experiment = await run_cases("performance", cases, target, EVALUATORS)

    rooms = [r.outputs for r in rows if r.outputs and r.outputs["kind"] == "room"]
    debates = [r.outputs for r in rows if r.outputs and r.outputs["kind"] == "debate"]
    median = lambda xs: statistics.median(xs) if xs else None  # noqa: E731
    candidates = [
        example(
            r.case["inputs"].get("message") or r.case["inputs"].get("topic"),
            f"{r.outputs['duration_ms'] / 1000:.1f}s total, first {'token' if r.outputs['kind'] == 'debate' else 'message'} after "
            f"{(r.outputs['first_ms'] or 0) / 1000:.1f}s, {r.outputs['calls']} AI calls",
            True,
        )
        for r in rows
        if r.outputs
    ]
    return SuiteResult(
        id="performance",
        headline=metric("Median time per room turn", median([o["duration_ms"] for o in rooms]), "ms"),
        metrics=[
            metric("AI calls per room turn", statistics.mean(o["calls"] for o in rooms) if rooms else None, "number"),
            metric("Median time to first message", median([o["first_ms"] for o in rooms if o["first_ms"] is not None]), "ms"),
            metric("Debate: time to first token", median([o["first_ms"] for o in debates if o["first_ms"] is not None]), "ms"),
            metric("Debate (1 round): total time", median([o["duration_ms"] for o in debates]), "ms"),
        ],
        sample_size=len(rooms) + len(debates),
        passed=sum(r.error is None for r in rows),
        failed=sum(r.error is not None for r in rows),
        examples=pick_examples(candidates),
        experiment=experiment,
        notes=["Timings exclude the pauses the eval runner adds between AI calls for rate limits."],
    )
