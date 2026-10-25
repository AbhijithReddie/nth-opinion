# AI Debate Arena

Two AI debaters (PRO and CON) argue a motion for 1-3 rounds, then an AI judge
scores both sides and writes a decision memo. The debate is a LangGraph state
machine (`backend/graph.py`) served by a FastAPI backend that streams the
debate token-by-token over Server-Sent Events.

## Running the backend on Windows

All commands are for PowerShell, run from the `backend` folder.

### 1. Set up a virtual environment and install dependencies

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

If PowerShell refuses to run `Activate.ps1`, allow local scripts for your user once:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

### 2. Configure environment variables

```powershell
Copy-Item .env.example .env
notepad .env
```

| Variable            | Purpose                                                        |
| ------------------- | -------------------------------------------------------------- |
| `GOOGLE_API_KEY`    | Gemini API key (required)                                      |
| `GEMINI_MODEL`      | Gemini model name                                              |
| `LANGSMITH_TRACING` | `true` to send traces to LangSmith, `false` to disable         |
| `LANGSMITH_API_KEY` | LangSmith API key (only needed when tracing is on)             |
| `LANGSMITH_PROJECT` | LangSmith project name                                         |
| `FRONTEND_ORIGIN`   | Allowed CORS origins, comma-separated (default `http://localhost:3000`) |

`.env` is git-ignored; never commit it.

### 3. Start the server

```powershell
uvicorn main:app --port 8000 --reload
```

Check it is up: open <http://localhost:8000/health> (should show `{"status":"ok"}`),
or see the interactive API docs at <http://localhost:8000/docs>.

### 4. Test the stream

In a second PowerShell window (with the venv activated):

```powershell
python test_stream.py
```

This runs a 1-round debate on "Is remote work better than office work?" and
prints every event with a timestamp as it arrives.

### Terminal-only mode

You can also run a debate without the server:

```powershell
python run_cli.py --topic "Should homework be banned?" --rounds 2
```

## API

### `GET /health`

Returns `{"status": "ok"}`.

### `POST /api/debate`

Request body:

```json
{ "topic": "Is remote work better than office work?", "rounds": 2 }
```

- `topic`: 5-200 characters
- `rounds`: 1-3

The response is an SSE stream (`text/event-stream`). Each event's `data` is JSON:

| Event        | Data                                                      |
| ------------ | --------------------------------------------------------- |
| `turn_start` | `{"speaker": "pro" \| "con", "round": 1}`                 |
| `token`      | `{"speaker": "pro" \| "con", "text": "chunk"}`            |
| `turn_end`   | `{"speaker", "round", "text"}` — the final text for that turn |
| `judge`      | `{"scores": {"pro": {...}, "con": {...}}, "winner": "pro" \| "con" \| "tie", "memo": "..."}` |
| `done`       | `{}`                                                      |
| `error`      | `{"message": "..."}`                                      |

Use the `turn_end` text as the final version of a turn: it has the 150-word
limit applied, so it can be slightly shorter than the streamed tokens.

Errors before the stream starts are returned as JSON `{"detail": "..."}`:
`422` for invalid input, `429` when an IP has started more than 5 debates in
the past hour.

**Deploying behind a proxy:** run uvicorn with `--proxy-headers` (and
`--forwarded-allow-ips` set to your proxy) so rate limiting sees the real
client IP. The rate limiter is in-memory, so it resets on restart and is per
process.
