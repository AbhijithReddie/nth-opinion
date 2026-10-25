"""
Huddle room engine: one LangGraph loop shared by every room.

A room (Group Chat, Shark Tank, Interview Panel, ...) is just a RoomConfig:
its personas, how its director should run turn-taking, optional modes, and an
optional structured summary. This file turns any RoomConfig into a live,
streamed conversation:

    START -> safety_check -> director --speak--> friend_speaks --+
                                ^     --react--> friend_reacts --+
                                |                                |
                                +--------------------------------+
                                      --end----> your_turn -> END

* safety_check  : classifies the user's latest message (normal / crisis).
* director      : an LLM with structured output picks the next step: who
                  speaks (and what to respond to), who reacts with an emoji,
                  or end the turn. Hard rules (limits, no one speaking three
                  times in a row, ...) are then enforced in code.
* friend_speaks : one persona writes one short message.
* friend_reacts : one persona adds an emoji reaction to a message.
* your_turn     : tells the client it's the user's turn again.

Nodes emit client events through LangGraph's custom stream (get_stream_writer),
so the API and the CLI see typing / message / reaction / safety / your_turn
events the moment they happen. The engine is stateless: every call receives
the recent history from the client.
"""

import logging
import operator
import re
import uuid
from collections import Counter
from dataclasses import dataclass
from typing import Annotated, Any, AsyncIterator, Callable, Literal, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field

from llm import DIRECTOR_MODEL_NAME, ModelBusyError, content_text, invoke, timed
from rooms.safety import GUARDRAILS, HELPLINE_TEXT, SUPPORTIVE_MODE, classify_message

logger = logging.getLogger("huddle.rooms")


# ===========================================================================
# Room configuration
# ===========================================================================
@dataclass(frozen=True)
class Persona:
    """One AI character in a room."""

    id: str  # stable id used in the API, e.g. "rohit"
    name: str  # default display name (the user may rename)
    emoji: str
    color: str  # hex accent colour for the UI
    tagline: str  # one-line personality for setup cards
    personality: str  # who they are (prompt)
    speaking_style: str  # how they write: habits, slang, emoji use (prompt)
    stance: str  # their typical take on problems (prompt + director)

    def public(self) -> dict:
        return {"id": self.id, "name": self.name, "emoji": self.emoji, "color": self.color, "tagline": self.tagline}


@dataclass(frozen=True)
class Mode:
    """An optional phase of a room, e.g. Roast & Toast's "roast" then "feedback".

    The first mode in RoomConfig.modes is the starting mode. The director may
    switch modes (DirectorDecision.next_mode); the client is told with a
    `mode` event and should send the mode back with its next request.
    """

    id: str
    title: str
    instructions: str  # added to every persona prompt while this mode is active
    director_hint: str = ""  # when the director should switch to / away from this mode


@dataclass(frozen=True)
class SummarySpec:
    """The room's final structured output (a poll, scores, investor offers, ...)."""

    schema: type[BaseModel]  # what the LLM must return
    instructions: str  # what to produce, for the summary prompt
    # Cleans/validates the LLM's result against the participants and returns JSON-ready data.
    finalize: Callable[[BaseModel, list[dict]], dict]


@dataclass(frozen=True)
class RoomConfig:
    id: str  # URL id, e.g. "group-chat"
    title: str
    description: str
    personas: tuple[Persona, ...]
    director_instructions: str  # how turn-taking works in this room and when to end
    speaker_instructions: str  # the setting, given to every persona
    languages: dict[str, str]  # language id -> style instruction for personas
    min_participants: int = 3
    max_participants: int = 4
    modes: tuple[Mode, ...] = ()
    summary: SummarySpec | None = None
    reaction_emojis: tuple[str, ...] = ("❤️", "😂", "👍", "😮", "😢", "🔥", "💯", "🙏", "👀", "😭")
    max_messages: int = 6  # persona messages per user message
    max_reactions: int = 4  # emoji reactions per user message
    max_in_a_row: int = 2  # the same persona can't send more than this many messages in a row
    max_words: int = 40  # target length of one message
    crisis_messages: tuple[int, int] = (2, 3)  # min/max supportive messages after a crisis message
    history_limit: int = 40  # messages of history the engine looks at
    user_label: str = "User"  # how the user appears in transcripts

    def persona(self, persona_id: str) -> Persona | None:
        return next((p for p in self.personas if p.id == persona_id), None)

    def public(self) -> dict:
        """Room info for GET /api/rooms."""
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "personas": [p.public() for p in self.personas],
            "min_participants": self.min_participants,
            "max_participants": self.max_participants,
            "languages": list(self.languages),
            "modes": [{"id": m.id, "title": m.title} for m in self.modes],
            "has_summary": self.summary is not None,
        }

    def validate_participants(self, participants: list[dict]) -> str | None:
        """A user-facing error message, or None if the chosen personas are valid."""
        ids = [p["id"] for p in participants]
        if not self.min_participants <= len(ids) <= self.max_participants:
            return f"Pick between {self.min_participants} and {self.max_participants} people for this room."
        if len(set(ids)) != len(ids):
            return "Each person can only be added once."
        unknown = [i for i in ids if self.persona(i) is None]
        if unknown:
            return f"Unknown persona: {', '.join(unknown)}."
        return None


