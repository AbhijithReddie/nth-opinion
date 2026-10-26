"""Director quality: deterministic metrics over multi-turn conversations.

* rule violations: one persona sending more than the room's in-a-row limit, or
  more messages than the room's cap in one turn;
* new-topic coverage: on a new topic, did every member of the room speak?
* evenness: normalised entropy of who spoke across the conversation (1 = perfectly even);
* messages per turn.
No judge: everything is counted from what actually happened. Quick runs use the
first turn of the first conversation (shared with the persona suite).
"""

import ast
import math

from evals.common import SETUPS, SuiteResult, example, history_after, load_cases, metric, pick_examples, run_cases, run_turn
from rooms import get_room


def make_target(quick: bool):
    async def target(inputs: dict) -> dict:
        history, turns = [], []
        for i, t in enumerate(inputs["turns"][:1] if quick else inputs["turns"]):
            turn = await run_turn(inputs["room"], t["message"], history=history)
            turns.append({"new_topic": t["new_topic"], "speakers": [m["friend_id"] for m in turn.messages], "safety": turn.safety_event})
            history = history_after(history, turn, f"u-eval-{i}")
        return {"turns": turns}

    return target


def longest_run(speakers: list[str]) -> int:
    best = run = 0
    for i, s in enumerate(speakers):
        run = run + 1 if i and speakers[i - 1] == s else 1
        best = max(best, run)
    return best


def evenness(counts: dict[str, int], members: int) -> float:
    total = sum(counts.values())
    if total == 0 or members < 2:
        return 0.0
    entropy = -sum((c / total) * math.log(c / total) for c in counts.values() if c)
    return entropy / math.log(members)


def check(inputs: dict, outputs: dict, reference_outputs: dict) -> dict:
    room = get_room(inputs["room"])
    members = [p["id"] for p in SETUPS[inputs["room"]]["participants"]]
    violations, covered, new_topics = 0, 0, 0
    for t in outputs["turns"]:
        cap = room.crisis_messages[1] if t["safety"] else room.max_messages
        violations += longest_run(t["speakers"]) > room.max_in_a_row or len(t["speakers"]) > cap
        if t["new_topic"] and room.everyone_speaks_on_new_topic:
            new_topics += 1
            covered += set(members) <= set(t["speakers"])
    counts = {m: sum(t["speakers"].count(m) for t in outputs["turns"]) for m in members}
    return {
        "key": "director",
        "score": float(violations == 0 and covered == new_topics),
        "comment": repr({"violations": violations, "covered": covered, "new_topics": new_topics, "evenness": evenness(counts, len(members)),
                         "messages": [len(t["speakers"]) for t in outputs["turns"]]}),
    }


# Passed to LangSmith's evaluate(): plain functions whose parameters are named (inputs, outputs, reference_outputs).
EVALUATORS = [check]


async def run(quick: bool) -> SuiteResult:
    cases = [c for c in load_cases("director_quality") if c.get("quick") or not quick]
    rows, experiment = await run_cases("director_quality", cases, make_target(quick), EVALUATORS)

    stats = [ast.literal_eval(r.results["director"]["comment"]) for r in rows if "director" in r.results]
    turns = sum(len(s["messages"]) for s in stats)
    violations = sum(s["violations"] for s in stats)
    new_topics = sum(s["new_topics"] for s in stats)
    candidates = [
        example(
            f"[{r.case['inputs']['room']}] " + " / ".join(t["message"] for t in r.case["inputs"]["turns"][: len(s["messages"])]),
            "Speakers per turn: " + "; ".join(", ".join(t["speakers"]) for t in r.outputs["turns"]),
            r.score("director") == 1.0,
            f"{s['violations']} rule violations, {s['covered']}/{s['new_topics']} new topics fully covered, evenness {s['evenness']:.2f}",
        )
        for r, s in zip([r for r in rows if "director" in r.results], stats)
    ]
    return SuiteResult(
        id="director_quality",
        headline=metric("Turns without a rule violation", (turns - violations) / turns if turns else None, "percent"),
        metrics=[
            metric("Rule violations", violations, "number", lower_is_better=True),
            metric("New topics where everyone spoke", sum(s["covered"] for s in stats) / new_topics if new_topics else None, "percent"),
            metric("Speaking evenness (normalised entropy)", sum(s["evenness"] for s in stats) / len(stats) if stats else None, "ratio"),
            metric("Average messages per turn", sum(sum(s["messages"]) for s in stats) / turns if turns else None, "number"),
        ],
        sample_size=turns,
        passed=turns - violations,
        failed=violations,
        examples=pick_examples(candidates),
        experiment=experiment,
    )
