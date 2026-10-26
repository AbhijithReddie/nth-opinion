"""Terminal client for Nth Opinion's Group Chat room (no server needed).

Usage:  python chat_cli.py
        python chat_cli.py --friends rohit,priya,vikram --language hinglish
        python chat_cli.py --quiet          (hide director decisions and node timings)

In the chat, type a message and press Enter. Type "poll" to ask the group to
vote, "quit" to leave.
"""

import argparse
import asyncio
import logging
import sys
import textwrap
import uuid

from languages import LANGUAGES
from llm import ModelBusyError
from rooms import SummaryError, get_room, stream_turn, summarize

ROOM = get_room("group-chat")


def read(prompt: str) -> str:
    return input(prompt).lstrip("﻿").strip()  # drop the BOM PowerShell adds to piped input


# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------
def ask_friends(preset: str | None) -> list[dict]:
    """Pick 3-4 friends (by number or id) and optionally rename them."""
    if preset:
        ids = [i.strip().lower() for i in preset.split(",") if i.strip()]
        friends = [{"id": i, "name": ROOM.persona(i).name} for i in ids if ROOM.persona(i)]
        problem = ROOM.validate_participants(friends) if len(friends) == len(ids) else "Unknown friend id."
        if problem:
            sys.exit(problem)
        return friends

    print("\nPick 3 or 4 friends:")
    for n, p in enumerate(ROOM.personas, 1):
        print(f"  {n}. {p.emoji} {p.name:7} {p.tagline}")
    while True:
        picks = read("Numbers, comma-separated (e.g. 1,2,5): ").replace(" ", "").split(",")
        if all(x.isdigit() and 1 <= int(x) <= len(ROOM.personas) for x in picks):
            friends = [{"id": ROOM.personas[int(x) - 1].id, "name": ROOM.personas[int(x) - 1].name} for x in picks]
            problem = ROOM.validate_participants(friends)
            if not problem:
                break
            print(problem)
        else:
            print(f"Please enter numbers from 1 to {len(ROOM.personas)}.")

    for f in friends:
        new = read(f"Rename {f['name']}? (Enter to keep): ")
        if new:
            f["name"] = new[:20]
    return friends


def ask_language(preset: str | None) -> str:
    if preset:
        return preset
    while True:
        lang = read(f"Language ({' / '.join(LANGUAGES)}) [english]: ").lower() or "english"
        if lang in LANGUAGES:
            return lang
        print("Please pick one of the listed languages.")


# ---------------------------------------------------------------------------
# Printing
# ---------------------------------------------------------------------------
class Printer:
    def __init__(self, friends: list[dict], history: list[dict]):
        self.names = {f["id"]: f["name"] for f in friends} | {"user": "You"}
        self.history = history  # shared with the chat loop, so replies can be quoted

    def label(self, sender: str) -> str:
        persona = ROOM.persona(sender)
        return f"{persona.emoji} {self.names.get(sender, persona.name)}" if persona else "You"

    def quote(self, message_id: str | None) -> str | None:
        msg = next((m for m in self.history if m["id"] == message_id), None)
        if not msg:
            return None
        snippet = msg["text"] if len(msg["text"]) <= 50 else msg["text"][:47] + "..."
        return f"{self.names.get(msg['sender'], msg['sender'])}: \"{snippet}\""

    def event(self, event: str, data: dict) -> None:
        if event == "typing":
            print(f"   ... {self.names[data['friend_id']]} is typing", flush=True)
        elif event == "message":
            print(f"\n{self.label(data['friend_id'])}")
            if quoted := self.quote(data.get("reply_to")):
                print(f"   ↪ replying to {quoted}")
            print(textwrap.indent(textwrap.fill(data["text"], width=80), "   "))
            if data["mentions"]:
                print(f"   @ mentions: {', '.join(self.names.get(m, m) for m in data['mentions'])}")
        elif event == "reaction":
            print(f"   {data['emoji']}  {self.names[data['friend_id']]} reacted to {self.quote(data['message_id'])}")
        elif event == "safety":
            print("\n" + "=" * 80 + f"\n💙 {data['helpline_text']}\n" + "=" * 80)
        elif event == "your_turn":
            print()

    def poll(self, poll: dict) -> None:
        print(f"\n📊 POLL: {poll['question']}")
        total = len(poll["votes"])
        for option in poll["options"]:
            voters = [v for v in poll["votes"] if v["option"] == option]
            bar = "█" * (len(voters) * 20 // max(total, 1))
            print(f"   {option:30} {bar} {len(voters)}")
        for v in poll["votes"]:
            print(f"   {self.label(v['friend_id'])} → {v['option']}: {v['reason']}")
        print()


# ---------------------------------------------------------------------------
# Chat loop
# ---------------------------------------------------------------------------
async def chat(friends: list[dict], language: str) -> None:
    history: list[dict] = []
    printer = Printer(friends, history)
    print(f"\nGroup created with {', '.join(printer.label(f['id']) for f in friends)} ({language}).")
    print('Type a message. "poll" = ask the group to vote, "quit" = leave.\n')

    while True:
        text = await asyncio.to_thread(read, "You: ")
        if not text:
            continue
        if text.lower() in ("quit", "exit"):
            return
        if len(text) > 1000:
            print("Keep it under 1000 characters.")
            continue

        try:
            if text.lower() == "poll":
                printer.poll(await summarize(ROOM, history=history, participants=friends, language=language))
                continue

            message_id = f"user-{uuid.uuid4().hex[:8]}"
            async for event, data in stream_turn(
                ROOM, message=text, message_id=message_id, history=history, participants=friends, language=language
            ):
                if event == "message":
                    if not any(m["id"] == message_id for m in history):
                        history.append({"id": message_id, "sender": "user", "text": text})
                    history.append({
                        "id": data["id"], "sender": data["friend_id"], "text": data["text"], "reply_to": data["reply_to"]
                    })
                printer.event(event, data)
            if not any(m["id"] == message_id for m in history):
                history.append({"id": message_id, "sender": "user", "text": text})
        except (ModelBusyError, SummaryError) as exc:
            print(f"\n⚠️  {exc}\n")


def main() -> None:
    # Emojis on Windows terminals: make sure printing never crashes.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    parser = argparse.ArgumentParser(description="Chat with Nth Opinion's AI friend group in the terminal.")
    parser.add_argument("--friends", help="Comma-separated friend ids, e.g. rohit,priya,meera")
    parser.add_argument("--language", choices=list(LANGUAGES))
    parser.add_argument("--quiet", action="store_true", help="Hide director decisions and node timings")
    args = parser.parse_args()

    # Show the director's decisions and node timings, e.g. "Director step 2: speak friend=rohit ...".
    logging.basicConfig(level=logging.WARNING if args.quiet else logging.INFO, format="   [%(name)s] %(message)s")
    for noisy in ("httpx", "google_genai", "nth_opinion.llm"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    friends = ask_friends(args.friends)
    language = ask_language(args.language)
    try:
        asyncio.run(chat(friends, language))
    except (KeyboardInterrupt, EOFError):
        pass
    print("Bye! 👋")


if __name__ == "__main__":
    main()
