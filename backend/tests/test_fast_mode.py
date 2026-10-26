"""ROOM_FAST_MODE: one planning call per turn instead of a director call before every message (mocked LLM)."""

import asyncio

import rooms.engine as engine
from rooms import get_room
from tests.conftest import GROUP

S = engine.PlanStep


def run_turn(fake_llm, plan: engine.TurnPlan, monkeypatch, trace=True):
    async def fake(messages, *, temperature, schema=None, model=None, run_name=None):
        if schema is engine.TurnPlan:
            fake_llm.prompts.append((run_name, messages[0].content, messages[-1].content))
            return plan
        return await fake_llm(messages, temperature=temperature, schema=schema, model=model, run_name=run_name)

    monkeypatch.setattr(engine, "invoke", fake)

    async def go():
        return [
            (e, d)
            async for e, d in engine.stream_turn(
                get_room("group-chat"), message="Guitar or keyboard?", history=[], participants=GROUP, language="english", trace=trace, fast=True
            )
        ]

    return asyncio.run(go())


def test_one_planning_call_for_the_whole_turn(fake_llm, monkeypatch):
    plan = engine.TurnPlan(
        reason="Everyone weighs in, then Priya backs Rohit.",
        topic_is_new=True,
        steps=[
            S(action="speak", friend_id="rohit", note="pick guitar", reason="Rohit has a strong opinion"),
            S(action="speak", friend_id="priya", note="ask what music they like", reason="Priya asks a question"),
            S(action="react", friend_id="priya", reply_to="step:1", emoji="🔥", reason="Priya likes Rohit's idea"),
            S(action="speak", friend_id="meera", note="calm advice", reason="Meera hasn't spoken"),
        ],
    )
    events = run_turn(fake_llm, plan, monkeypatch)
    runs = [name for name, _, _ in fake_llm.prompts]
    assert runs.count("group-chat_planner") == 1
    assert "group-chat_director" not in runs  # no director call before each message
    assert runs.count("group-chat_rohit") == runs.count("group-chat_priya") == runs.count("group-chat_meera") == 1

    messages = [d for e, d in events if e == "message"]
    reaction = next(d for e, d in events if e == "reaction")
    assert [m["friend_id"] for m in messages] == ["rohit", "priya", "meera"]
    assert reaction["message_id"] == messages[0]["id"]  # "step:1" became Rohit's real message id
    assert ("your_turn", {}) in events


def test_behind_the_scenes_shows_the_plan_and_reasons(fake_llm, monkeypatch):
    plan = engine.TurnPlan(reason="Quick round.", steps=[S(action="speak", friend_id=p["id"], note="x", reason=f"{p['name']} speaks") for p in GROUP])
    events = run_turn(fake_llm, plan, monkeypatch)
    planned = next(d for e, d in events if e == "director_plan")
    assert planned["reason"] == "Quick round."
    assert [s["persona_id"] for s in planned["steps"]] == ["rohit", "priya", "meera"]
    decisions = [d for e, d in events if e == "director_decision"]
    assert [d["reason"] for d in decisions[:3]] == ["Rohit speaks", "Priya speaks", "Meera speaks"]
    labels = [d["label"] for e, d in events if e == "node_start" and d["node"] == "director"]
    assert labels[0] == "Director plans the turn" and set(labels[1:]) == {"Director follows the plan"}


def test_rules_still_apply_to_the_plan(fake_llm, monkeypatch):
    # Rohit three times in a row breaks the in-a-row rule; the plan also leaves Meera out of a new topic.
    plan = engine.TurnPlan(reason="Rohit rants.", topic_is_new=True, steps=[S(action="speak", friend_id="rohit", note="x", reason="r")] * 3)
    events = run_turn(fake_llm, plan, monkeypatch, trace=False)
    speakers = [d["friend_id"] for e, d in events if e == "message"]
    assert speakers[:2] == ["rohit", "rohit"] and speakers[2] != "rohit"
    assert {"priya", "meera"} <= set(speakers)  # everyone gets a say on a new topic


def test_fast_mode_off_is_unchanged(fake_llm):
    # The default (ROOM_FAST_MODE unset): the director is asked before every step, no planner.
    async def go():
        return [e async for e, _ in engine.stream_turn(get_room("group-chat"), message="Hi", history=[], participants=GROUP, language="english")]

    asyncio.run(go())
    runs = [name for name, _, _ in fake_llm.prompts]
    assert "group-chat_planner" not in runs and runs.count("group-chat_director") >= 2
