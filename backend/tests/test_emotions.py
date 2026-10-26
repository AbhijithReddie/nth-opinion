"""Call mode: a message's emotion comes from a tag in the same LLM reply, and is stripped from the text."""

import asyncio

import rooms.engine as engine
from rooms import get_room
from tests.conftest import GROUP


def test_split_emotion():
    assert engine.split_emotion("[happy] Bro, go for it!") == ("happy", "Bro, go for it!")
    assert engine.split_emotion(" [ Concerned ]  Are you okay?") == ("concerned", "Are you okay?")
    assert engine.split_emotion("Just tell her.") == ("neutral", "Just tell her.")
    assert engine.split_emotion("[sleepy] hmm") == ("neutral", "[sleepy] hmm")  # unknown tags stay as text
    assert engine.split_emotion("Wow [excited] this is it [annoyed]") == ("excited", "Wow this is it")


def test_message_events_carry_the_emotion(fake_llm):
    fake_llm.director_script = [engine.DirectorDecision(reason="r", action="speak", friend_id="rohit")]
    fake_llm.speaker_text = "[annoyed] Bro, seriously?"

    async def turn():
        return [e async for e in engine.stream_turn(get_room("group-chat"), message="I forgot again", history=[], participants=GROUP, language="english")]

    events = asyncio.run(turn())
    message = next(data for kind, data in events if kind == "message")
    assert message["emotion"] == "annoyed" and message["text"] == "Bro, seriously?"
    assert "[happy]" in fake_llm.system_prompts("group-chat_rohit")[0]  # the tag list is in the prompt
