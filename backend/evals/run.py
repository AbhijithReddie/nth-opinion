"""
Run the evaluation suites.

    python -m evals.run --suite all --quick     # every suite, a small subset (~30-40 AI calls)
    python -m evals.run --suite safety          # one suite, every case
    python -m evals.run --suite all --delay 8   # wait longer between AI calls (rate limits)
    python -m evals.run --suite all --max-calls 20   # stop cleanly after 20 AI calls

When the quota runs out (429 RESOURCE_EXHAUSTED on every model in the chain) or
--max-calls is reached, the case in progress is "skipped (quota)", the suite
is reported as incomplete, later suites aren't started, and nothing incomplete
is written: latest.json keeps the previous results for those suites.

Runs from backend/ with backend/.env loaded (GOOGLE_API_KEY, and LANGSMITH_API_KEY
to record datasets and experiments in LangSmith). Prints a summary table and
merges the results into frontend/public/evals/latest.json (the "How we test" page),
keeping suites that weren't run this time.
"""

import argparse
import asyncio
import logging
import sys
import time

import llm
from evals import common
from evals.common import JUDGE_MODEL, METER, MODELS, models_used, save_results
from evals.suites import SUITES


def fmt(m: dict) -> str:
    v = m["value"]
    if v is None:
        return "n/a"
    return {"percent": f"{v:.0%}", "score5": f"{v:.2f}/5", "ms": f"{v / 1000:.1f}s", "ratio": f"{v:.2f}"}.get(m["format"], f"{v:g}")


async def main_async(names: list[str], quick: bool) -> tuple[dict, dict]:
    """Run the suites. Returns (complete results, status per suite: complete / incomplete / failed / not run)."""
    results, status = {}, {}
    for name in names:
        if METER.stop_reason:
            status[name] = f"not run ({METER.stop_reason})"
            continue
        print(f"\n▶ {name}{' (quick)' if quick else ''}", flush=True)
        calls_before, judge_before, skipped_before = METER.calls, METER.judge_calls, METER.skipped
        usage_before, started = dict(llm.USAGE), time.perf_counter()
        try:
            result = await SUITES[name].run(quick)
        except Exception as exc:  # noqa: BLE001  (one broken suite shouldn't stop the others)
            status[name] = "incomplete" if METER.stop_reason else "failed"
            print(f"   {status[name]}: {type(exc).__name__}: {exc}")
            continue
        calls = METER.calls - calls_before
        if METER.stop_reason:
            # Stopped part-way: show what we have, but never save incomplete scores.
            status[name] = f"incomplete ({METER.skipped - skipped_before} skipped (quota): {METER.stop_reason})"
            print(f"   INCOMPLETE: {METER.stop_reason}. Not saved; the previous results for this suite are kept.")
        else:
            status[name] = "complete"
            results[name] = result.to_json(quick, calls, models_used(usage_before, METER.judge_calls - judge_before))
        print(f"   {result.headline['label']}: {fmt(result.headline)}  ({calls} AI calls, {time.perf_counter() - started:.0f}s)")
        for m in result.metrics:
            print(f"     {m['label']}: {fmt(m)}")
        if result.experiment:
            print(f"   LangSmith experiment: {result.experiment}")
    return results, status


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(description="Run Nth Opinion's evaluation suites.")
    parser.add_argument("--suite", default="all", choices=["all", *SUITES], help="Which suite to run (default: all)")
    parser.add_argument("--quick", action="store_true", help="A small subset of each suite")
    parser.add_argument("--delay", type=float, default=4.0, help="Seconds between AI calls (default 4)")
    parser.add_argument("--max-calls", type=int, default=None, help="Stop cleanly after this many AI calls")
    parser.add_argument("--no-save", action="store_true", help="Don't write frontend/public/evals/latest.json")
    args = parser.parse_args()

    logging.getLogger().setLevel(logging.WARNING)  # main.py sets up INFO logging on import
    METER.delay = args.delay
    METER.max_calls = args.max_calls
    METER.install()
    print(f"Models: chain {' -> '.join(llm.MODEL_CHAIN)} (director {MODELS['director']}), judge {JUDGE_MODEL}")
    if exhausted := llm.exhausted_models():
        print("Out of quota: " + ", ".join(f"{m} until {t:%H:%M %Z}" for m, t in exhausted.items()))
    if JUDGE_MODEL == MODELS["tested"]:
        print("Note: the judge is the same model as the one tested. Set JUDGE_MODEL (or GEMINI_FALLBACK_MODEL) to use another.")

    names = list(SUITES) if args.suite == "all" else [args.suite]
    results, status = asyncio.run(main_async(names, args.quick))

    print("\n" + "=" * 78)
    print(f"{'Suite':<22}{'Headline':<40}{'n':>5}{'pass':>6}{'fail':>6}")
    print("-" * 78)
    for name in names:
        r = results.get(name)
        if r is None:
            print(f"{name:<22}{status.get(name, 'failed')[:56]}")
            continue
        headline = f"{r['headline']['label'][:28]}: {fmt(r['headline'])}"
        print(f"{name:<22}{headline:<40}{r['sample_size']:>5}{r['passed']:>6}{r['failed']:>6}")
    print("=" * 78)
    print(f"Total AI calls: {METER.calls}" + (f"  (skipped (quota): {METER.skipped} case(s); stopped: {METER.stop_reason})" if METER.stop_reason else ""))

    if results and not args.no_save:
        save_results(results)  # complete suites only
        print(f"Saved {len(results)} complete suite(s) to {common.RESULTS_FILE}")
    sys.exit(0 if len(results) == len(names) else 1)


if __name__ == "__main__":
    main()
