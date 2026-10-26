"""The model chain, quota memory and thinking-level memory in llm.py (every model call is mocked)."""

import asyncio
from datetime import datetime, timedelta

import pytest
from langchain_google_genai.chat_models import GoogleInvalidRequestError, GoogleRateLimitError

import llm

PT = llm.QUOTA_TIMEZONE
DAILY = "429 RESOURCE_EXHAUSTED. Quota exceeded: quotaId 'GenerateRequestsPerDayPerProjectPerModel-FreeTier'. 'retryDelay': '597s'"
PER_MINUTE = "429 RESOURCE_EXHAUSTED. quotaId 'GenerateRequestsPerMinutePerProjectPerModel'. Please retry in 30s."


class Overloaded(Exception):
    code = 503


@pytest.fixture
def chain(monkeypatch):
    """Models a, b, c; each model's behaviour is a list of results/exceptions, one per call. Records every request."""
    monkeypatch.setattr(llm, "MODEL_CHAIN", ["a", "b", "c"])
    monkeypatch.setattr(llm, "_exhausted_until", {})
    monkeypatch.setattr(llm, "USAGE", llm.Counter())
    behaviour: dict[str, list] = {}
    requests: list[str] = []

    async def fake_invoke_model(model, messages, temperature, schema, config):
        requests.append(model)
        outcome = behaviour.get(model, ["ok"]).pop(0) if behaviour.get(model) else f"answer from {model}"
        if isinstance(outcome, BaseException):
            raise outcome
        return f"answer from {model}" if outcome == "ok" else outcome

    monkeypatch.setattr(llm, "_model", lambda name: name)  # the fake below receives the name
    monkeypatch.setattr(llm, "_invoke_model", fake_invoke_model)
    return behaviour, requests


def call(model: str = "a", **kwargs):
    return asyncio.run(llm.invoke([], temperature=0, model=model, **kwargs))


# --- configuration -------------------------------------------------------------------
@pytest.mark.parametrize(
    ("chain_env", "main", "fallback", "expected"),
    [
        ("x, y ,z", "main", "fb", ["x", "y", "z"]),  # the chain wins when set
        ("x,,x,y", "main", "", ["x", "y"]),  # blanks and duplicates dropped
        ("", "main", "fb", ["main", "fb"]),  # GEMINI_MODEL + GEMINI_FALLBACK_MODEL still work
        ("", "main", "", ["main"]),
        ("", "main", "main", ["main"]),
    ],
)
def test_parse_chain(chain_env, main, fallback, expected):
    assert llm.parse_chain(chain_env, main, fallback) == expected


def test_next_quota_reset_is_midnight_pacific():
    assert llm.next_quota_reset(datetime(2026, 10, 26, 15, 0, tzinfo=PT)) == datetime(2026, 10, 27, tzinfo=PT)
    assert llm.next_quota_reset(datetime(2026, 10, 26, 23, 59, tzinfo=PT)) == datetime(2026, 10, 27, tzinfo=PT)
    # Across the daylight-saving change (1 Nov 2026), still local midnight.
    assert llm.next_quota_reset(datetime(2026, 11, 1, 1, 30, tzinfo=PT)) == datetime(2026, 11, 2, tzinfo=PT)


def test_cooldowns():
    now = datetime(2026, 10, 26, 9, 0, tzinfo=PT)
    assert llm.quota_cooldown_until(Exception(DAILY), now) == datetime(2026, 10, 27, tzinfo=PT)  # daily: midnight, not 597s
    assert llm.quota_cooldown_until(Exception(PER_MINUTE), now) == now + timedelta(seconds=30)
    assert llm.quota_cooldown_until(Exception("Please retry in 9m57s"), now) == now + timedelta(seconds=597)
    assert llm.quota_cooldown_until(Exception("429 RESOURCE_EXHAUSTED"), now) == now + timedelta(seconds=60)


# --- the chain ---------------------------------------------------------------------
def test_quota_moves_down_the_chain_and_is_remembered(chain):
    behaviour, requests = chain
    behaviour["a"] = [GoogleRateLimitError(DAILY)]
    assert call() == "answer from b"
    assert requests == ["a", "b"]
    assert "a" in llm.exhausted_models()
    requests.clear()
    assert call() == "answer from b"
    assert requests == ["b"]  # no request wasted on a until its quota resets
    assert llm.USAGE == {"b": 2}


