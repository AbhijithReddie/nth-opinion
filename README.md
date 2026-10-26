# Nth Opinion

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
| `message`   | `{"id", "friend_id", "text", "reply_to": id \| null, "mentions": [friend ids or "user"]}` |
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
