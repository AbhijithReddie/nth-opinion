"""Every evaluation suite's evaluators must be accepted by LangSmith's evaluate().

LangSmith matches evaluator parameters BY NAME, so a parameter called anything
else (e.g. `reference` instead of `reference_outputs`) fails at run time with
"Invalid evaluator function". These checks catch that without any AI calls.
"""

import asyncio
import inspect

import pytest
from langsmith.evaluation import run_evaluator

from evals.suites import SUITES

SUPPORTED = {"run", "example", "inputs", "outputs", "reference_outputs", "attachments"}

ALL = [(suite, fn) for suite, module in SUITES.items() for fn in module.EVALUATORS]
IDS = [f"{suite}.{fn.__name__}" for suite, fn in ALL]


def test_every_suite_lists_its_evaluators():
    for suite, module in SUITES.items():
        assert module.EVALUATORS, f"{suite} has no EVALUATORS"
        # run() must pass exactly that list to run_cases (and so to evaluate()).
        source = inspect.getsource(module.run)
        assert "EVALUATORS)" in source, f"{suite}.run() should call run_cases(..., EVALUATORS)"


@pytest.mark.parametrize(("suite", "fn"), ALL, ids=IDS)
def test_evaluator_signature(suite, fn):
    # A plain, named function: no functools.partial, lambda or signature-hiding wrapper.
    assert inspect.isfunction(fn), f"{suite}: {fn!r} is not a plain function"
    assert fn.__name__ != "<lambda>"
    assert not hasattr(fn, "__wrapped__"), f"{suite}.{fn.__name__} is wrapped by a decorator"
    params = inspect.signature(fn).parameters.values()
    assert params, f"{suite}.{fn.__name__} takes no arguments"
    for p in params:
        assert p.kind in (p.POSITIONAL_OR_KEYWORD, p.KEYWORD_ONLY), f"{suite}.{fn.__name__}: no *args or **kwargs"
        assert p.name in SUPPORTED, f"{suite}.{fn.__name__}: unsupported parameter {p.name!r}"


@pytest.mark.parametrize(("suite", "fn"), ALL, ids=IDS)
def test_langsmith_accepts_evaluator(suite, fn):
    # The same wrapping evaluate() / aevaluate() does; raises "Invalid evaluator function" on a bad signature.
    run_evaluator(fn)


# Deterministic evaluators, run on tiny made-up outputs: each returns {"key", "score", "comment"}.
DETERMINISTIC = {
    "safety_event": ({"group": "crisis", "message": "x"}, {"safety_event": True, "messages": []}, {"safety_event": True}),
    "no_leak": ({"channel": "user_message"}, {"messages": ["Hello there"]}, {}),
    "deterministic": ({"channel": "document"}, {"flagged": True, "messages": []}, {}),
    "check": (
        {"room": "group-chat"},
        {"turns": [{"new_topic": True, "speakers": ["rohit", "priya", "meera"], "safety": False}]},
        {},
    ),
    "consistent": ({}, {"original": {"winner": "pro"}, "negated": {"winner": "con"}}, {}),
    "longer_won": ({}, {"original": {"winner": "pro", "pro_words": 120, "con_words": 90}, "negated": {"winner": "tie", "pro_words": 1, "con_words": 2}}, {}),
    "roman_script": ({"language": "hinglish"}, {"messages": ["Haan yaar", "सही बात"]}, {}),
    "completed": ({}, {"duration_ms": 1200.0, "calls": 7}, {}),
}


@pytest.mark.parametrize(("suite", "fn"), [(s, f) for s, f in ALL if f.__name__ in DETERMINISTIC], ids=lambda x: getattr(x, "__name__", x))
def test_deterministic_evaluators_return_key_score_comment(suite, fn):
    inputs, outputs, reference_outputs = DETERMINISTIC[fn.__name__]
    result = fn(inputs=inputs, outputs=outputs, reference_outputs=reference_outputs)
    if inspect.isawaitable(result):
        result = asyncio.run(result)
    assert set(result) == {"key", "score", "comment"}
    assert isinstance(result["key"], str) and isinstance(result["comment"], str)
    assert result["score"] is None or 0 <= result["score"] <= 1


def test_roman_script_catches_devanagari():
    from evals.suites.language_adherence import roman_script

    result = roman_script(inputs={}, outputs={"messages": ["Haan yaar", "सही बात"]}, reference_outputs={})
    assert result["score"] == 0.5


@pytest.mark.parametrize(
    "native",
    ["सही बात", "সঠিক কথা", "சரி தான்", "సరి అయింది", "ಸರಿ ಗುರು", "ശരി ആണ്"],  # Hindi/Marathi, Bengali, Tamil, Telugu, Kannada, Malayalam
)
def test_native_scripts_are_caught(native):
    from evals.suites.language_adherence import roman_script

    assert roman_script(inputs={}, outputs={"messages": [native]}, reference_outputs={})["score"] == 0
    assert roman_script(inputs={}, outputs={"messages": ["Machan, sema idea da"]}, reference_outputs={})["score"] == 1
