"""Language adherence for every mixed language in languages.py.

* Deterministic: every message must be in Roman script, with no Devanagari
  (Hindi, Marathi), Bengali, Tamil, Telugu, Kannada or Malayalam characters.
* Judge: does the mix sound like how people actually text (1-5)?
"""

import re

from pydantic import BaseModel, Field

from evals.common import SuiteResult, example, judge, load_cases, metric, pick_examples, run_cases, run_turn
from languages import LANGUAGES

# Native scripts that must never appear: Devanagari (Hindi, Marathi), Bengali, Tamil, Telugu, Kannada, Malayalam.
NATIVE_SCRIPTS = {
    "Devanagari": "ऀ-ॿ",
    "Bengali": "ঀ-৿",
    "Tamil": "஀-௿",
    "Telugu": "ఀ-౿",
    "Kannada": "ಀ-೿",
    "Malayalam": "ഀ-ൿ",
}
NATIVE_SCRIPT = re.compile("[" + "".join(NATIVE_SCRIPTS.values()) + "]")


class Naturalness(BaseModel):
    score: int = Field(description="1 = not this language mix at all, 5 = exactly how young people text in it")
    reason: str


async def target(inputs: dict) -> dict:
    turn = await run_turn(inputs["room"], inputs["message"], language=inputs["language"])
    return {"messages": [m["text"] for m in turn.messages]}


def roman_script(inputs: dict, outputs: dict, reference_outputs: dict) -> dict:
    bad = [t for t in outputs["messages"] if NATIVE_SCRIPT.search(t)]
    total = len(outputs["messages"])
    return {"key": "roman_script", "score": (total - len(bad)) / total if total else None, "comment": f"{len(bad)} of {total} messages used native script"}


async def natural_mix(inputs: dict, outputs: dict, reference_outputs: dict) -> dict:
    if not outputs["messages"]:
        return {"key": "natural_mix", "score": None, "comment": "no messages to judge"}
    r: Naturalness = await judge(
        Naturalness,
        f"You are a native speaker judging chat messages that should be written in {LANGUAGES[inputs['language']].label} "
        "(a mix with English), in Roman script.",
        "Messages:\n" + "\n".join(f"- {t}" for t in outputs["messages"]),
    )
    return {"key": "natural_mix", "score": max(1, min(5, r.score)), "comment": r.reason}


# Passed to LangSmith's evaluate(): plain functions whose parameters are named (inputs, outputs, reference_outputs).
EVALUATORS = [roman_script, natural_mix]


async def run(quick: bool) -> SuiteResult:
    cases = [c for c in load_cases("language_adherence") if c.get("quick") or not quick]
    rows, experiment = await run_cases("language_adherence", cases, target, EVALUATORS)

    done = [r for r in rows if r.outputs is not None]
    msgs = sum(len(r.outputs["messages"]) for r in done)
    roman_msgs = sum(round((r.score("roman_script") or 0) * len(r.outputs["messages"])) for r in done)
    mixes = [r.score("natural_mix") for r in done if r.score("natural_mix") is not None]
    passed = sum(r.score("roman_script") == 1.0 and (r.score("natural_mix") or 0) >= 4 for r in done)
    candidates = [
        example(
            f"[{r.case['inputs']['language']}, {r.case['inputs']['room']}] {r.case['inputs']['message']}",
            " | ".join(r.outputs["messages"][:2]),
            r.score("roman_script") == 1.0 and (r.score("natural_mix") or 0) >= 4,
            f"{r.results['roman_script']['comment']}; natural mix {r.score('natural_mix')}/5: {r.results.get('natural_mix', {}).get('comment') or ''}",
        )
        for r in done
    ]
    return SuiteResult(
        id="language_adherence",
        headline=metric("Messages in Roman script", roman_msgs / msgs if msgs else None, "percent"),
        metrics=[
            metric("Natural language mix (judge)", sum(mixes) / len(mixes) if mixes else None, "score5"),
            metric("Conversations passing both checks", passed / len(done) if done else None, "percent"),
        ],
        sample_size=msgs,
        passed=roman_msgs,
        failed=msgs - roman_msgs,
        examples=pick_examples(candidates),
        experiment=experiment,
    )
