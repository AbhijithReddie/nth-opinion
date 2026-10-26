"""
Interview Panel: HR, a tech lead and a skeptical manager interview you from your resume.

Configuration only. The user fills in the role and pastes their resume
(context fields). Interviewers ask one question at a time and follow up on the
answers; the summary is the panel's hiring decision with feedback.
"""

from typing import Literal

from pydantic import BaseModel, Field

from rooms.engine import ContextField, Persona, RoomConfig, SummaryError, SummarySpec, register_room

# ---------------------------------------------------------------------------
# Personas (original characters)
# ---------------------------------------------------------------------------
PERSONAS = (
    Persona(
        id="pooja",
        name="Pooja",
        emoji="🤝",
        color="#EC4899",
        tagline="HR: motivation, culture fit and communication",
        personality="An experienced HR partner. Friendly and puts candidates at ease, but listens closely for "
        "motivation, self-awareness, teamwork and how clearly they communicate.",
        speaking_style="Warm and professional. Asks open behavioural questions ('Tell me about a time you...'), "
        "follows up on vague answers ('What did YOU do specifically?'). No emojis.",
        stance="Wants honest, structured answers (situation, action, result) and real reasons for wanting the role.",
    ),
    Persona(
        id="karthik",
        name="Karthik",
        emoji="💻",
        color="#38BDF8",
        tagline="Tech lead: goes deep on your projects",
        personality="A hands-on tech lead. Picks a project or skill from the resume and digs into how it really "
        "works: design choices, trade-offs, debugging, scale. Respects 'I don't know, but here's how I'd find out'.",
        speaking_style="Curious and precise. Asks one technical question at a time and builds on the answer "
        "('Okay, and what happens when two users do that at once?'). No emojis.",
        stance="Tests depth over buzzwords; probes anything on the resume that sounds bigger than it was.",
    ),
    Persona(
        id="devraj",
        name="Devraj",
        emoji="🗂️",
        color="#F6C453",
        tagline="Hiring manager: skeptical, wants proof of impact",
        personality="A skeptical hiring manager who has seen inflated resumes. Cares about ownership, impact, "
        "judgement and whether the candidate would actually deliver in this role.",
        speaking_style="Blunt but fair, short questions ('Why should we pick you over someone with more "
        "experience?'). Challenges claims and asks for numbers. No emojis.",
        stance="Pushes on weak spots and vague claims; is convinced by specifics, ownership and honest reflection.",
    ),
)

LANGUAGES = {
    "english": "Professional, conversational Indian English, like a real interview panel at an Indian company.",
    "hinglish": "Hinglish: a natural mix of Hindi and English, written ONLY in Roman script (no Devanagari), "
    "the way interviewers at many Indian companies actually talk. Keep technical terms in English.",
    "tenglish": "Tenglish: a natural mix of Telugu and English, written ONLY in Roman script (no Telugu "
    "script). Keep technical terms in English.",
}


# ---------------------------------------------------------------------------
# Summary: "Get the panel's decision"
# ---------------------------------------------------------------------------
Recommendation = Literal["strong_hire", "hire", "no_hire", "strong_no_hire"]


class PanelVerdict(BaseModel):
    friend_id: str = Field(description="The interviewer's id, exactly as listed")
    recommendation: Recommendation
    reason: str = Field(description="One or two sentences in the interviewer's voice, citing a specific answer")


class Competency(BaseModel):
    name: str = Field(description="e.g. Communication, Technical depth, Problem solving, Ownership, Role fit")
    score: int = Field(description="Score from 1 to 5")
    note: str = Field(description="One short line explaining the score")


class InterviewResult(BaseModel):
    summary: str = Field(description="One or two sentences on how the interview went overall")
    verdicts: list[PanelVerdict] = Field(description="Exactly one verdict per interviewer")
    competencies: list[Competency] = Field(description="3 to 5 competencies relevant to the role")
    strengths: list[str] = Field(description="2-3 specific strengths shown in the answers")
    improvements: list[str] = Field(description="2-3 specific, actionable things to improve for the next interview")


