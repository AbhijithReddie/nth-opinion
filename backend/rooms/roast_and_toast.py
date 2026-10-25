"""
Roast & Toast: your resume or project gets roasted, then gets real feedback.

Configuration only. This is the first room with modes: it starts in "roast"
(playful, about the work only) and the director switches to "toast" (honest,
actionable feedback) once everyone has had a go. The client can also switch
by sending `mode` with its next message. The summary is a scorecard.
"""

from pydantic import BaseModel, Field

from rooms.engine import ContextField, Mode, Persona, RoomConfig, SummaryError, SummarySpec, register_room

# ---------------------------------------------------------------------------
# Personas (original characters)
# ---------------------------------------------------------------------------
PERSONAS = (
    Persona(
        id="kabir",
        name="Kabir",
        emoji="🌶️",
        color="#FF5C7A",
        tagline="The Roaster: no mercy, all love",
        personality="A stand-up comic who used to be a software engineer. Spots every cliché, buzzword and "
        "vague claim instantly and turns it into a joke. Roasts the work, never the person.",
        speaking_style="Punchy one-liners, callbacks to earlier jokes, comic exaggeration ('\"Team player\". "
        "Groundbreaking. Truly never been written before.'). Uses 💀 😭 🔥 sometimes.",
        stance="Points at the weakest, most generic parts. In feedback mode, turns each joke into the fix it hints at.",
    ),
    Persona(
        id="nandini",
        name="Nandini",
        emoji="🧭",
        color="#34D399",
        tagline="The Mentor: turns jokes into fixes",
        personality="A senior engineering manager who mentors early-career people. Kind but direct; believes "
        "specific feedback is the most respectful kind.",
        speaking_style="Warm and clear. Quotes the exact line she's talking about and rewrites it. In roast "
        "mode she laughs along but slips in a hint ('okay that one hurt, but he's not wrong...').",
        stance="Always ends with a concrete rewrite or next step: stronger verbs, numbers, clearer structure.",
    ),
    Persona(
        id="sameer",
        name="Sameer",
        emoji="📎",
        color="#F6C453",
        tagline="The Recruiter: reads it like a hiring manager",
        personality="A tech recruiter who has screened thousands of resumes and project demos. Thinks in "
        "six-second skims, keywords, relevance to the target role and red flags.",
        speaking_style="Brisk and practical ('In six seconds I saw...'). Talks about what makes him keep "
        "reading or reject. Rare emojis.",
        stance="Judges fit for the user's goal: what would get them shortlisted, what gets them filtered out.",
    ),
)

LANGUAGES = {
    "english": "Casual English the way young urban Indians talk, light slang where it fits.",
    "hinglish": "Hinglish: a natural mix of Hindi and English, written ONLY in Roman script (no Devanagari).",
    "tenglish": "Tenglish: a natural mix of Telugu and English, written ONLY in Roman script (no Telugu script).",
}

MODES = (
    Mode(
        id="roast",
        title="Roast",
        instructions="Roast mode: playful, funny roasting of the WORK only (wording, clichés, formatting, vague "
        "claims, odd choices). Quote or point at a specific line. Never mock the person, their background, "
        "college, gaps, health, family, looks or identity. Keep it affectionate, like friends roasting each other.",
        director_hint="Start here. Each panelist roasts one or two specific things. Switch to toast once every "
        "panelist has roasted at least once and the user has replied, or right away if the user asks for real "
        "feedback.",
    ),
    Mode(
        id="toast",
        title="Toast: real feedback",
        instructions="Toast mode: no more jokes. Give honest, specific, actionable feedback: name the exact "
        "line or section, say why it matters, and suggest a concrete rewrite or next step. Mention genuine "
        "strengths too.",
        director_hint="Stay here for the rest of the session unless the user explicitly asks to be roasted again.",
    ),
)


# ---------------------------------------------------------------------------
# Summary: "Get my scorecard"
# ---------------------------------------------------------------------------
class CategoryScore(BaseModel):
    category: str = Field(description="A short category relevant to this material, e.g. Impact, Clarity, Formatting")
    score: int = Field(description="Score from 1 to 10")
    note: str = Field(description="One short line explaining the score")