# Every room the API serves, by id. Room modules call register_room().
ROOMS: dict[str, RoomConfig] = {}


def register_room(room: RoomConfig) -> RoomConfig:
    ROOMS[room.id] = room
    return room


def get_room(room_id: str) -> RoomConfig | None:
    return ROOMS.get(room_id)


# ===========================================================================
# State
# ===========================================================================
class ChatMessage(TypedDict, total=False):
    id: str
    sender: str  # "user" or a persona id
    text: str
    reply_to: str | None
    mentions: list[str]


class Reaction(TypedDict):
    friend_id: str
    message_id: str
    emoji: str


class RoomState(TypedDict, total=False):
    """State for ONE user message and the replies it triggers.

    `new_messages` and `reactions` use operator.add reducers, so nodes return
    just their new item and LangGraph appends it.
    """

    room_id: str
    language: str
    mode: str | None
    participants: list[dict]  # [{"id", "name"}] in the user's chosen order
    history: list[ChatMessage]  # recent history, ending with the user's new message
    new_messages: Annotated[list[ChatMessage], operator.add]  # persona messages this turn
    reactions: Annotated[list[Reaction], operator.add]  # reactions this turn
    crisis: bool
    cover_everyone: bool  # brand-new topic: aim for every persona to speak once
    decision: dict  # the director's latest decision, after the rules are applied
    steps: int  # director decisions made this turn


# ===========================================================================
# Director: structured output
# ===========================================================================
class DirectorDecision(BaseModel):
    reason: str = Field(description="Very short reasoning for this choice (shown only in server logs)")
    action: Literal["speak", "react", "end"] = Field(
        description="speak = one participant sends a message; react = one participant adds an emoji "
        "reaction to a message; end = stop and let the user reply"
    )
    friend_id: str | None = Field(default=None, description="speak/react: id of the participant who acts")
    reply_to: str | None = Field(
        default=None,
        description="speak: optional id of the message being replied to (use when it isn't simply the latest "
        "message, or to make a thread clear). react: id of the message being reacted to (required).",
    )
    note: str | None = Field(
        default=None, description="speak only: under 15 words on what they should respond to or which angle to take"
    )
    emoji: str | None = Field(default=None, description="react only: exactly one emoji from the allowed list")
    topic_is_new: bool = Field(
        default=False, description="True if the user's latest message starts a brand-new topic or problem"
    )
    next_mode: str | None = Field(
        default=None, description="Leave empty unless the room has modes and it is time to switch to another one"
    )


# ===========================================================================
# Helpers
# ===========================================================================
_NAME_PREFIX = re.compile(r"^\s*\**\s*[\w .'-]{1,24}\s*\**\s*:\s+")


def _name_of(room: RoomConfig, participants: list[dict], sender: str) -> str | None:
    """Display name for a sender, or None if the sender is unknown (e.g. a removed persona)."""
    if sender == "user":
        return room.user_label
    chosen = next((p["name"] for p in participants if p["id"] == sender), None)
    if chosen:
        return chosen
    persona = room.persona(sender)
    return persona.name if persona else None


