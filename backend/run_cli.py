"""Command-line runner for the AI Debate Arena.

Usage:  python run_cli.py
        python run_cli.py --topic "Your motion" --rounds 2
"""

import argparse
import textwrap

from graph import graph, initial_state


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


def main() -> None:
    parser = argparse.ArgumentParser(description="Run an AI debate in the terminal.")
    parser.add_argument("--topic", help="Debate motion (prompted if omitted)")
    parser.add_argument("--rounds", type=int, choices=[1, 2, 3], help="Rounds (prompted if omitted)")
    args = parser.parse_args()

    topic = args.topic or ask_topic()
    rounds = args.rounds or ask_rounds()

    print(f"\nMotion: {topic}\nRounds: {rounds}")

    # stream_mode="updates" yields {node_name: partial_state} after each node
    # finishes, so turns are printed as soon as each debater speaks.
    final: dict = {}
    for update in graph.stream(initial_state(topic, rounds), stream_mode="updates"):
        for node, changes in update.items():
            if node in ("pro", "con"):
                for turn in changes["transcript"]:
                    print_turn(turn)
                    if turn["speaker"] == "con" and turn["round"] == rounds:
                        print("\nJudge is deliberating...")
            elif node == "judge":
                final = changes

    print_verdict(final)


if __name__ == "__main__":
    main()
