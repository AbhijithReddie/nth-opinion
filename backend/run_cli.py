"""Command-line runner for the AI Debate Arena.

Usage:  python run_cli.py
        python run_cli.py --topic "Your motion" --rounds 2
"""

import argparse
import asyncio
import logging
import sys
import textwrap

from graph import ModelBusyError, graph, initial_state


def ask_topic() -> str:
    while True:
        topic = input("Debate topic: ").lstrip("﻿").strip()  # drop BOM PowerShell adds to piped input
        if topic:
            return topic
        print("Please enter a topic.")


def ask_rounds() -> int:
    while True:
        raw = input("Number of rounds (1-3): ").strip()
        if raw in {"1", "2", "3"}:
            return int(raw)
        print("Please enter 1, 2 or 3.")


def print_turn(turn: dict) -> None:
    label = "PRO (for)" if turn["speaker"] == "pro" else "CON (against)"
    print(f"\n--- Round {turn['round']} | {label} ---")
    print(textwrap.fill(turn["text"], width=88))


def print_verdict(result: dict) -> None:
    print("\n" + "=" * 88)
    print("JUDGE'S VERDICT")
    print("=" * 88)
    print(f"{'':10}{'Logic':>8}{'Evidence':>10}{'Rebuttal':>10}{'Total':>8}")
    for side in ("pro", "con"):
        s = result["scores"][side]
        total = s["logic"] + s["evidence"] + s["rebuttal"]
        print(f"{side.upper():10}{s['logic']:>8}{s['evidence']:>10}{s['rebuttal']:>10}{total:>8}")
    print(f"\nWinner: {result['winner'].upper()}")
    print("\nDecision memo:")
    print(textwrap.fill(result["memo"], width=88))


async def run_debate(topic: str, rounds: int) -> dict:
    """Run the debate, printing each turn as soon as it is spoken. Returns the judge's result."""
    # The nodes are async (so each model call can time out cleanly), hence astream.
    # stream_mode="updates" yields {node_name: partial_state} after each node
    # finishes, so turns are printed as soon as each debater speaks.
    final: dict = {}
    async for update in graph.astream(initial_state(topic, rounds), stream_mode="updates"):
        for node, changes in update.items():
            if node in ("pro", "con"):
                for turn in changes["transcript"]:
                    print_turn(turn)
                    if turn["speaker"] == "con" and turn["round"] == rounds:
                        print("\nJudge is deliberating...")
            elif node == "judge":
                final = changes
    return final


def main() -> None:
    # Show graph.py's timing and fallback messages, e.g. "Node pro finished in 4.2s".
    logging.basicConfig(level=logging.INFO, format="  [%(levelname)s] %(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)  # skip a log line per HTTP request
    logging.getLogger("google_genai").setLevel(logging.WARNING)  # skip "AFC is enabled" per call

    parser = argparse.ArgumentParser(description="Run an AI debate in the terminal.")
    parser.add_argument("--topic", help="Debate motion (prompted if omitted)")
    parser.add_argument("--rounds", type=int, choices=[1, 2, 3], help="Rounds (prompted if omitted)")
    args = parser.parse_args()

    topic = args.topic or ask_topic()
    rounds = args.rounds or ask_rounds()

    print(f"\nMotion: {topic}\nRounds: {rounds}")

    try:
        final = asyncio.run(run_debate(topic, rounds))
    except ModelBusyError as exc:
        sys.exit(f"\n{exc}")

    print_verdict(final)


if __name__ == "__main__":
    main()