def _format_line(room: RoomConfig, participants: list[dict], msg: ChatMessage, with_ids: bool) -> str | None:
    name = _name_of(room, participants, msg["sender"])
    if name is None:
        return None
    if with_ids:
        reply = f" (replying to [{msg['reply_to']}])" if msg.get("reply_to") else ""
        return f"[{msg['id']}] {name}{reply}: {msg['text']}"
    return f"{name}: {msg['text']}"


def _transcript(state: RoomState, room: RoomConfig, with_ids: bool) -> str:
    """The conversation, oldest first. The director sees message ids; personas don't need them."""
    lines = []
    for msg in state["history"] + state.get("new_messages", []):
        line = _format_line(room, state["participants"], msg, with_ids)
        if line:
            lines.append(line)
    return "\n".join(lines) or "(empty)"


def find_mentions(text: str, participants: list[dict], author: str | None = None) -> list[str]:
    """Persona ids (and "user") @mentioned in `text`. Names may contain spaces."""
    mentions = []
    for p in participants:
        if p["id"] != author and re.search(rf"@{re.escape(p['name'])}(?!\w)", text, re.IGNORECASE):
            mentions.append(p["id"])
    if re.search(r"@(you|user)\b", text, re.IGNORECASE):
        mentions.append("user")
    return mentions


def _clean_reply(text: str, max_words: int) -> str:
    """Tidy a persona's reply: no "Name:" prefix, no wrapping quotes, a hard length cap."""
    text = _NAME_PREFIX.sub("", text.strip(), count=1).strip()
    if len(text) >= 2 and text[0] == text[-1] and text[0] in "\"'":
        text = text[1:-1].strip()
    text = re.sub(r"\n{3,}", "\n\n", text)
    words = text.split(" ")
    hard_cap = int(max_words * 1.75)  # the prompt asks for max_words; allow some slack before cutting
    if len(words) > hard_cap:
        text = " ".join(words[:hard_cap]).rstrip(",;:") + "..."
    return text[:600]


def _turn_stats(state: RoomState) -> dict:
    """Counts the director's rules depend on."""
    new = state.get("new_messages", [])
    run_speaker, run_len = None, 0
    for msg in reversed(new):
        if run_speaker is None:
            run_speaker = msg["sender"]
        if msg["sender"] != run_speaker:
            break
        run_len += 1
    spoke = Counter(m["sender"] for m in new)
    return {
        "messages": len(new),
        "reactions": len(state.get("reactions", [])),
        "spoke": spoke,
        "unspoken": [p["id"] for p in state["participants"] if p["id"] not in spoke],
        "run_speaker": run_speaker,
        "run_len": run_len,
    }


def _message_limits(room: RoomConfig, crisis: bool) -> tuple[int, int]:
    """(minimum, maximum) persona messages for this turn."""
    return room.crisis_messages if crisis else (1, room.max_messages)


def _norm_emoji(emoji: str) -> str:
    return emoji.replace("️", "").strip()


# ===========================================================================
# Nodes
# ===========================================================================
@timed("safety_check", logger)
async def safety_check_node(state: RoomState) -> dict:
    """Classify the user's latest message. On a crisis, switch every persona to supportive mode."""
    room = ROOMS[state["room_id"]]
    *earlier, latest = state["history"]
    context = [line for m in earlier[-6:] if (line := _format_line(room, state["participants"], m, False))]
    crisis = await classify_message(latest["text"], context)
    if crisis:
        logger.warning("Crisis detected in room %s: supportive mode on", room.id)
        get_stream_writer()(("safety", {"helpline_text": HELPLINE_TEXT}))
    # The very first user message is always a new topic: everyone should get a say.
    first_message = not any(m["sender"] == "user" for m in earlier)
    return {"crisis": crisis, "cover_everyone": first_message}


