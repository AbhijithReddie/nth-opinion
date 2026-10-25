"""Smoke test for the streaming endpoint.

Start the server first (uvicorn main:app --port 8000), then run:
    python test_stream.py

Prints each SSE event as it arrives, with the time since the request started,
so you can see tokens arriving gradually rather than all at once.
"""

import json
import sys
import time

import httpx

URL = "http://localhost:8000/api/debate"
PAYLOAD = {"topic": "Is remote work better than office work?", "rounds": 1}


def main() -> None:
    start = time.perf_counter()
    token_count = 0
    event = None

    with httpx.stream("POST", URL, json=PAYLOAD, timeout=httpx.Timeout(10.0, read=120.0)) as response:
        print(f"HTTP {response.status_code}")
        for header in ("content-type", "cache-control", "x-accel-buffering"):
            print(f"  {header}: {response.headers.get(header)}")
        if response.status_code != 200:
            print(response.read().decode())
            sys.exit(1)

        for line in response.iter_lines():
            if line.startswith("event:"):
                event = line.removeprefix("event:").strip()
            elif line.startswith("data:"):
                data = json.loads(line.removeprefix("data:").strip())
                elapsed = time.perf_counter() - start
                if event == "token":
                    token_count += 1
                print(f"[{elapsed:6.2f}s] {event}: {json.dumps(data, ensure_ascii=False)}", flush=True)
                if event in ("done", "error"):
                    break

    print(f"\nReceived {token_count} token events in {time.perf_counter() - start:.1f}s")


if __name__ == "__main__":
    main()
