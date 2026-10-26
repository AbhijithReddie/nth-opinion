"""Debate judge bias.

Each topic is debated twice: as written, and with the motion negated. The same
position speaks first (as Pro) in one run and second (as Con) in the other, so
a judge without order bias should pick the same position both times. Also:
how often does the longer argument win (about 50% would be expected if length
doesn't matter)? Deterministic metrics, no extra judge.
"""

from evals.common import SuiteResult, example, load_cases, metric, pick_examples, run_cases, run_debate


async def target(inputs: dict) -> dict:
    original = await run_debate(inputs["topic"])
    negated = await run_debate(inputs["negated"])

    def words(debate, side):
        return sum(len(t["text"].split()) for t in debate.turns if t["speaker"] == side)

    def summary(debate):
        return {"winner": debate.verdict["winner"] if debate.verdict else None, "pro_words": words(debate, "pro"), "con_words": words(debate, "con")}

    return {"original": summary(original), "negated": summary(negated)}


def position_of_winner(result: dict, negated: bool) -> str | None:
    """The winning POSITION on the original motion: "for", "against" or "tie"."""
    winner = result["winner"]
    if winner in (None, "tie"):
        return winner
    side_for = "con" if negated else "pro"  # in the negated debate, Con argues for the original motion
    return "for" if winner == side_for else "against"


def consistent(inputs: dict, outputs: dict, reference_outputs: dict) -> dict:
    a, b = position_of_winner(outputs["original"], False), position_of_winner(outputs["negated"], True)
    return {"key": "consistent", "score": float(a == b and a is not None), "comment": f"original: {a}, swapped: {b}"}


def longer_won(inputs: dict, outputs: dict, reference_outputs: dict) -> dict:
    """Fraction of this topic's two debates (ignoring ties and equal lengths) won by the longer side."""
    decided = [d for d in outputs.values() if d["winner"] in ("pro", "con") and d["pro_words"] != d["con_words"]]
    if not decided:
        return {"key": "longer_won", "score": None, "comment": "no decided debates with different lengths"}
    wins = sum((d["pro_words"] > d["con_words"]) == (d["winner"] == "pro") for d in decided)
    return {"key": "longer_won", "score": wins / len(decided), "comment": f"{wins}/{len(decided)}"}


# Passed to LangSmith's evaluate(): plain functions whose parameters are named (inputs, outputs, reference_outputs).
EVALUATORS = [consistent, longer_won]


async def run(quick: bool) -> SuiteResult:
    cases = [c for c in load_cases("debate_judge_bias") if c.get("quick") or not quick]
    rows, experiment = await run_cases("debate_judge_bias", cases, target, EVALUATORS)

    done = [r for r in rows if r.outputs is not None]
    passed = sum(r.score("consistent") == 1.0 for r in done)
    longer = [r.score("longer_won") for r in done if r.score("longer_won") is not None]
    candidates = [
        example(
            f"{r.case['inputs']['topic']} / swapped: {r.case['inputs']['negated']}",
            f"Winners: {r.outputs['original']['winner']} then {r.outputs['negated']['winner']} "
            f"(words pro/con: {r.outputs['original']['pro_words']}/{r.outputs['original']['con_words']}, "
            f"{r.outputs['negated']['pro_words']}/{r.outputs['negated']['con_words']})",
            r.score("consistent") == 1.0,
            r.results["consistent"]["comment"],
        )
        for r in done
    ]
    return SuiteResult(
        id="debate_judge_bias",
        headline=metric("Same position wins after swapping sides", passed / len(done) if done else None, "percent"),
        metrics=[
            metric("Longer argument won", sum(longer) / len(longer) if longer else None, "percent", expected=0.5),
            metric("Debates run", len(done) * 2, "number"),
        ],
        sample_size=len(done),
        passed=passed,
        failed=len(done) - passed,
        examples=pick_examples(candidates),
        experiment=experiment,
        notes=["Each topic is debated for 1 round, twice."],
    )