def _director_prompt(state: RoomState, room: RoomConfig) -> list:
    """Build the director's system + human messages from the room config and the turn so far."""
    stats = _turn_stats(state)
    crisis = state.get("crisis", False)
    min_msgs, max_msgs = _message_limits(room, crisis)
    names = {p["id"]: p["name"] for p in state["participants"]}

    cast = "\n".join(
        f"- id={p['id']}: {p['name']} {room.persona(p['id']).emoji}. {room.persona(p['id']).personality} "
        f"Typical stance: {room.persona(p['id']).stance}"
        for p in state["participants"]
    )
    modes = ""
    if room.modes:
        modes = "\nModes (switch with next_mode):\n" + "\n".join(
            f"- {m.id}: {m.title}. {m.director_hint}" for m in room.modes
        )

    system = f"""You are the director of "{room.title}", a live group conversation between the user and AI \
participants. You never write messages yourself. Each time you are called you choose ONE next step.

{room.director_instructions}

Participants:
{cast}
{modes}
How to choose:
- NOT round-robin. Pick whoever would most naturally respond right now: someone who was @mentioned or asked \
a question, someone with a strong opinion on this, someone who would disagree with the last message, or \
someone who has been quiet.
- speak: set friend_id, a short note on what to respond to, and reply_to when they answer a specific \
earlier message.
- react: set friend_id, reply_to (the message id) and one emoji from: {" ".join(room.reaction_emojis)}. \
Use reactions for quick agreement, laughs or sympathy where a full message isn't needed. Never react to \
your own message.
- end: when the user's message is well covered or the conversation reaches a natural pause for the user.
- The same participant may not send more than {room.max_in_a_row} messages in a row (two short messages \
in a row is fine occasionally).
- Per user message: {min_msgs}-{max_msgs} messages and at most {room.max_reactions} reactions.
- Use ids exactly as written (participant ids above, message ids in [brackets])."""

    spoke = ", ".join(f"{names.get(i, i)} x{n}" for i, n in stats["spoke"].items()) or "nobody yet"
    quiet = ", ".join(names[i] for i in stats["unspoken"]) or "nobody"
    status = [
        f"Messages so far this turn: {stats['messages']}/{max_msgs}. Reactions: {stats['reactions']}/{room.max_reactions}.",
        f"Spoken this turn: {spoke}. Not yet spoken: {quiet}.",
    ]
    if stats["run_speaker"]:
        status.append(f"Last speaker: {names.get(stats['run_speaker'])} ({stats['run_len']} in a row).")
    if state.get("cover_everyone"):
        status.append("This is a brand-new topic: aim for every participant to speak at least once.")
    if room.modes:
        status.append(f"Current mode: {state.get('mode')}.")
    if crisis:
        status.append(
            "SAFETY: the user may be in crisis. Only gentle, supportive messages, no reactions. "
            f"End after {min_msgs}-{max_msgs} supportive messages."
        )

    previous = state["history"][:-1]
    human = (
        "Conversation so far (oldest first):\n"
        + "\n".join(l for m in previous if (l := _format_line(room, state["participants"], m, True)))
        + "\n\nUSER'S LATEST MESSAGE:\n"
        + _format_line(room, state["participants"], state["history"][-1], True)
        + "\n\nReplies to it so far:\n"
        + ("\n".join(l for m in state.get("new_messages", []) if (l := _format_line(room, state["participants"], m, True))) or "(none yet)")
        + "\n\nStatus:\n"
        + "\n".join(status)
        + "\n\nChoose the next step."
    )
    return [SystemMessage(content=system), HumanMessage(content=human)]