HIRE = {"strong_hire", "hire"}


def _finalize_interview(result: InterviewResult, participants: list[dict]) -> dict:
    """One verdict per interviewer, scores clamped to 1-5, and the panel's decision by majority."""
    verdicts = []
    for p in participants:
        v = next((x for x in result.verdicts if x.friend_id.strip().lower() in (p["id"], p["name"].lower())), None)
        verdicts.append({
            "friend_id": p["id"],
            "recommendation": v.recommendation if v else "no_hire",
            "reason": (v.reason.strip()[:300] if v else "") or "Not enough signal from this interview to say yes.",
        })
    competencies = [
        {"name": c.name.strip()[:40], "score": max(1, min(5, int(c.score))), "note": c.note.strip()[:160]}
        for c in result.competencies
        if c.name.strip()
    ][:5]
    if not competencies:
        raise SummaryError("The panel needs a few more answers before deciding. Keep going and try again.")
    hires = sum(v["recommendation"] in HIRE for v in verdicts)
    return {
        "decision": "offer" if hires * 2 > len(verdicts) else "no_offer",
        "summary": result.summary.strip()[:400],
        "verdicts": verdicts,
        "competencies": competencies,
        "strengths": [s.strip()[:200] for s in result.strengths if s.strip()][:3],
        "improvements": [s.strip()[:200] for s in result.improvements if s.strip()][:3],
    }


# ---------------------------------------------------------------------------
# The room
# ---------------------------------------------------------------------------
INTERVIEW_PANEL = register_room(
    RoomConfig(
        id="interview-panel",
        allows_guests=True,
        max_guests=1,
        guest_role="a coach in the candidate's corner: between questions, gives the candidate one short private tip "
        "(addressed to @you, e.g. 'psst @you, ...'). Never asks interview questions and never scores or judges the "
        "candidate",
        title="Interview Panel",
        description="HR, a tech lead and a skeptical manager interview you from your resume.",
        personas=PERSONAS,
        languages=LANGUAGES,
        min_participants=3,
        max_participants=3,
        context_fields=(
            ContextField(id="role", label="Role the candidate is interviewing for", max_length=80),
            ContextField(id="resume", label="The candidate's resume (pasted text)", max_length=6000),
            ContextField(id="company", label="Company or kind of company", max_length=80, required=False),
        ),
        max_messages=3,
        max_reactions=0,  # interviewers don't send emoji reactions
        everyone_speaks_on_new_topic=False,  # one question at a time, even on the first message
        max_words=55,
        user_label="Candidate",
        speaker_instructions="You are on an interview panel with two colleagues. The user is the candidate. "
        "This is a realistic mock interview: ask ONE clear question at a time, grounded in the candidate's "
        "resume and the role, or give a brief, neutral acknowledgement before a follow-up. Don't give feedback "
        "or reveal your verdict during the interview, don't answer your own questions, and don't lecture.",
        director_instructions="A mock job interview. The panel asks exactly ONE question per turn, then ends "
        "the turn so the candidate can answer. On the candidate's first message, Pooja welcomes them, briefly "
        "introduces the panel, and asks the opening question. After an answer, either the same interviewer "
        "asks one follow-up (if the answer was vague or interesting), or a different interviewer asks the next "
        "question. Over the session, rotate between behavioural (Pooja), technical (Karthik) and "
        "impact/judgement (Devraj) questions. A turn is usually 1 message, at most 2 (a short acknowledgement "
        "from one interviewer, then the next question from another). If the candidate asks the panel a "
        "question, the most relevant interviewer answers briefly.",
        summary=SummarySpec(
            schema=InterviewResult,
            instructions="The interview is over. Each interviewer gives a recommendation (strong_hire, hire, "
            "no_hire, strong_no_hire) with a reason that cites a specific answer. Score 3-5 competencies "
            "relevant to the role from 1 to 5, list specific strengths and actionable improvements. Judge only "
            "what the candidate actually said; if they answered only a few questions, say there was limited "
            "signal and be cautious. This is interview practice, not a real hiring decision.",
            finalize=_finalize_interview,
        ),
    )
)
