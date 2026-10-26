"""Persona consistency: does every message sound like the persona who sent it?

A turn runs for each scenario. The judge then (1) scores each message 1-5 for
staying in character, given the persona's description, and (2) with the names
hidden, guesses which persona wrote each message (blind attribution), which is
compared with random chance.
"""

import json
import statistics

from pydantic import BaseModel, Field

from evals.common import SETUPS, SuiteResult, example, judge, load_cases, metric, persona_description, pick_examples, run_cases, run_turn


class MessageScore(BaseModel):
    index: int
    score: int = Field(description="1 = completely out of character, 5 = unmistakably this persona")
    reason: str = Field(description="One short line")


class Scores(BaseModel):
    scores: list[MessageScore]


class Guess(BaseModel):
    index: int
    letter: str = Field(description="The letter of the persona you think wrote this message")


class Attribution(BaseModel):
    guesses: list[Guess]


async def target(inputs: dict) -> dict:
    turn = await run_turn(inputs["room"], inputs["message"])
    return {"messages": [{"friend_id": m["friend_id"], "text": m["text"]} for m in turn.messages]}


async def in_character(inputs: dict, outputs: dict, reference_outputs: dict) -> dict:
    msgs = outputs["messages"]
    if not msgs:
        return {"key": "in_character", "score": None, "comment": "no messages"}
    lines = "\n".join(
        f"[{i}] {persona_description(inputs['room'], m['friend_id'])}\n    Message: {m['text']}" for i, m in enumerate(msgs)
    )
    result: Scores = await judge(
        Scores,
        "You evaluate AI characters in a group-chat app. For each message, score 1-5 how well it stays in character "
        "for the persona described (personality, speaking habits, typical stance). Be strict and fair.",
        f"User's message: {inputs['message']}\n\nMessages to score:\n{lines}",
    )
    scores = {s.index: max(1, min(5, s.score)) for s in result.scores}
    per_message = [{"text": m["text"], "score": scores.get(i), "reason": next((s.reason for s in result.scores if s.index == i), "")} for i, m in enumerate(msgs)]
    return {"key": "in_character", "score": statistics.mean(scores.values()) if scores else None, "comment": json.dumps(per_message, ensure_ascii=False)}


async def attribution(inputs: dict, outputs: dict, reference_outputs: dict) -> dict:
    """Blind test: the judge sees the personas as A, B, C... and anonymous messages, and matches them up."""
    msgs = outputs["messages"]
    members = [p["id"] for p in SETUPS[inputs["room"]]["participants"]]
    letters = {pid: chr(65 + i) for i, pid in enumerate(members)}
    if not msgs or len(members) < 2:
        return {"key": "attribution", "score": None, "comment": "not enough messages"}
    personas = "\n".join(f"{letters[pid]}: {persona_description(inputs['room'], pid).split(':', 1)[1].strip()}" for pid in members)
    result: Attribution = await judge(
        Attribution,
        "Each message below was written by one of the personas described. Their names are hidden. "
        "For each message, give the letter of the persona who most likely wrote it.",
        f"Personas:\n{personas}\n\nMessages:\n" + "\n".join(f"[{i}] {m['text']}" for i, m in enumerate(msgs)),
    )
    guesses = {g.index: g.letter.strip().upper()[:1] for g in result.guesses}
    correct = sum(guesses.get(i) == letters[m["friend_id"]] for i, m in enumerate(msgs))
    return {"key": "attribution", "score": correct / len(msgs), "comment": json.dumps({"correct": correct, "total": len(msgs), "chance": 1 / len(members)})}


# Passed to LangSmith's evaluate(): plain functions whose parameters are named (inputs, outputs, reference_outputs).
EVALUATORS = [in_character, attribution]


async def run(quick: bool) -> SuiteResult:
    cases = [c for c in load_cases("persona_consistency") if c.get("quick") or not quick]
    rows, experiment = await run_cases("persona_consistency", cases, target, EVALUATORS)

    messages, correct, total, chances, candidates = [], 0, 0, [], []
    for row in rows:
        for m in json.loads(row.results.get("in_character", {}).get("comment") or "[]") if row.outputs else []:
            if m.get("score") is not None:
                messages.append(m)
                candidates.append(example(f"[{row.case['inputs']['room']}] {row.case['inputs']['message']}", m["text"], m["score"] >= 4, f"In character: {m['score']}/5. {m['reason']}"))
        att = row.results.get("attribution", {})
        if att.get("comment", "").startswith("{"):
            info = json.loads(att["comment"])
            correct, total = correct + info["correct"], total + info["total"]
            chances += [info["chance"]] * info["total"]

    passed = sum(m["score"] >= 4 for m in messages)
    return SuiteResult(
        id="persona_consistency",
        headline=metric("Average in-character score", statistics.mean(m["score"] for m in messages) if messages else None, "score5"),
        metrics=[
            metric("Messages scored 4 or 5", passed / len(messages) if messages else None, "percent"),
            metric("Blind attribution accuracy", correct / total if total else None, "percent"),
            metric("Random chance", statistics.mean(chances) if chances else None, "percent"),
            metric("Turns that failed to run", sum(r.error is not None for r in rows), "number"),
        ],
        sample_size=len(messages),
        passed=passed,
        failed=len(messages) - passed,
        examples=pick_examples(candidates),
        experiment=experiment,
    )