def _apply_rules(state: RoomState, room: RoomConfig, d: DirectorDecision) -> tuple[dict, list[str]]:
    """Enforce the hard turn-taking rules on the director's choice.

    The LLM picks who would naturally speak; this function makes sure the
    choice is valid and the limits hold, so a bad decision can never break the
    chat or loop forever. Returns the final decision and a list of corrections
    (for the logs).
    """
    stats = _turn_stats(state)
    crisis = state.get("crisis", False)
    min_msgs, max_msgs = _message_limits(room, crisis)
    ids = [p["id"] for p in state["participants"]]
    all_msgs = state["history"] + state.get("new_messages", [])
    msg_by_id = {m["id"]: m for m in all_msgs}
    fixes: list[str] = []

    def blocked(friend_id: str) -> bool:
        """True if this persona has already sent the maximum messages in a row."""
        return friend_id == stats["run_speaker"] and stats["run_len"] >= room.max_in_a_row

    def pick_speaker() -> str:
        """Fallback choice: someone @mentioned in the latest message, else whoever has spoken least."""
        mentioned = find_mentions(all_msgs[-1]["text"], state["participants"])
        candidates = [i for i in ids if not blocked(i)]
        for i in mentioned:
            if i in candidates and stats["spoke"][i] == 0:
                return i
        return min(candidates, key=lambda i: (stats["spoke"][i], ids.index(i)))

    decision = {
        "action": d.action,
        "friend_id": d.friend_id,
        "reply_to": d.reply_to,
        "note": (d.note or "").strip()[:200],
        "emoji": None,
    }

    # Hard stop: message limit reached, or too many director steps (safety net against loops).
    if stats["messages"] >= max_msgs or state.get("steps", 0) >= room.max_messages + room.max_reactions + 4:
        if decision["action"] != "end":
            fixes.append("limit reached -> end")
        return {**decision, "action": "end"}, fixes

    # Reactions: must be allowed, by a participant, on an existing message that isn't their own.
    if decision["action"] == "react":
        target = msg_by_id.get(decision["reply_to"] or "")
        reacted = {(r["friend_id"], r["message_id"]) for r in state.get("reactions", [])}
        if crisis or stats["reactions"] >= room.max_reactions:
            fixes.append("reaction not allowed now -> end")
            decision["action"] = "end"
        elif decision["friend_id"] not in ids or target is None or target["sender"] == decision["friend_id"] \
                or (decision["friend_id"], target["id"]) in reacted:
            fixes.append("invalid reaction -> end")
            decision["action"] = "end"
        else:
            allowed = {_norm_emoji(e): e for e in room.reaction_emojis}
            decision["emoji"] = allowed.get(_norm_emoji(d.emoji or ""), room.reaction_emojis[0])

    # Ending: not before the minimum, and on a new topic not before everyone has had a say.
    if decision["action"] == "end":
        too_early = stats["messages"] < min_msgs
        uncovered = state.get("cover_everyone") and stats["unspoken"] and not crisis
        if too_early or uncovered:
            fixes.append("too early to end -> speak")
            decision.update(action="speak", friend_id=None, reply_to=None, note="")

    # Speaking: a valid participant who hasn't just spoken twice in a row.
    if decision["action"] == "speak":
        if decision["friend_id"] not in ids:
            if decision["friend_id"] is not None:
                fixes.append(f"unknown friend {decision['friend_id']!r}")
            decision["friend_id"] = pick_speaker()
        elif blocked(decision["friend_id"]):
            fixes.append(f"{decision['friend_id']} already spoke {room.max_in_a_row}x in a row")
            decision["friend_id"] = pick_speaker()
        if decision["reply_to"] not in msg_by_id:
            decision["reply_to"] = None
        if not decision["note"]:
            decision["note"] = "respond to the conversation naturally"
    elif decision["action"] == "end":
        decision.update(friend_id=None, reply_to=None, note="", emoji=None)

    return decision, fixes


@timed("director", logger)
async def director_node(state: RoomState) -> dict:
    """Decide the next step of the conversation (see module docstring)."""
    room = ROOMS[state["room_id"]]
    step = state.get("steps", 0) + 1
    stats = _turn_stats(state)
    _, max_msgs = _message_limits(room, state.get("crisis", False))

    if stats["messages"] >= max_msgs:
        # Nothing to decide: skip the LLM call.
        raw = DirectorDecision(reason="message limit reached", action="end")
    else:
        try:
            raw = await invoke(
                _director_prompt(state, room),
                temperature=0.4,
                schema=DirectorDecision,
                model=DIRECTOR_MODEL_NAME,
                run_name=f"{room.id}_director",
            )
            if raw is None:
                raise ValueError("director returned no decision")
        except ModelBusyError:
            raise
        except Exception:
            # A malformed decision shouldn't kill the chat: _apply_rules turns this into a sensible choice.
            logger.exception("Director call failed; using fallback decision")
            raw = DirectorDecision(reason="director failed, fallback", action="end")

    decision, fixes = _apply_rules(state, room, raw)
    logger.info(
        "Director step %d: %s friend=%s reply_to=%s emoji=%s note=%r | reason=%r%s",
        step,
        decision["action"],
        decision["friend_id"],
        decision["reply_to"],
        decision["emoji"],
        decision["note"],
        raw.reason,
        f" | corrected: {'; '.join(fixes)}" if fixes else "",
    )

    update: dict[str, Any] = {"decision": decision, "steps": step}
    if raw.topic_is_new and step == 1 and not state.get("cover_everyone"):
        update["cover_everyone"] = True
    if room.modes and raw.next_mode and raw.next_mode != state.get("mode"):
        if any(m.id == raw.next_mode for m in room.modes):
            logger.info("Director switched mode %s -> %s", state.get("mode"), raw.next_mode)
            update["mode"] = raw.next_mode
            get_stream_writer()(("mode", {"mode": raw.next_mode}))
    return update


