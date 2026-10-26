"""The per-IP sliding-window rate limiter."""

import main


def test_allows_up_to_the_limit_then_blocks():
    limiter = main.RateLimiter(3, "slow down")
    assert [limiter.allow("1.1.1.1") for _ in range(4)] == [True, True, True, False]
    assert limiter.allow("2.2.2.2")  # other IPs have their own count


def test_window_slides(monkeypatch):
    now = [1000.0]
    monkeypatch.setattr(main.time, "monotonic", lambda: now[0])
    limiter = main.RateLimiter(2, "slow down")
    assert limiter.allow("ip") and limiter.allow("ip")
    assert not limiter.allow("ip")
    now[0] += main.RATE_WINDOW_SECONDS + 1  # an hour later the old requests have expired
    assert limiter.allow("ip")


def test_reject_is_a_friendly_429():
    response = main.RateLimiter(1, "Take a breather.").reject("ip", "test")
    assert response.status_code == 429
    assert response.body == b'{"detail":"Take a breather."}'


def test_debate_endpoint_limit(client, fake_llm):
    body = {"topic": "Pineapple belongs on pizza", "rounds": 1}
    codes = [client.post("/api/debate", json=body).status_code for _ in range(main.debate_limiter.limit + 1)]
    assert codes[:-1] == [200] * main.debate_limiter.limit and codes[-1] == 429