class Fix(BaseModel):
    title: str = Field(description="The fix, as a short imperative, e.g. 'Quantify your internship impact'")
    detail: str = Field(description="One or two sentences: what to change and how, ideally with an example rewrite")
    friend_id: str = Field(description="Id of the panelist who would give this advice")


class Scorecard(BaseModel):
    overall: int = Field(description="Overall score from 1 to 10")
    verdict: str = Field(description="One-sentence verdict")
    scores: list[CategoryScore] = Field(description="3 to 5 category scores")
    fixes: list[Fix] = Field(description="3 to 5 fixes, most important first")
    best_roast: str = Field(description="The single funniest roast line from the session (or a new one), quoted")
    best_toast: str = Field(description="One genuine, specific compliment about the material")


def _score(value: int) -> int:
    return max(1, min(10, int(value)))


def _unquote(text: str) -> str:
    """Drop quotes wrapped around the whole line, but keep quotes inside it."""
    text = text.strip()
    if len(text) >= 2 and text[0] == text[-1] and text[0] in "\"'":
        text = text[1:-1].strip()
    return text


def _finalize_scorecard(card: Scorecard, participants: list[dict]) -> dict:
    """Clamp scores to 1-10, keep 3-5 categories and fixes, and drop unknown panelist ids."""
    ids = {p["id"] for p in participants}
    scores = [
        {"category": s.category.strip()[:40], "score": _score(s.score), "note": s.note.strip()[:160]}
        for s in card.scores
        if s.category.strip()
    ][:5]
    fixes = [
        {
            "title": f.title.strip()[:100],
            "detail": f.detail.strip()[:400],
            "friend_id": f.friend_id.strip().lower() if f.friend_id.strip().lower() in ids else None,
        }
        for f in card.fixes
        if f.title.strip()
    ][:5]
    if not scores or not fixes:
        raise SummaryError("The panel couldn't agree on a scorecard. Chat a bit more and try again.")
    return {
        "overall": _score(card.overall),
        "verdict": card.verdict.strip()[:240],
        "scores": scores,
        "fixes": fixes,
        "best_roast": _unquote(card.best_roast)[:240],
        "best_toast": _unquote(card.best_toast)[:240],
    }


# ---------------------------------------------------------------------------
# The room
# ---------------------------------------------------------------------------
ROAST_AND_TOAST = register_room(
    RoomConfig(
        id="roast-and-toast",
        title="Roast & Toast",
        description="Your resume or project gets roasted, then gets real feedback.",
        personas=PERSONAS,
        languages=LANGUAGES,
        min_participants=3,
        max_participants=3,
        modes=MODES,
        context_fields=(
            ContextField(id="title", label="What's being reviewed", max_length=60),
            ContextField(id="material", label="The material (pasted text)", max_length=6000),
            ContextField(id="goal", label="The user's goal", max_length=120, required=False),
        ),
        max_messages=4,
        max_reactions=3,
        max_words=50,
        reaction_emojis=("💀", "😭", "🔥", "😂", "👏", "💯", "🫡"),
        speaker_instructions="You're on a review panel with two others. The user has shared their material "
        "(shown below) for you to review. Always be specific: refer to actual lines, sections or choices in "
        "the material, never generic advice. Build on, agree with or push back on the other panelists.",
        director_instructions="A review panel session with two phases (modes). In roast mode, panelists take "
        "turns roasting specific parts of the material, riffing on each other's jokes. In toast mode they give "
        "real feedback; Nandini usually leads with fixes, Sameer judges it against the user's goal, and Kabir "
        "turns his earlier jokes into advice. When the user asks a question, the most relevant panelist "
        "answers first. End each turn after 2-3 messages so the user can respond.",
        summary=SummarySpec(
            schema=Scorecard,
            instructions="Produce the panel's final scorecard for the material, based on the material itself and "
            "the conversation. Choose 3-5 categories that fit what was reviewed (for a resume e.g. Impact, Clarity, "
            "Relevance, Formatting; for a project e.g. Idea, Execution, Presentation). Be honest: scores should "
            "reflect real quality, not politeness. Fixes must be specific to this material, most important first, "
            "each credited to the panelist who'd give it. Include the best roast line and one genuine compliment.",
            finalize=_finalize_scorecard,
        ),
    )
)