def _speaker_prompt(state: RoomState, room: RoomConfig, friend_id: str, note: str, reply_to: str | None) -> list:
    """Build one persona's prompt: who they are, the setting, language, mode, safety and the chat."""
    persona = room.persona(friend_id)
    names = {p["id"]: p["name"] for p in state["participants"]}
    me = names[friend_id]
    others = "\n".join(
        f"- {names[p['id']]} {room.persona(p['id']).emoji}: {room.persona(p['id']).tagline}"
        for p in state["participants"]
        if p["id"] != friend_id
    )
    example = next(n for i, n in names.items() if i != friend_id)
    mode = next((m for m in room.modes if m.id == state.get("mode")), None)

    system = f"""You are {me} {persona.emoji}.
{room.speaker_instructions}

Who you are: {persona.personality}
How you talk: {persona.speaking_style}
Your usual take: {persona.stance}

The others in the conversation:
{others}

Language: {room.languages[state["language"]]}
{f"Current mode - {mode.title}: {mode.instructions}" if mode else ""}
Format: ONE chat message, at most about {room.max_words} words. Plain text only: no "{me}:" prefix, no \
quotes around it, no markdown or hashtags. To mention someone write @Name (e.g. @{example}); \
to mention the user write @you. Stay fully in character; don't repeat what others already said.

{GUARDRAILS}"""
    if state.get("crisis"):
        system += "\n\n" + SUPPORTIVE_MODE

    all_msgs = {m["id"]: m for m in state["history"] + state.get("new_messages", [])}
    target = all_msgs.get(reply_to or "")
    task = f"Your message now should: {note}"
    if target:
        who = _name_of(room, state["participants"], target["sender"]) or "someone"
        task += f'\nYou are replying directly to {who}\'s message: "{target["text"]}"'

    human = f"Chat so far (oldest first):\n{_transcript(state, room, with_ids=False)}\n\n{task}\n\nWrite your message as {me}."
    return [SystemMessage(content=system), HumanMessage(content=human)]


@timed("friend_speaks", logger)
async def friend_speaks_node(state: RoomState) -> dict:
    """The chosen persona writes one short message (typing event first, then the message)."""
    room = ROOMS[state["room_id"]]
    decision = state["decision"]
    friend_id = decision["friend_id"]
    write = get_stream_writer()

    write(("typing", {"friend_id": friend_id}))
    response = await invoke(
        _speaker_prompt(state, room, friend_id, decision["note"], decision["reply_to"]),
        temperature=0.9,
        run_name=f"{room.id}_{friend_id}",
    )
    text = _clean_reply(content_text(response.content), room.max_words)
    if not text:
        logger.warning("%s returned an empty message; skipping", friend_id)
        return {}

    message: ChatMessage = {
        "id": f"{friend_id}-{uuid.uuid4().hex[:8]}",
        "sender": friend_id,
        "text": text,
        "reply_to": decision["reply_to"],
        "mentions": find_mentions(text, state["participants"], author=friend_id),
    }
    write((
        "message",
        {
            "id": message["id"],
            "friend_id": friend_id,
            "text": text,
            "reply_to": message["reply_to"],
            "mentions": message["mentions"],
        },
    ))
    return {"new_messages": [message]}


@timed("friend_reacts", logger)
async def friend_reacts_node(state: RoomState) -> dict:
    """The chosen persona adds an emoji reaction (no LLM call needed: the director picked the emoji)."""
    d = state["decision"]
    reaction: Reaction = {"friend_id": d["friend_id"], "message_id": d["reply_to"], "emoji": d["emoji"]}
    get_stream_writer()(("reaction", dict(reaction)))
    return {"reactions": [reaction]}


async def your_turn_node(state: RoomState) -> dict:
    get_stream_writer()(("your_turn", {}))
    return {}