def test_everything_exhausted_sends_nothing(chain):
    behaviour, requests = chain
    for m in "abc":
        behaviour[m] = [GoogleRateLimitError(DAILY)]
    with pytest.raises(llm.ModelBusyError) as err:
        call()
    assert err.value.code == "quota_exhausted"
    requests.clear()
    with pytest.raises(llm.ModelBusyError) as err:
        call()
    assert err.value.code == "quota_exhausted" and requests == []


def test_quota_resets_at_midnight(chain, monkeypatch):
    behaviour, requests = chain
    behaviour["a"] = [GoogleRateLimitError(DAILY)]
    call()
    reset = llm._exhausted_until["a"]
    monkeypatch.setattr(llm, "_now", lambda: reset + timedelta(seconds=1))
    requests.clear()
    assert call() == "answer from a"
    assert requests == ["a"]


def test_overloaded_model_is_skipped_once_but_not_remembered(chain):
    behaviour, requests = chain
    behaviour["a"] = [Overloaded("503 overloaded")]
    assert call() == "answer from b"
    assert llm.exhausted_models() == {}
    requests.clear()
    assert call() == "answer from a"
    assert requests == ["a"]


def test_other_errors_are_not_retried_on_other_models(chain):
    behaviour, requests = chain
    behaviour["a"] = [ValueError("bad request")]
    with pytest.raises(ValueError):
        call()
    assert requests == ["a"]


def test_timeouts_are_not_retried(chain):
    behaviour, requests = chain
    behaviour["a"] = [llm.ModelBusyError()]
    with pytest.raises(llm.ModelBusyError):
        call()
    assert requests == ["a"]


def test_explicit_model_then_chain_and_use_chain_false(chain):
    behaviour, requests = chain
    assert llm.candidates("director") == ["director", "a", "b", "c"]
    behaviour["judge"] = [GoogleRateLimitError(DAILY)]
    with pytest.raises(llm.ModelBusyError):
        call("judge", use_chain=False)
    assert requests == ["judge"]  # never fell back to the models being judged


def test_last_error_decides_the_code(chain):
    behaviour, _ = chain
    behaviour["a"] = [GoogleRateLimitError(DAILY)]
    behaviour["b"] = [Overloaded("503")]
    behaviour["c"] = [GoogleRateLimitError(PER_MINUTE)]
    with pytest.raises(llm.ModelBusyError) as err:
        call()
    assert err.value.code == "quota_exhausted"


# --- thinking level -------------------------------------------------------------------
class FakeGemini(llm._Gemini):
    """A model that rejects thinking_level "minimal" and accepts "low"."""

    def __init__(self):
        self.name = "fake"
        self._levels = ["minimal", "low", None]
        self.requests: list[str | None] = []

    def llm(self, temperature, schema):
        level = self.thinking_level
        model = self

        class Client:
            async def ainvoke(self, messages, config=None):
                model.requests.append(level)
                await asyncio.sleep(0)  # let concurrent calls interleave
                if level == "minimal":
                    raise GoogleInvalidRequestError("thinking_level 'minimal' is not supported for this model")
                return "ok"

        return Client()


def test_rejected_thinking_level_is_remembered():
    model = FakeGemini()
    assert asyncio.run(llm._invoke_model(model, [], 0, None, {})) == "ok"
    assert model.requests == ["minimal", "low"]
    assert model.thinking_level == "low"
    model.requests.clear()
    asyncio.run(llm._invoke_model(model, [], 0, None, {}))
    assert model.requests == ["low"]  # no failing request first any more


def test_concurrent_rejections_step_down_only_once():
    model = FakeGemini()

    async def both():
        return await asyncio.gather(llm._invoke_model(model, [], 0, None, {}), llm._invoke_model(model, [], 0, None, {}))

    assert asyncio.run(both()) == ["ok", "ok"]
    assert model.thinking_level == "low"  # not skipped past "low" to the default
