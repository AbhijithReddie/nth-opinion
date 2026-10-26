"""The evaluation suites, in the order "all" runs them (performance last, so it can reuse earlier turns)."""

from evals.suites import (
    debate_judge_bias,
    director_quality,
    language_adherence,
    performance,
    persona_consistency,
    prompt_injection,
    safety,
)

SUITES = {
    "persona_consistency": persona_consistency,
    "safety": safety,
    "prompt_injection": prompt_injection,
    "director_quality": director_quality,
    "debate_judge_bias": debate_judge_bias,
    "language_adherence": language_adherence,
    "performance": performance,
}