def after_director(state: RoomState) -> Literal["friend_speaks", "friend_reacts", "your_turn"]:
    """Route on the director's (rule-checked) decision."""
    action = state["decision"]["action"]
    if action == "speak":
        return "friend_speaks"
    if action == "react":
        return "friend_reacts"
    return "your_turn"


def build_room_graph():
    builder = StateGraph(RoomState)
    builder.add_node("safety_check", safety_check_node)
    builder.add_node("director", director_node)
    builder.add_node("friend_speaks", friend_speaks_node)
    builder.add_node("friend_reacts", friend_reacts_node)
    builder.add_node("your_turn", your_turn_node)

    builder.add_edge(START, "safety_check")  # every user message is checked first
    builder.add_edge("safety_check", "director")
    # The director loop: after every message or reaction, the director decides again.
    builder.add_conditional_edges("director", after_director, ["friend_speaks", "friend_reacts", "your_turn"])
    builder.add_edge("friend_speaks", "director")
    builder.add_edge("friend_reacts", "director")
    builder.add_edge("your_turn", END)
    return builder.compile()


room_graph = build_room_graph()


# ===========================================================================
# Public API (used by main.py and chat_cli.py)
# ===========================================================================
def _recent_history(room: RoomConfig, history: list[dict]) -> list[ChatMessage]:
    """Keep the last history_limit - 1 messages (the user's new message is the last slot)."""
    keep = history[-(room.history_limit - 1):] if room.history_limit > 1 else []
    return [
        {"id": m["id"], "sender": m["sender"], "text": m["text"], "reply_to": m.get("reply_to")}
        for m in keep
    ]


async def stream_turn(
    room: RoomConfig,
    *,
    message: str,
    history: list[dict],
    participants: list[dict],
    language: str,
    message_id: str | None = None,
    mode: str | None = None,
) -> AsyncIterator[tuple[str, dict]]:
    """Run one user message through the room graph, yielding (event, data) as they happen.

    Events: typing, message, reaction, safety, mode, your_turn. Raises
    ModelBusyError when the model is unavailable; cancelling the iteration
    (e.g. the client disconnected) stops the graph and any in-flight LLM call.
    """
    user_msg: ChatMessage = {"id": message_id or f"user-{uuid.uuid4().hex[:8]}", "sender": "user", "text": message}
    valid_modes = [m.id for m in room.modes]
    state: RoomState = {
        "room_id": room.id,
        "language": language,
        "mode": mode if mode in valid_modes else (valid_modes[0] if valid_modes else None),
        "participants": participants,
        "history": _recent_history(room, history) + [user_msg],
        "new_messages": [],
        "reactions": [],
        "crisis": False,
        "cover_everyone": False,
        "steps": 0,
    }
    async for event, data in room_graph.astream(
        state,
        stream_mode="custom",
        config={"recursion_limit": 80, "run_name": f"{room.id}_turn"},
    ):
        yield event, data


class SummaryError(Exception):
    """The summary could not be produced. str() is safe to show to users."""


async def summarize(room: RoomConfig, *, history: list[dict], participants: list[dict], language: str) -> dict:
    """One structured-output LLM call that turns the conversation into the room's final output."""
    spec = room.summary
    if spec is None:
        raise SummaryError("This room doesn't have a summary.")
    msgs = _recent_history(room, history)
    if not any(m["sender"] == "user" for m in msgs):
        raise SummaryError("Say something to the group first, then ask for a vote.")

    cast = "\n".join(
        f"- id={p['id']}: {p['name']} {room.persona(p['id']).emoji}. {room.persona(p['id']).personality} "
        f"Talks like: {room.persona(p['id']).speaking_style}"
        for p in participants
    )
    transcript = "\n".join(l for m in msgs if (l := _format_line(room, participants, m, False)))
    system = f"""You are wrapping up a "{room.title}" conversation.
{spec.instructions}

Participants:
{cast}

Language for all text: {room.languages[language]}
{GUARDRAILS}"""
    result = await invoke(
        [SystemMessage(content=system), HumanMessage(content=f"Conversation:\n{transcript}")],
        temperature=0.7,
        schema=spec.schema,
        run_name=f"{room.id}_summary",
    )
    if result is None:
        raise SummaryError("Couldn't put the summary together. Please try again.")
    return spec.finalize(result, participants)
