# Huddle

**One problem. A room full of minds.**

Huddle is a multi-agent platform: you bring a problem, and a room of AI
personas with different personalities talks it through with you. A director
agent decides who speaks next, so conversations flow naturally instead of
going round-robin.

| Room | Status |
| ---- | ------ |
| **Debate Arena**: PRO and CON argue any motion for 1-3 rounds, then a judge scores them | Live |
| **The Group Chat**: share a problem with a WhatsApp-style group of AI friends | Live |
| **Shark Tank Pitch Room**: pitch your startup to 3 investors who grill you, then make offers | Live |
| **Roast & Toast**: your resume or project gets roasted, then gets real feedback and a scorecard | Live |
| **Interview Panel**: HR, a tech lead and a skeptical manager interview you from your resume | Live |
| **Future You**: you at 30 and you at 50 talk through a decision with you now | Live |
| Study Group | Coming soon |

The backend is FastAPI + LangGraph (Gemini models, optional LangSmith tracing),
streaming over Server-Sent Events. The frontend is Next.js + Tailwind.

## Backend layout

```
backend/
  llm.py              shared Gemini setup: models, thinking level, fallback, timeouts, timing logs
  graph.py            Debate Arena graph (pro -> con -> ... -> judge)
  main.py             FastAPI app: /api/debate and /api/rooms/*
  rooms/
    __init__.py       registers every room
    engine.py         the shared room engine (LangGraph director loop, summary)
    safety.py         crisis detection, supportive mode, guardrails for every persona
    group_chat.py     The Group Chat room: personas, languages, poll
    shark_tank.py     The Shark Tank room: investors, pitch details, offers
    roast_and_toast.py  Roast & Toast: panel, roast/toast modes, pasted material, scorecard
    interview_panel.py  Interview Panel: interviewers, role + resume, hire/no-hire result
    future_you.py       Future You: two future selves, age check, letters + next steps
  run_cli.py          Debate Arena in the terminal
  chat_cli.py         Group Chat in the terminal
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

| Route | Page |
| ----- | ---- |
| `/` | Home: hero, room grid, how it works |
| `/debate` | Debate Arena |
| `/rooms/group-chat` | The Group Chat |
| `/rooms/shark-tank` | Shark Tank Pitch Room |
| `/rooms/roast-and-toast` | Roast & Toast |
| `/rooms/interview-panel` | Interview Panel |
| `/rooms/future-you` | Future You |
| `/rooms/study-group` | Coming soon |
| `/about` | About, agent diagram, disclaimer |

### Frontend layout

```
frontend/
  public/                 huddle-logo.svg (logo + wordmark), huddle-icon.svg, favicon.svg
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
  src/hooks/useRoomChat.ts    chat state, SSE pacing, cancel-on-new-message, localStorage
  src/lib/sseClient.ts        shared POST + SSE reader used by the debate and the rooms
```

To list a new room, add it to `src/config/rooms.ts`. The navbar, home grid
and coming-soon pages pick it up automatically.

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

A room is mostly a config file. The three live chat rooms are good templates:

- `group_chat.py`: a pickable, renamable cast, plus a poll
- `shark_tank.py`: a fixed panel, context fields and structured offers
- `roast_and_toast.py`: modes, a large pasted context field and a scorecard

For example, a Study Group room:

1. Create `backend/rooms/study_group.py`:

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

The response is an SSE stream (`text/event-stream`). Each event's `data` is JSON:

| Event        | Data                                                      |
| ------------ | --------------------------------------------------------- |
| `turn_start` | `{"speaker": "pro" \| "con", "round": 1}`                 |
| `token`      | `{"speaker": "pro" \| "con", "text": "chunk"}`            |
| `turn_end`   | `{"speaker", "round", "text"}`: the final text for that turn |
| `judge`      | `{"scores": {"pro": {...}, "con": {...}}, "winner": "pro" \| "con" \| "tie", "memo": "..."}` |
| `done`       | `{}`                                                      |
| `error`      | `{"message": "..."}`                                      |

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

SSE events:

| Event       | Data |
| ----------- | ---- |
| `typing`    | `{"friend_id"}` |
| `message`   | `{"id", "friend_id", "text", "reply_to": id \| null, "mentions": [friend ids or "user"]}` |
| `reaction`  | `{"friend_id", "message_id", "emoji"}` |
| `safety`    | `{"helpline_text"}` |
| `mode`      | `{"mode"}`: the director switched modes (rooms with modes only) |
| `your_turn` | `{}`: the turn is over |
| `error`     | `{"message"}` |

If the client disconnects (for example the user sends a new message
mid-reply and the browser aborts the request), generation stops.

Rooms with context fields also need `context`. Shark Tank requires
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

Shark Tank returns the investors' decisions (amounts in ₹ lakhs). An offer
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

**Deploying behind a proxy:** run uvicorn with `--proxy-headers` (and
`--forwarded-allow-ips` set to your proxy) so rate limiting sees the real
client IP. The rate limiter is in-memory, so it resets on restart and is per
process.

## Disclaimer

Huddle's AI personas give friendly perspectives and entertainment, not
professional advice. If you're struggling, please talk to someone you trust or
call Tele-MANAS at 14416.
