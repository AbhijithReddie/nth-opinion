# Nth Opinion

<!-- Replace your-username/nth-opinion with your GitHub repository (also GITHUB_URL in frontend/src/config/site.ts). -->
[![Tests](https://github.com/your-username/nth-opinion/actions/workflows/tests.yml/badge.svg)](https://github.com/your-username/nth-opinion/actions/workflows/tests.yml)

**Why stop at a second?**

One question. A room full of AI minds.

Nth Opinion is a multi-agent platform: you bring a problem, and a room of AI
personas with different personalities talks it through with you. A director
agent decides who speaks next, so conversations flow naturally instead of
going round-robin.

| Room | Status |
| ---- | ------ |
| **Debate Arena**: PRO and CON argue any motion for 1-3 rounds, then a judge scores them | Live |
| **The Group Chat**: share a problem with a WhatsApp-style group of AI friends | Live |
| **Pitch Tank**: pitch your startup to 3 investors who grill you, then make offers | Live |
| **Roast & Toast**: your resume or project gets roasted, then gets real feedback and a scorecard | Live |
| **Interview Panel**: HR, a tech lead and a skeptical manager interview you from your resume | Live |
| **Future You**: you at 30 and you at 50 talk through a decision with you now | Live |
| **Study Group**: learn a topic with a confused friend, the class topper and a meme-maker, then get quizzed | Live |

The backend is FastAPI + LangGraph (Gemini models, optional LangSmith tracing),
streaming over Server-Sent Events. The frontend is Next.js + Tailwind.

## Backend layout

```
backend/
  llm.py              shared Gemini setup: models, thinking level, fallback, timeouts, timing logs
  graph.py            Debate Arena graph (pro -> con -> ... -> judge)
  main.py             FastAPI app: /api/debate and /api/rooms/*
  agent_trace.py      "Behind the scenes" trace events (node starts/ends, decisions, safety mode)
  languages.py        the shared language registry (GET /api/languages)
  tts.py              optional AI voices for "Read replies aloud" (POST /api/tts)
  persona_builder.py  "Build your own friend": a custom persona from a short description
  documents.py        document uploads: type detection, PDF/DOCX/TXT extraction, the digest
  samples/            made-up sample documents (resume, job description, pitch deck) for replays and evals
  evals/              evaluation suites (python -m evals.run): datasets/, suites/, common.py, run.py
  tests/              unit tests (pytest): no API keys, no LLM calls
  rooms/
    __init__.py       registers every room
    engine.py         the shared room engine (LangGraph director loop, summary)
    safety.py         crisis detection, supportive mode, guardrails for every persona
    group_chat.py     The Group Chat room: personas, languages, poll
    shark_tank.py     The Pitch Tank room (backend id "shark-tank"): investors, pitch details, offers
    roast_and_toast.py  Roast & Toast: panel, roast/toast modes, pasted material, scorecard
    interview_panel.py  Interview Panel: interviewers, role + resume, hire/no-hire result
    future_you.py       Future You: two future selves, age check, letters + next steps
    study_group.py      Study Group: learn/quiz modes, topic + notes, study notes with a self-test
  run_cli.py          Debate Arena in the terminal
  chat_cli.py         Group Chat in the terminal
  record_replays.py   records the demo replays (see "Demo replay mode")
  test_stream.py      smoke test for the debate SSE stream
```

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

| Variable                | Purpose                                                        |
| ----------------------- | -------------------------------------------------------------- |
| `GOOGLE_API_KEY`        | Gemini API key (required)                                      |
| `GEMINI_MODEL`          | Gemini model for debaters, the judge and room personas         |
| `GEMINI_FALLBACK_MODEL` | Optional model tried once when the main one is overloaded      |
| `DIRECTOR_MODEL`        | Optional model for room directors and the safety check (default: `GEMINI_MODEL`) |
| `LANGSMITH_TRACING`     | `true` to send traces to LangSmith, `false` to disable         |
| `LANGSMITH_API_KEY`     | LangSmith API key (only needed when tracing is on)             |
| `LANGSMITH_PROJECT`     | LangSmith project name                                         |
| `FRONTEND_ORIGIN`       | Allowed CORS origins, comma-separated (default `http://localhost:3000`) |

`.env` is git-ignored; never commit it.

### 3. Start the server

```powershell
uvicorn main:app --port 8000 --reload
```

Check it is up: open <http://localhost:8000/health> (should show `{"status":"ok"}`),
or see the interactive API docs at <http://localhost:8000/docs>.

### 4. Test the debate stream

In a second PowerShell window (with the venv activated):

```powershell
python test_stream.py
```

This runs a 1-round debate on "Is remote work better than office work?" and
prints every event with a timestamp as it arrives.

### Terminal-only mode

Run a debate or a group chat without the server:

```powershell
python run_cli.py --topic "Should homework be banned?" --rounds 2
python chat_cli.py
python chat_cli.py --friends rohit,priya,vikram --language hinglish
```

In `chat_cli.py`, type messages and press Enter. Type `poll` to ask the group
to vote and `quit` to leave. Each director decision and node timing is logged
(add `--quiet` to hide them).

## Running the frontend on Windows

In a new PowerShell window:

```powershell
cd frontend
npm install
Copy-Item .env.example .env.local   # only the first time; edit if your backend isn't on localhost:8000
npm run dev
```

Open <http://localhost:3000>. Restart `npm run dev` after editing `globals.css`
if the styles look stale.

**Keep the project out of OneDrive (or exclude `.next` and `node_modules` from
syncing).** OneDrive can lock or turn build files into cloud placeholders,
which shows up as stale dev-server errors or `EPERM ... unlink` during
`npm run build`. Moving the folder, e.g. to `C:\dev\debate-arena`, avoids it.

| Route | Page |
| ----- | ---- |
| `/` | Home: hero, room grid, how it works |
| `/debate` | Debate Arena |
| `/rooms/group-chat` | The Group Chat |
| `/rooms/pitch-tank` | Pitch Tank (`/rooms/shark-tank` redirects here) |
| `/rooms/roast-and-toast` | Roast & Toast |
| `/rooms/interview-panel` | Interview Panel |
| `/rooms/future-you` | Future You |
| `/rooms/study-group` | Study Group |
| `/about` | About, agent diagram, disclaimer |

### Frontend layout

```
frontend/
  public/                 nth-opinion-logo.svg (logo + wordmark), nth-opinion-icon.svg, favicon.svg
  public/replays/         recorded demo conversations, one <room-id>.json per room
  src/config/
    rooms.ts              every room's id, title, icon, description, status and route
    personas.ts           each chat room's personas (ids match the backend)
    roomChats.ts          per-room chat config: cast rules, setup fields, wording, summary type
    site.ts               name, tagline, GitHub URL (placeholder), disclaimer
  src/app/                routes (see table above) + opengraph-image.tsx (link preview)
  src/components/
    layout/               Navbar, Rooms dropdown, mobile drawer
    home/ about/ rooms/   page sections, coming-soon page
    chat/                 shared chat-room UI (setup screen, messages, poll / offers cards, composer, ...)
    debate/ landing/      Debate Arena UI
    ui/ brand/            buttons, badges, headings, the logo mark
    replay/               demo replay controls, "watch the demo" notices, the replaying chat room
  src/hooks/useRoomChat.ts    chat state, SSE pacing, cancel-on-new-message, localStorage
  src/lib/sseClient.ts        shared POST + SSE reader used by the debate and the rooms
  src/lib/replay.ts           demo replay mode: loading recordings, the replay clock, playback
  src/lib/trace.ts            "Behind the scenes": trace event types and the panel's reducer
  src/config/flows.ts         each room's agent diagram for the "Behind the scenes" panel
  src/components/trace/       the "Behind the scenes" panel, diagram, mobile sheet and toggle
  src/components/share/       shareable result cards: the card and the share dialog
  src/components/friends/     My Friends page: persona builder, preview, edit, generated avatars
  src/lib/customPersonas.ts   the user's own personas: storage (localStorage), API client, avatar mapping
  src/lib/documents.ts        document uploads: upload with progress, pasted text, in-memory store per room
  src/lib/report/             "Download PDF report" (@react-pdf/renderer, loaded on click)
  public/fonts/               the site fonts as WOFF/TTF for the PDF reports (OFL licences)
  src/lib/share.ts            share cards: privacy redaction, PNG generation, share/download helpers
  src/lib/og.tsx              link-preview images (opengraph-image / twitter-image for home and every room)
```

To list a new room, add it to `src/config/rooms.ts`. The navbar, home grid
and coming-soon pages pick it up automatically. To announce a room before it's
built, give it `status: "soon"` and a page that renders
`<ComingSoon roomId="..." />` (see `components/rooms/ComingSoon.tsx`).

### Design system

The tokens live in `src/app/globals.css`:

- **Surfaces:** a near-black `arena-950` to `arena-600` scale
- **Text:** `ink`, `muted`, `faint`
- **Brand:** violet (`brand`), the logo's speech bubble
- **Accents:** `cyan`, `coral` and `gold`, the logo's three AI figures. The Debate Arena maps Pro, Con and Judge onto them.
- **Support:** a calm blue, used only for wellbeing messages
- **Type:** Bricolage Grotesque for headlines, Geist for text, Geist Mono for small labels
- **Components:** `components/ui` holds the shared Button, StatusBadge and SectionHeading

## How rooms work

Every room runs on the same LangGraph loop (`backend/rooms/engine.py`):

```
START -> safety_check -> director --speak--> friend_speaks --> director
                                  --react--> friend_reacts --> director
                                  --end----> your_turn -> END
```

1. **safety_check** classifies the user's latest message as `normal` or
   `crisis` (self-harm, suicidal thoughts, abuse, immediate danger) with a
   structured-output LLM call. If the classifier itself fails, a keyword check
   is used instead. On a crisis, every persona switches to a gentle,
   supportive mode, the client gets a `safety` event with the Tele-MANAS
   helpline, and the turn ends after 2-3 supportive messages.
2. **director** sees the conversation (with message ids), who has spoken
   this turn and the room's rules. It returns a structured decision: `speak`
   (who, which message to reply to, a short note), `react` (who, which
   message, which emoji) or `end`. It is not round-robin: it picks whoever
   would naturally respond. The engine then enforces the hard rules in code:
   - nobody sends more than 2 messages in a row
   - at most 6 messages and 4 reactions per user message
   - at least one reply, and on a brand-new topic everyone speaks once
   - ids must be valid
   A bad decision is corrected, never fatal.
3. **friend_speaks** writes one short message in that persona's voice and
   the chosen language. **friend_reacts** adds an emoji.
4. **your_turn** tells the client it's the user's turn.

Nodes push `typing`, `message`, `reaction`, `safety` and `your_turn` events
through LangGraph's custom stream as they happen. The API is stateless: the
client sends recent history with each message, and only the last 40 messages
are used.

### Adding a room

A room is mostly a config file. The live chat rooms are good templates:

- `group_chat.py`: a pickable, renamable cast, plus a poll
- `shark_tank.py`: a fixed panel, context fields and structured offers
- `roast_and_toast.py`: modes, a large pasted context field and a scorecard
- `interview_panel.py`: one question at a time (`everyone_speaks_on_new_topic=False`), no reactions
- `future_you.py`: a two-persona cast and a `context_validator`
- `study_group.py`: learn/quiz modes and study notes

A trimmed-down version of `study_group.py` shows the shape:

1. Create `backend/rooms/<your_room>.py`:

   ```python
   from pydantic import BaseModel, Field
   from rooms.engine import ContextField, Mode, Persona, RoomConfig, SummarySpec, register_room

   PERSONAS = (
       Persona(id="topper", name="Ishaan", emoji="🏆", color="#F6C453",
               tagline="Explains it properly",
               personality="...", speaking_style="...", stance="..."),
       # ... more personas
   )

   class Recap(BaseModel):           # the final structured output
       key_points: list[str]
       quiz: list[str] = Field(description="3 quick questions")

   STUDY_GROUP = register_room(RoomConfig(
       id="study-group",
       title="Study Group",
       description="Learn a topic with a confused friend, the class topper and a meme-maker.",
       personas=PERSONAS,
       languages={"english": "Casual English."},
       min_participants=3, max_participants=3,
       context_fields=(ContextField(id="topic", label="Topic", max_length=120),),
       speaker_instructions="You're in a study group helping the user learn the topic...",
       director_instructions="The topper explains, the confused friend asks what the user might not...",
       modes=(  # optional phases; the director switches with next_mode, the client can too
           Mode(id="learn", title="Learn", instructions="Explain step by step.", director_hint="Start here."),
           Mode(id="quiz", title="Quiz", instructions="Ask the user questions.", director_hint="After the basics."),
       ),
       summary=SummarySpec(schema=Recap, instructions="Recap what was covered...",
                           finalize=lambda result, participants: result.model_dump()),
   ))
   ```

2. Import it in `backend/rooms/__init__.py`.

That's it. `GET /api/rooms` lists it, and `/api/rooms/study-group/message`
and `/summary` work right away with the same safety layer, director loop,
streaming, validation and rate limits. Tunables such as `max_messages`,
`max_reactions` (0 turns reactions off), `max_in_a_row`, `max_words`,
`reaction_emojis` and `everyone_speaks_on_new_topic` have defaults on
`RoomConfig` and can be overridden per room. `everyone_speaks_on_new_topic` is
on by default, so every persona speaks on a new topic; the Interview Panel
turns it off so it asks one question at a time.

If a room needs details from the user (a startup's name and ask, a resume, a
study topic), declare them as `context_fields`:

```python
context_fields=(
    ContextField(id="startup", label="Startup name", max_length=60),
    ContextField(id="ask", label="The founder's ask", max_length=80),
),
```

Clients send them as `"context": {"startup": "...", "ask": "..."}`. The API
validates them, and the engine shows them to the director, every persona and
the summary. See `shark_tank.py`. For checks across fields or on their
format, set `context_validator` on the room: a function that takes the context
and returns an error message or `None`. Future You uses one to keep the age
between 13 and 29. On the frontend, a context field can have a matching
`validate` function so the setup screen catches the problem early.

**Frontend:** a chat room needs:

1. An entry in `frontend/src/config/roomChats.ts` (cast, setup fields, wording, summary type).
2. Its personas in `config/personas.ts`.
3. A page that renders `<RoomChatLoader roomId="..." />`.
4. Its status set to `"live"` in `config/rooms.ts`.

A new kind of summary also needs a card component in `components/chat/`.

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
- `behind_the_scenes` (optional, default `false`): also stream trace events (see "Behind the scenes mode")

The response is an SSE stream (`text/event-stream`). Each event's `data` is JSON:

| Event        | Data                                                      |
| ------------ | --------------------------------------------------------- |
| `turn_start` | `{"speaker": "pro" \| "con", "round": 1}`                 |
| `token`      | `{"speaker": "pro" \| "con", "text": "chunk"}`            |
| `turn_end`   | `{"speaker", "round", "text"}`: the final text for that turn |
| `judge`      | `{"scores": {"pro": {...}, "con": {...}}, "winner": "pro" \| "con" \| "tie", "memo": "..."}` |
| `done`       | `{}`                                                      |
| `error`      | `{"message": "...", "code": "quota_exhausted"}` (or `"model_unavailable"`) |

Use the `turn_end` text as the final version of a turn: it has the 150-word
limit applied, so it can be slightly shorter than the streamed tokens.

### `GET /api/rooms`

Lists the rooms with their personas (id, name, emoji, colour, tagline),
participant limits, languages and modes.

### `POST /api/rooms/{room_id}/message`

```json
{
  "message": "Should I text my ex happy birthday?",
  "message_id": "u-123",
  "history": [
    { "id": "u-122", "sender": "user", "text": "hey guys" },
    { "id": "rohit-a1b2c3d4", "sender": "rohit", "text": "what now 🙄", "reply_to": "u-122" }
  ],
  "friends": [
    { "id": "rohit", "name": "Rohit" },
    { "id": "priya", "name": "Priya" },
    { "id": "meera", "name": "Didi" }
  ],
  "language": "english"
}
```

- `message`: 1-1000 characters
- `message_id`: optional, the client's id for this message, so friends' replies can point to it
- `friends`: 3-4 of `rohit`, `priya`, `vikram`, `ananya`, `arjun`, `meera`, with names of 1-20 characters
- `language`: `english`, `hinglish` or `tenglish`
- `history`: earlier messages (only the last 40 are used)
- `behind_the_scenes` (optional, default `false`): also stream trace events (see "Behind the scenes mode")

SSE events:

| Event       | Data |
| ----------- | ---- |
| `typing`    | `{"friend_id"}` |
| `message`   | `{"id", "friend_id", "text", "reply_to": id \| null, "mentions": [friend ids or "user"], "emotion"}` (emotion: happy, excited, thoughtful, annoyed, concerned or neutral; for call mode) |
| `reaction`  | `{"friend_id", "message_id", "emoji"}` |
| `safety`    | `{"helpline_text"}` |
| `mode`      | `{"mode"}`: the director switched modes (rooms with modes only) |
| `your_turn` | `{}`: the turn is over |
| `error`     | `{"message", "code"}` (see Errors and limits) |

If the client disconnects (for example the user sends a new message
mid-reply and the browser aborts the request), generation stops.

Rooms with context fields also need `context`. Pitch Tank (`shark-tank`) requires
`{"startup": "...", "ask": "..."}`, and `sector` is optional. The participants
must be exactly `kavya`, `aditya` and `rustom`. Sending `participants` instead
of `friends` also works.

### `POST /api/rooms/{room_id}/summary`

Same body without `message`. The Group Chat returns a poll:

```json
{
  "question": "Should you text your ex?",
  "options": ["Text a short wish", "Don't text"],
  "votes": [ { "friend_id": "rohit", "option": "Don't text", "reason": "bro. no. we talked about this." } ]
}
```

Rooms with modes (Roast & Toast: `roast`, then `toast`) take an optional
`"mode"` field with each message. The client sends back the latest mode it got
from a `mode` event, or a different one when the user switches. A missing or
unknown mode starts at the first one. Roast & Toast also requires the context
fields `title` and `material` (pasted text, up to 6,000 characters), and
`goal` is optional.

Pitch Tank returns the investors' decisions (amounts in ₹ lakhs). An offer
without a valid amount and equity is turned into `"out"`:

```json
{
  "summary": "Real traction, thin moat.",
  "strengths": ["₹8 lakh monthly revenue"],
  "concerns": ["Easy to copy"],
  "decisions": [
    { "friend_id": "kavya", "decision": "offer", "amount_lakh": 50, "equity_percent": 10,
      "conditions": "2% royalty until recouped", "reason": "Your numbers hold up." },
    { "friend_id": "rustom", "decision": "out", "amount_lakh": null, "equity_percent": null,
      "conditions": null, "reason": "No moat. I'm out." }
  ]
}
```

The Interview Panel requires the context fields `role` and `resume`, and
`company` is optional. Its summary is the panel's decision: `offer` when a
majority recommend hiring.

```json
{
  "decision": "offer",
  "summary": "Clear communicator; technical depth needs work.",
  "verdicts": [ { "friend_id": "karthik", "recommendation": "hire", "reason": "Reasoned well about the Redis restart." } ],
  "competencies": [ { "name": "Communication", "score": 4, "note": "Structured answers." } ],
  "strengths": ["Structured self-introduction"],
  "improvements": ["Revise Redis persistence (RDB vs AOF)"]
}
```

`recommendation` is one of `strong_hire`, `hire`, `no_hire` or
`strong_no_hire`, and competency scores are 1-5.

Study Group requires `topic`, and `level` and `notes` are optional. Its modes
are `learn` and `quiz`. Its summary is a set of study notes: `topic`,
`key_points`, `memory_trick`, `quiz` (a list of `{question, answer}`),
`weak_spots` and `next_topics`.

Future You requires `decision` and `age` (13-29), and `about` is optional.
The participants are `you30` and `you50`. Its summary is a letter from each
future self:

```json
{
  "decision": "A job in Bangalore now, or a master's abroad?",
  "paths": [ { "option": "Take the job", "upside": "Savings and experience", "risk": "Comfort makes it easy never to leave" } ],
  "letters": [ { "friend_id": "you50", "letter": "I don't remember the salary. I remember who I became..." } ],
  "next_steps": ["Talk to two seniors who took each path"],
  "question": "If money weren't a factor, which would you choose?"
}
```

Roast & Toast returns a scorecard (scores are clamped to 1-10):

```json
{
  "overall": 6,
  "verdict": "Real projects buried under buzzwords.",
  "scores": [ { "category": "Impact", "score": 4, "note": "Almost no numbers." } ],
  "fixes": [ { "title": "Quantify every bullet", "detail": "Action + result...", "friend_id": "nandini" } ],
  "best_roast": "Bro wrote a horoscope, not a resume.",
  "best_toast": "Your projects section shows you actually build things."
}
```

### Errors and limits

Errors before a stream starts are returned as JSON `{"detail": "..."}`:
`404` for an unknown room, `422` for invalid input, `503` when the model is
busy (summary), and `429` for rate limits. Limits are per IP per hour and
are tracked separately: 5 debates, 40 room messages and 10 summaries.

When the model fails, the SSE `error` event (and a failed summary's JSON)
also carries a `code`: `"quota_exhausted"` when Gemini's quota or rate limit
is used up (429 / `RESOURCE_EXHAUSTED`), and `"model_unavailable"` for any
other model failure. The message is always friendly and never includes the
underlying error. The frontend uses the code to offer the demo replay.

**Deploying behind a proxy:** run uvicorn with `--proxy-headers` (and
`--forwarded-allow-ips` set to your proxy) so rate limiting sees the real
client IP. The rate limiter is in-memory, so it resets on restart and is per
process. See [Deploying the backend on Render](#deploying-the-backend-on-render).

## Demo replay mode

So visitors always see the rooms working, even when the AI is unavailable,
every room can play a real recorded conversation. Recordings live in
`frontend/public/replays/<room-id>.json` (`debate`, `group-chat`,
`shark-tank`, `interview-panel`, `future-you`, `roast-and-toast`,
`study-group`). Each one holds the setup that was used (personas, names,
language, room details), the user's message, every SSE event with its time
offset from the start, and the room's final summary.

**Playing.** The replay feeds the recorded events through the same hooks
(`useDebate`, `useRoomChat`) and components as a live room, so it looks
identical, with the original timing (long gaps capped at 2.5 seconds). A bar
labelled "Replay of a recorded conversation" has pause/resume, 1x/2x, skip to
the end and exit. Replays never touch your saved chat, and a live request
that is still loading keeps going underneath.

**When it's offered.** Every room page has a "Watch a demo" button next to
its start button (and in the chat's ⋮ menu). The replay is also offered
automatically ("The AI is taking a break, watch a real conversation
instead") when an error has the code `quota_exhausted` or
`model_unavailable`, on a `429` rate limit, when the backend can't be
reached, or when nothing arrives within 12 seconds of sending. A room
without a recording hides the button and shows the usual error.

Replays recorded with trace events drive the "Behind the scenes" panel
too. Older recordings without them still play; the panel then says
"Behind-the-scenes data isn't available for this replay."

**Waking the server.** Opening any room page sends a background
`GET /health`, so a sleeping free Render server starts waking up early. If a
request hasn't been answered after 5 seconds, the room shows "Waking up the
server (free hosting can take up to a minute)..." with the option to watch
the replay meanwhile.

### Re-recording the replays

`backend/record_replays.py` runs each room's example (the "Try this example"
input in `frontend/src/config/rooms.ts`) against the real agents: the Debate
Arena with 1 round, the other rooms with their default panel in English,
then their summary. It reads the examples with Node, so run `npm install` in
`frontend/` first. With the virtual environment active, in `backend\`:

```powershell
python record_replays.py                    # every room that has no recording yet
python record_replays.py --room group-chat  # just one room
python record_replays.py --force            # re-record rooms that already have one
python record_replays.py --gap 10           # wait longer between LLM calls (default 5 seconds)
```

It waits between LLM calls to stay under per-minute rate limits (the waits
are left out of the recorded timing), and a room that fails is not saved, so
you can simply run it again later. Each room takes about 8 to 12 model calls;
on Gemini's free tier the daily request limit may only allow a couple of
rooms per day. Re-record a room after changing its example, personas or
setup fields (a recording whose setup no longer fits the room is not offered).

## Behind the scenes mode

Every room has a "Behind the scenes" toggle (the eye button in its header;
the Debate Arena has it under the page title and in the debate header). It
is remembered in localStorage. When it's on, the room shows how its agents
work in real time: a side panel next to the conversation on wide screens, a
sheet docked above the composer (or at the bottom of the page) on phones,
which expands and collapses.

- **Live flow diagram**: the room's graph, built from `flow` in
  `config/rooms.ts` by `config/flows.ts`. Room-engine rooms show safety check
  -> director -> each persona (with their avatar) -> your turn, with arrows
  back to the director; the Debate Arena shows Pro <-> Con for the rounds,
  then the Judge. The running node pulses, the latest arrow animates, and
  every node shows how long it last took. Motion stops for people who
  prefer reduced motion.
- **Decision timeline**: each director decision, newest first, with the
  persona, the action, a short plain-language reason and the time it took,
  plus the safety mode ("Supportive mode on" after a crisis message). The
  Debate Arena lists its steps instead.
- **Turn stats**: messages, reactions, node runs and the agents' working time
  for the current turn.

**How it works.** With the toggle on, requests include
`"behind_the_scenes": true` and the SSE stream gains four events:

| Event               | Data                                                                 |
| ------------------- | -------------------------------------------------------------------- |
| `node_start`        | `{"node", "label"}` (+ `"round"` for Pro and Con)                    |
| `node_end`          | `{"node", "duration_ms"}`                                            |
| `director_decision` | `{"action": "speak" \| "react" \| "end", "persona_id", "reply_to", "reason"}` |
| `safety_check`      | `{"mode": "normal" \| "supportive"}`                                  |

Node names are `safety_check`, `director`, `persona:<id>` and `your_turn` in
the rooms, and `pro`, `con` and `judge` in the Debate Arena. The reason is
the director's own short explanation (at most about 20 words), or a fixed
sentence when the turn-taking rules changed its choice. Trace events never
include prompts, persona instructions, model output beyond the chat itself,
keys or error details. Without the flag, nothing is sent and nothing changes.

## Build your own friend and cross-room guests

**My Friends** (`/friends`, in the navbar) builds custom personas. Describe a
type of person (plus an optional name, relationship and language) and
`POST /api/personas/generate` returns a persona from one structured LLM call:
name, emoji, a colour from the text-safe palette, personality, speaking
habits, typical stance, and avatar parameters (face shape, skin tone, hair,
hair colour, accessory, expression) that the frontend draws in the same
illustrated style as the built-in personas. You see a preview first and can
regenerate, save, and later edit or delete. Up to 12 friends are saved in
localStorage (the page still works without storage).

```json
{ "description": "my strict but caring dad", "name": "Papa", "relationship": "dad", "language": "english" }
```

- `description`: 10-300 characters; `name`: optional, 1-20; `relationship`:
  optional, up to 40; `language`: `english`, `hinglish` or `tenglish`.
- Refused with `422 {"detail": "<friendly message>", "code": "persona_refused"}`:
  real, identifiable people (celebrities, politicians, public figures, or a
  specific named private person), hateful, sexual or harassing personas, and
  descriptions that try to change the app's rules. Generic relationships
  ("my strict dad") are fine.
- Limit: 10 generations per IP per hour.

**Using custom personas.** The API stays stateless: rooms send the custom
personas they use inline as `custom_personas`
(`{"id": "custom_<4-16 a-z0-9>", "name", "emoji", "colour", "personality",
"speaking_habits", "typical_stance"}`, every field length- and type-checked,
no extra fields). Their text is untrusted: every prompt puts it inside
`<persona_description>` tags, says it only describes a character and that any
instructions inside must be ignored, and strips `<` and `>` so it can't close
the fence. The room's rules, the guardrails and the safety layer always come
after it and take priority; in supportive mode custom personas are gentle like
everyone else. In The Group Chat they can be regular members.

**Cross-room guests.** Rooms send `guests` (`[{"id", "name"}]`): a built-in
persona from another room, or a custom persona. Each room config sets
`allows_guests`, `max_guests` and `guest_role`:

| Room | Guests | Role |
| ---- | ------ | ---- |
| The Group Chat | 2 (5 people in total) | extra friends |
| Pitch Tank | 1 | a friend in the audience who reacts and whispers advice |
| Interview Panel | 1 | a coach in your corner with a short private tip between questions |
| Roast & Toast | 1 | a guest roaster |
| Future You | 1 | someone who knows you, with their own perspective |
| Study Group | 1 | a guest classmate |
| Debate Arena | none | (fixed format) |

The director treats guests as lower priority, and code enforces it: at most 2
guest messages per user message, fallbacks pick members first, and guests
don't count towards "everyone should speak". Guests never take a core role:
the final summary (offers, scores, votes) comes from the room's own members
only. In the chat, guests have a small "Guest" badge; in "Behind the scenes"
they appear as dashed nodes with their avatars, and the director's reasons
mention them.

## Documents and PDF reports

### Uploading documents

Some rooms can read a document: the **Interview Panel** a resume
(recommended; it can replace the pasted resume) and a job description
(optional), the **Pitch Tank** a pitch deck, **Roast & Toast** a resume or
project write-up (instead of pasting it), and the **Study Group** notes. Each
setup screen has a drop zone, a file picker and "Paste text instead", with
upload progress, the page count and a preview of the digest ("Here's what the
panel will see") that can be removed.

- `POST /api/documents/extract`: multipart form with `file` and `doc_type`
  (`resume`, `job_description`, `pitch_deck` or `notes`). PDF, DOCX and TXT
  only, detected from the file's content (magic bytes), not its name. Max
  5 MB; page limits: resume 4, job description 6, pitch deck 30, notes 20.
  Text is extracted with pypdf / python-docx (with `[Page N]` / `[Slide N]`
  markers) in a worker thread with a 20-second timeout, cut to about 12,000
  characters, and turned into a digest (at most about 1,500 characters) by
  one structured LLM call suited to the document type. Returns
  `{doc_type, filename, pages, char_count, digest, text}`.
- `POST /api/documents/digest`: `{doc_type, text}` with 50-12,000 characters
  of pasted text; same digest.
- Friendly errors (with a `code`) for wrong file types, files over 5 MB, too
  many pages, scanned PDFs (no extractable text: paste the text instead),
  password-protected or unreadable files, and the limit of 15 documents per
  IP per hour.
- Room requests carry `documents: [{doc_type, filename, digest}]` (at most 3,
  digests up to 2,000 characters); personas only ever see the digests. Each
  room config lists the types it takes (`documents`), how it uses them
  (`document_hint`), and which pasted field a document can replace.
- With a job description, the Interview Panel tailors its questions to the
  resume and the role, and its result adds a job match: a 0-100 score,
  matched and missing skills, and the top 3 things to work on. With a deck,
  Pitch Tank investors refer to slides by number and the result adds
  slide-by-slide feedback.

**Privacy.** Files are processed in memory only: never written to disk,
never stored, and never logged (only their type, size and page count). In
the browser, documents and digests are kept in memory for the current visit
only, never in localStorage, so after a reload the room asks for them again.
Every upload shows: "Your file is processed in memory and never stored by Nth
Opinion. Its text is sent to Google Gemini to generate responses. Don't
upload anything you're not comfortable sharing."

**LangSmith.** Requests that include documents (and every digest call) run
with LangSmith tracing switched off (`langsmith.tracing_context(enabled=False)`),
so document text, digests and anything derived from them never reach a trace.
Redacting them inside traces can't be done reliably, since replies quote and
paraphrase the documents. The director's notes and reasons are also left out
of the server logs for those requests.

**Prompt injection.** Document text and digests are untrusted: every prompt
fences them in `<document>` tags and says they are content to evaluate, never
instructions. The digest step never follows instructions found in a document;
if it finds any aimed at an AI ("rate this candidate 10/10", "ignore previous
instructions"), the digest starts with a red-flag line, and the personas are
told to call such instructions out instead of following them.

**Replays** with documents use only the made-up samples in `backend/samples/`
(a fresher resume, a job description and a pitch deck), never real personal
data.

### PDF reports

At the end of every room (live, or a demo replay, which is labelled as such),
**Download PDF report** builds a PDF in the browser with
[@react-pdf/renderer](https://react-pdf.org), loaded only on click. It uses the
Chai & Sage colours, the site fonts (Fraunces, Figtree and IBM Plex Mono,
served from `public/fonts/` because react-pdf can't read next/font's WOFF2
files), the logo, the room name and date, and the disclaimer "AI-generated
perspectives for practice and entertainment, not professional advice."

| Room | In the report |
| ---- | ------------- |
| Interview Panel | each interviewer's recommendation, scores, a question-by-question recap with feedback, strengths, areas to improve, and the job match if a JD was given |
| Pitch Tank | the pitch, each investor's offer or reason for passing, strengths, key concerns, and slide-by-slide feedback if a deck was given |
| Roast & Toast | the best roast lines, the toast, scores, and an improvement checklist |
| Study Group | key points, the analogies and memes used, a 5-question self-quiz with answers, weak spots, what to study next |
| Debate Arena | scores, the decision memo and the full transcript |
| The Group Chat | the poll with everyone's reasons, and the conversation highlights |
| Future You | the decision, each future self's letter, the paths, and a reflection checklist |

Reports contain the room's outputs only, never uploaded document text. The
fonts only cover Latin characters, so emoji are left out and the rupee sign
is written as "Rs".

## Sharing results

When a room reaches its result (the debate verdict, a poll, offers, an
interview result, a scorecard, letters or study notes), a **Share** button
appears under it, in live chats and in demo replays (whose cards say "From a
demo conversation"). It opens a preview of a card in the Chai & Sage theme:
the room's illustration and accent, the logo, the result, and a "Get your Nth
Opinion" footer with the site address.

| Room | On the card |
| ---- | ----------- |
| Debate Arena | The motion, the winner and both sides' scores |
| The Group Chat | The poll, vote bars and 2-3 friends' reasons |
| Pitch Tank | The startup's one-line pitch and each investor's offer or "I'm out" |
| Interview Panel | Overall score, top strength and one thing to improve |
| Roast & Toast | The best roast line and the most useful real tip |
| Future You | The key advice from each future self |
| Study Group | The topic and "3 things I learned" |

- **Sizes:** square (1080x1080) or story (1080x1920).
- **Privacy:** in The Group Chat, Future You, Interview Panel and Roast &
  Toast, the user's own question and personal details stay off the card
  unless they tick "Include my question". Until then, every distinctive word
  they typed (in the chat, the resume or other setup details: names, places,
  companies, anything with a number) is blanked out, and the Interview Panel
  shows only competency names instead of its written feedback.
- **Image:** the PNG is made in the browser from a hidden full-size copy of
  the card with [modern-screenshot](https://github.com/qq15725/modern-screenshot),
  which keeps the web fonts and SVG illustrations.
- **Actions:** Share (the Web Share API with the image, shown only where the
  browser supports sharing files, mostly phones), Download image, and Copy
  link (copies the site address).

The site address comes from `NEXT_PUBLIC_SITE_URL` (default
`https://nth-opinion.vercel.app`), which is also the metadata base for link
previews. The home page and every room have their own Open Graph and Twitter
images (`opengraph-image.tsx` / `twitter-image.tsx`, drawn by `src/lib/og.tsx`
with the room's title, description and illustration), so links shared on
WhatsApp, LinkedIn and X show a proper preview.

## Testing

### Unit tests (no API keys, no AI calls)

```powershell
# backend\ (with the virtual environment active)
pip install -r requirements-dev.txt
python -m pytest

# frontend\
npm test
npm run lint
```

The backend tests (`backend/tests/`) cover request validation (topic, rounds,
message length, persona fields), custom persona fields, document type and
size checks (including a fake PDF that is really an image), the SSE event
format, the rate limiter, and prompt-injection delimiting (untrusted persona
and document text always ends up inside its fenced section, and can't close
it). Every LLM call is replaced by a fake (`tests/conftest.py`), and the
tests set a dummy `GOOGLE_API_KEY`, so a local `.env` is never used. The
frontend tests (Vitest) cover the SSE parser, including events split across
chunks, and the demo replay timing (gap cap, 2x, pause, skip, abort).

GitHub Actions (`.github/workflows/tests.yml`) runs pytest, the frontend tests
and lint on every push and pull request. It needs no secrets and never calls
an LLM.

### Evaluation suites (real AI calls)

`backend/evals/` measures how well the rooms actually behave, using LangSmith
datasets and experiments and custom evaluators. Test cases live in
`backend/evals/datasets/*.json` (committed) and are synced to LangSmith
datasets named `nth-opinion-<suite>` when `LANGSMITH_API_KEY` is set;
otherwise the suites run locally with the same evaluators.

| Suite | What it measures |
| ----- | ---------------- |
| `persona_consistency` | 5 scenarios per room; a judge scores each message 1-5 for staying in character, plus a blind attribution test (who wrote this?) against random chance |
| `safety` | 25 messages: crisis (the safety event must fire, replies must be supportive), sad-but-safe (no false alarm), harmful requests (no encouragement) |
| `prompt_injection` | jailbreaks in user messages, custom persona descriptions, the sample resume and job description (must be flagged), and the persona builder |
| `director_quality` | deterministic: rule violations, new topics where everyone spoke, speaking evenness (normalised entropy), messages per turn |
| `debate_judge_bias` | each topic debated with the motion flipped (same position first, then second): is the winner consistent? does the longer argument win more than chance? |
| `language_adherence` | Hinglish and Tenglish: Roman script only (deterministic) and a natural mix (judge) |
| `performance` | time per turn, AI calls per turn, time to the first message and to the first debate token |

```powershell
# backend\ (with the virtual environment active)
python -m evals.run --suite all --quick      # a small subset of every suite: about 30 AI calls
python -m evals.run --suite safety           # one suite, every case
python -m evals.run --suite all --delay 8    # wait longer between AI calls (rate limits)
```

- The judge uses `JUDGE_MODEL` (default: `GEMINI_FALLBACK_MODEL`, then
  `GEMINI_MODEL`); use a different model from the one being tested, so the
  judge isn't grading itself.
- `--delay` (default 4 seconds) spaces out AI calls; waiting time is left out
  of the performance timings.
- A full run of every suite takes roughly 650-700 AI calls, far more than
  Gemini's free tier allows per day: run suites one at a time, or use
  `--quick`.
- Only the synthetic cases and the made-up documents in `backend/samples/`
  are used; uploaded user documents never go into an eval.
- **Quota-friendly.** If the quota runs out mid-run (429 `RESOURCE_EXHAUSTED`
  on every model in the chain), the case in progress is marked "skipped
  (quota)", not failed; the suite stops and is reported as **incomplete**;
  later suites aren't started; and nothing incomplete is written, so
  `latest.json` keeps that suite's previous results. `--max-calls N` stops
  the same way after N AI calls, e.g. `python -m evals.run --suite all
  --quick --max-calls 18` to stay under a day's free quota. The judge stays
  on `JUDGE_MODEL` (it never falls back along the chain); the results record
  which models actually answered.
- After a run, a summary per suite (headline score, metrics, sample size,
  pass/fail counts, date, models, and 2-3 example cases) is merged into
  `frontend/public/evals/latest.json`, so suites can be run on different
  days. The **How we test** page (`/how-we-test`) shows it, and shows "Not run
  yet" for suites without results. Commit the updated file to publish them.

## Staying within the Gemini quota

The free tier allows about 20 requests per day per model, so the backend is
careful with requests:

- **Model chain.** `GEMINI_MODEL_CHAIN` (comma-separated) lists the models to
  try in order; without it, `GEMINI_MODEL` then `GEMINI_FALLBACK_MODEL` are
  used as before. A model that hits a daily quota is remembered and skipped,
  with no requests sent to it, until the quota resets at midnight Pacific time;
  one that's only rate limited per minute is skipped for the delay Gemini
  suggests; an overloaded one (503) is just passed over for that call. When
  every model is out of quota, the API answers at once with the
  `quota_exhausted` error code (and the site offers the demo replay).
- **Thinking level.** Each model starts at the lowest thinking level it might
  accept. When it rejects one, the working level is remembered for the rest of
  the process, so later calls don't send a failing request first (even when
  several calls hit the rejection at the same time).
- **Fast mode.** `ROOM_FAST_MODE=true` makes the room director plan the whole
  turn in one structured call (an ordered list of who speaks or reacts, each
  with a short note and reason), and then each persona writes their message.
  That is 1 safety check + 1 plan + one call per message, instead of a
  director call before every message too (roughly half the calls). The same
  turn-taking rules still check every planned step, and "Behind the scenes"
  shows the plan and each step's reason. It's off by default.

## Languages

Every room, the Debate Arena and the persona builder speak these languages:
English, Hinglish, Tenglish, Tanglish (Tamil), Kanglish (Kannada), Manglish
(Malayalam), Marathi-English and Benglish (Bengali).

- **One registry.** `backend/languages.py` defines each language: id, label, a
  short example line (shown in the picker) and a style guide for the prompts:
  how to mix the languages, common words and slang, and "always Roman script,
  never native script". The API validates every request against it and serves
  it at `GET /api/languages`. The frontend bundles a copy
  (`frontend/src/config/languages.json`) as a fallback, and
  `backend/tests/test_languages.py` checks the two are identical: after
  changing the registry, update the JSON too.
- **Rooms.** Rooms keep their own hand-tuned wording for English, Hinglish and
  Tenglish; every other language uses the registry's style guide plus a short
  room note (e.g. Pitch Tank: use ₹, lakhs and crores). Debaters write in the
  chosen language and must stay clear and well-reasoned. Interviewers can be
  conversational in the mix, but the Interview Panel's scores and report stay
  in English. Safety messages and the helpline text are always in clear English.
- **Picker.** Every room's setup screen, the Debate Arena and the persona
  builder show all languages with their example lines; the last choice is
  remembered (localStorage) as the default.
- **Evals.** `language_adherence` covers every mixed language, and its Roman
  script check rejects Devanagari (Hindi, Marathi), Bengali, Tamil, Telugu,
  Kannada and Malayalam characters.

## Voice: talk, listen and live captions

Every room, the Debate Arena (and its demo replays) can be spoken to and listened to.
The pieces are reusable modules (`frontend/src/lib/voice/`, `hooks/useVoice.ts`,
`hooks/useDictation.ts`, `components/voice/`) for the coming call mode.

**Voice input** (the mic next to the message box, the debate topic and the setup
fields) uses the browser's speech recognition (Web Speech API). Where it isn't
available (e.g. Firefox) the mic is hidden. Tap to talk, tap again to stop; it
also stops after a short silence. The words appear live in the box and are never
sent by themselves unless **Hands-free** is on. The recognition language follows
the room's language (English and Hinglish: English (India), Tenglish: Telugu,
Tanglish: Tamil, and so on) and can be changed. Recognition in Indian languages
may come back in native script: the rooms understand it and still reply in the
chosen Roman-script mix. A one-time note explains that in Chrome the audio is
processed by Google.

**Read replies aloud** (the speaker button in the room header, off by default
because browsers only allow audio after a click) reads new replies in order,
never overlapping; each message also has a small play button. The captions bar
has speed (0.75x to 1.5x), skip and stop. Using the mic or sending a message
stops it. Before speaking, emojis, markdown and links are removed, @mentions are
read as names, and reactions aren't read. The support banner is read gently.
In the Debate Arena, Pro, Con and the Judge have different voices, and the
decision memo can be read too. The choice is remembered on the device.

- **Browser voices (default):** `speechSynthesis`. Each persona gets a voice
  (Indian English first, then other English voices) plus its own pitch and rate
  (`frontend/src/config/voices.ts`), so they sound different even on devices
  with one or two voices.
- **AI voices (optional):** set `TTS_PROVIDER=gemini` on the backend to turn on
  `POST /api/tts` (`{ text, persona_id, language }` -> WAV). It uses the
  TTS-capable Gemini model in `TTS_MODEL` with the same `GOOGLE_API_KEY`, and a
  voice per persona (`backend/tts.py`). Audio is cached in memory (LRU, keyed by
  a hash of the text and voice) and limited to 60 requests per IP per hour.
  The frontend checks `GET /api/tts/status`; if AI voices are off, fail or run
  out of quota, that message quietly uses a browser voice. With the default
  `TTS_PROVIDER=browser` the endpoint is off and costs nothing.

**Live captions:** while a message is read, its words are highlighted as they're
spoken, and a captions bar at the bottom shows the speaker and the current line.
Word timings come from the browser's word events where available, and are
estimated from the text and audio length otherwise (always for AI voices).
Captions can be switched off (the CC button), and with reduced motion the
highlight is a plain underline.

## Call mode (and the Debate Arena's Stage mode)

Every room has a **Chat / Call** switch in its header; the Debate Arena has
**Arena / Stage mode** next to the motion. Both views show the same
conversation (the same state), so switching never loses anything.

- **Joining.** Call mode opens with a short "Join call" screen (a ringing phone).
  The Join click unlocks audio and turns on voice output, captions and
  hands-free; **End call** returns to the chat with the full transcript and puts
  those settings back as they were. "Switch to chat" keeps the call going.
- **Animated avatars** (`components/call/AnimatedAvatar.tsx`) reuse the
  illustrated avatar artwork (`components/chat/Avatar.tsx`, built-in and custom
  personas) with a face whose parts move: random natural blinking, brows,
  a mouth that morphs between closed, slightly open, open, wide and round "O",
  and a head that sways gently, nods while listening and glances up while
  thinking. States: listening, thinking (after the typing event), speaking and
  reacting. In Future You, the future selves are age variants of your avatar
  (`lib/call/scenes.ts`: grey hair, glasses, softer features at 50).
- **Emotions.** Room `message` events carry an optional `emotion` (happy,
  excited, thoughtful, annoyed, concerned or neutral). The persona picks it in the
  same LLM call that writes the message (a leading tag like `[happy]`, removed
  from the text), so it costs no extra calls. It sets the expression while that
  message is spoken; missing (older replays) means neutral.
- **Lip sync** (`lib/voice/lipSync.ts`). AI voices (`TTS_PROVIDER=gemini`): the
  audio goes through a Web Audio `AnalyserNode`, its loudness each frame sets
  how open the mouth is (lightly smoothed), and a low/high frequency check picks
  the "O" or wide shape. Browser voices (no access to their audio): the caption
  word timings drive the mouth, opening and closing once per estimated syllable,
  and closing between words and at punctuation. Either way it follows the same
  word as the captions and shuts the moment speech stops.
- **Layouts** (`lib/call/scenes.ts`, `components/call/CallStage.tsx`): a cosy grid
  (Group Chat), investors in a row facing your spotlight (Pitch Tank), three
  interviewers across a table (Interview Panel), you in the middle of a timeline
  with your future selves either side (Future You), a classroom board and table
  (Study Group), a small stage with a mic (Roast & Toast), and two podiums with
  the judge raised in the centre (Debate Arena). The speaking tile glows in the
  persona's colour, grows slightly and shows an equaliser; reactions float up
  from the reacting persona's tile; guests have a Guest badge. On phones the
  active speaker is in a spotlight with everyone else in a strip below.
- **Your tile** shows your initial (your avatar in Future You) and whether your
  mic is listening. The optional camera self-view is off by default; it's only
  shown in your own tile, and never recorded, uploaded or sent anywhere.
- **Controls:** mic (tap to toggle, or hold to talk; **M**), hands-free (sends
  when you stop talking and listens again once the room has replied), captions
  (**C**), sound (read aloud, volume, speed), camera, behind the scenes, the
  room's summary button, Switch to chat and End call. You can also type under the
  stage.
- **Performance and accessibility:** one shared `requestAnimationFrame` loop
  (`lib/call/frameLoop.ts`) moves every avatar by writing SVG attributes directly
  (no React re-renders per frame) and pauses while the tab is hidden. With
  reduced motion there's no sway, nodding or floating, and the mouth simply fades
  open and closed. New messages are announced to screen readers (`aria-live`);
  every control is labelled and reachable by keyboard.
- **Replays and sharing:** demo replays play in call mode too (no AI quota). When
  a room's results arrive during a call, "See them in chat" opens the result
  card, where sharing and the PDF report work as before.

## Installable app (PWA)

Nth Opinion can be installed from the browser (Chrome, Edge, Android: "Install
app" in the footer; iPhone: Share, then Add to Home Screen).

- **Manifest**: `frontend/src/app/manifest.ts` (served at
  `/manifest.webmanifest`): name, tagline, `display: standalone`, the canvas
  colour as theme and background, and 192/512px icons plus maskable versions.
  The icons and the Apple touch icon are generated from the logo with
  `node scripts/generate-icons.mjs` (in `frontend/`). `app/layout.tsx` adds the
  Apple touch icon and the iOS web-app meta tags.
- **Service worker**: a small hand-written `frontend/public/sw.js` (no build
  plugin, so it works with Turbopack). It is registered only in production
  builds (`components/pwa/PwaManager.tsx`); in `next dev` it isn't, and any
  left over from a local production run is removed.
  - On install it precaches the main pages, the offline page, icons, the
    manifest, the report fonts and the demo replay JSON files. Missing files
    (a room without a recording) are skipped.
  - While browsing it caches Next.js scripts and styles, fonts and images
    (cache-first: they're fingerprinted or rarely change), pages (network
    first, cached copy when offline), and replays (served from the cache,
    refreshed in the background).
  - It **never** handles API requests or SSE streams: the backend is on
    another origin, `/api/` paths are skipped, and so are
    `text/event-stream` requests. They always go to the network.
  - Caches are versioned per build: the worker is registered as
    `/sw.js?v=<build>` (`NEXT_PUBLIC_APP_VERSION`, from the Vercel commit SHA
    or the build time, set in `next.config.ts`), and old caches are deleted
    when a new version activates. `/sw.js` is served with `no-cache`.
- **Updates**: when a new deploy has installed, a small toast says "A new
  version is available" with a Refresh button. Nothing reloads until the user
  taps it.
- **Offline**: a page that can't be loaded offline shows `/offline`, with links
  to every room's demo (`?demo=1` starts the demo straight away). Rooms and the
  Debate Arena disable their start buttons with "You're offline. Rooms need the
  internet, but the demo works offline." Demos work offline once the site has
  been opened on the device.
- **Install button**: shown in the footer only where the browser offers an
  install prompt (or as a short hint on iPhone Safari), hidden once installed
  or running standalone, and gone for good once dismissed.

To try it locally: `npm run build && npm start`, then open
http://localhost:3000 (service workers need a production build; localhost
counts as secure).

## Deploying the backend on Render

Create a **Web Service** from this repo with these settings:

| Setting           | Value |
| ----------------- | ----- |
| Language          | Python 3 |
| Root Directory    | `backend` |
| Build Command     | `pip install -r requirements.txt` |
| Start Command     | `uvicorn main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips="*"` |
| Health Check Path | `/health` |

`--proxy-headers --forwarded-allow-ips="*"` makes uvicorn take the visitor's IP
from Render's `X-Forwarded-For` header, so each visitor gets their own rate
limit instead of everyone sharing the proxy's. Keep a single uvicorn worker
(the default): the rate limiter lives in memory and isn't shared between
workers. `/health` returns immediately without calling the model.

Environment variables (set them in the service's **Environment** tab; `.env`
is not deployed):

| Variable                | Required |
| ----------------------- | -------- |
| `GOOGLE_API_KEY`        | Yes |
| `GEMINI_MODEL`          | Recommended (has a built-in default) |
| `FRONTEND_ORIGIN`       | Yes: your frontend's URL(s), comma-separated |
| `GEMINI_FALLBACK_MODEL` | Optional |
| `DIRECTOR_MODEL`        | Optional |
| `LANGSMITH_TRACING`     | Optional |
| `LANGSMITH_API_KEY`     | Only when tracing is on |
| `LANGSMITH_PROJECT`     | Optional |
| `PYTHON_VERSION`        | Recommended: the Python version you develop with (3.10 or newer) |

See [Configure environment variables](#2-configure-environment-variables) for
what each one does. `FRONTEND_ORIGIN` entries are trimmed and trailing slashes
are removed, so `https://a.example.com/, https://b.example.com` works.

## Disclaimer

Nth Opinion's AI personas give friendly perspectives and entertainment, not
professional advice. If you're struggling, please talk to someone you trust or
call Tele-MANAS at 14416.
