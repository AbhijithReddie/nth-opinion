import type { ReactNode } from "react";
import { DEBATERS, type Persona } from "@/config/personas";
import { ROOM_CHATS } from "@/config/roomChats";
import type { RoomMeta } from "@/config/rooms";
import { SITE_TAGLINE } from "@/config/site";
import type { SummaryData } from "@/lib/chatTypes";
import { clip, isPrivate, keySentence, privateTexts, redactor, SITE_ADDRESS, SHARE_SIZES, type ShareResult, type ShareSize } from "@/lib/share";
import { LogoMark } from "../brand/LogoMark";
import { Wordmark } from "../brand/Wordmark";
import { Avatar } from "../chat/Avatar";
import { TrophyIcon } from "../icons";
import { RoomIcon } from "../illustrations/RoomIcon";
import { RoomIllustration } from "../illustrations/RoomIllustration";

export interface ShareCardProps {
  result: ShareResult;
  room: RoomMeta;
  size: ShareSize;
  /** The result came from a demo replay. */
  demo: boolean;
  /** "Include my question": show the user's own question and personal details. */
  includePrivate: boolean;
}

/**
 * The shareable result card at its real pixel size (1080 x 1080 or 1080 x 1920),
 * in the Chai & Sage theme: logo and room up top, the room's illustration, the
 * result, and a "Get your Nth Opinion" footer. The dialog shows it scaled down
 * and turns a hidden full-size copy into the PNG.
 */
export function ShareCard({ result, room, size, demo, includePrivate }: ShareCardProps) {
  const { width, height } = SHARE_SIZES[size];
  const story = size === "story";
  // Private rooms blank out what the user typed unless they chose to include it.
  const hide = !includePrivate && isPrivate(result);
  const content = cardContent(result, hide ? redactor(privateTexts(result)) : (text) => text, hide);

  return (
    <div
      style={{
        width,
        height,
        background: `radial-gradient(circle at 96% 4%, color-mix(in srgb, ${room.accent} 42%, transparent) 0, transparent 36%), radial-gradient(circle at 0% 100%, color-mix(in srgb, ${room.accent} 22%, transparent) 0, transparent 42%), var(--color-canvas)`,
      }}
      className="flex flex-col overflow-hidden px-[72px] pt-[64px] pb-[56px] font-sans text-ink"
    >
      <header className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <LogoMark className="size-[76px]" />
          <Wordmark className="text-[46px]" />
        </div>
        <span
          className="flex items-center gap-3 rounded-full border-[3px] bg-surface py-2.5 pr-7 pl-3 text-[26px] font-semibold"
          style={{ borderColor: room.accent, color: room.accentInk }}
        >
          <RoomIcon room={room} className="size-12 rounded-full" glyphClassName="size-7" />
          {room.title}
        </span>
      </header>

      {/* Illustrations fill their container's width, so a wrapper sets the size. */}
      {story && (
        <div className="mx-auto mt-14 w-[820px]">
          <RoomIllustration roomId={room.id} />
        </div>
      )}

      <div className={`flex gap-8 ${story ? "mt-12" : "mt-14"}`}>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-4 font-mono text-[24px] font-semibold tracking-[0.14em] uppercase" style={{ color: room.accentInk }}>
            {content.eyebrow}
            {demo && (
              <span className="rounded-full border-2 border-line-strong bg-surface px-4 py-1 font-sans text-[20px] tracking-normal text-muted normal-case">
                From a demo conversation
              </span>
            )}
          </p>
          <h1 className="mt-4 font-display text-[54px] leading-[1.08] font-semibold text-balance">{content.headline}</h1>
          {content.subline && <p className="mt-4 text-[30px] leading-snug text-muted">{content.subline}</p>}
        </div>
        {!story && (
          <div className="w-[260px] shrink-0 self-start">
            <RoomIllustration roomId={room.id} />
          </div>
        )}
      </div>

      <div className={`mt-12 ${story ? "flex flex-1 flex-col justify-center" : ""}`}>{content.body}</div>

      <footer className="mt-auto flex items-end justify-between gap-6 border-t-[3px] border-line pt-8">
        <div>
          <p className="font-display text-[40px] leading-none font-semibold">Get your Nth Opinion</p>
          <p className="mt-2 text-[24px] text-muted">{SITE_TAGLINE}</p>
        </div>
        <p className="font-mono text-[28px] font-semibold" style={{ color: room.accentInk }}>
          {SITE_ADDRESS}
        </p>
      </footer>
    </div>
  );
}

interface CardContent {
  eyebrow: string;
  headline: ReactNode;
  subline?: string;
  body: ReactNode;
}

/** What each room's card says. `safe` blanks private details; `hide` is true when the user's question stays off the card. */
function cardContent(result: ShareResult, safe: (text: string) => string, hide: boolean): CardContent {
  if (result.kind === "debate") {
    const { topic, verdict } = result;
    return {
      eyebrow: "The motion",
      headline: `“${clip(topic, 120)}”`,
      body: <DebateBody verdict={verdict} />,
    };
  }

  const { setup, summary, roomId } = result;
  const config = Object.values(ROOM_CHATS).find((c) => c.roomId === roomId);
  const persona = (id: string) => config?.personas.find((p) => p.id === id);
  const nameOf = (id: string) => setup.participants.find((p) => p.id === id)?.name ?? persona(id)?.name ?? "Someone";
  const who = (id: string) => ({ persona: persona(id), name: nameOf(id) });
  return roomContent(summary, setup.title, setup.context, who, safe, hide);
}

type Who = (id: string) => { persona?: Persona; name: string };

function roomContent(summary: SummaryData, title: string, context: Record<string, string>, who: Who, safe: (t: string) => string, hide: boolean): CardContent {
  switch (summary.type) {
    case "poll": {
      const poll = summary.data;
      // 2-3 reasons, covering as many different options as possible.
      const firstPerOption = poll.options.map((o) => poll.votes.find((v) => v.option === o)).filter((v) => !!v);
      const reasons = [...new Set([...firstPerOption, ...poll.votes])].filter((v) => v.reason).slice(0, 3);
      return {
        eyebrow: "My AI friends voted",
        headline: hide ? "I asked my AI friend group. Here's the verdict." : clip(poll.question, 110),
        body: (
          <div className="space-y-8">
            <VoteBars options={poll.options.slice(0, 4).map((o) => ({ label: safe(o), votes: poll.votes.filter((v) => v.option === o).length }))} total={poll.votes.length} />
            <ul className="space-y-5">
              {reasons.map((v) => (
                <Quote key={v.friend_id} who={who(v.friend_id)} text={`“${clip(safe(v.reason), 90)}”`} />
              ))}
            </ul>
          </div>
        ),
      };
    }

    case "offers": {
      const offers = summary.data;
      return {
        eyebrow: "I pitched to AI investors",
        headline: title || "My pitch",
        subline: clip(context.sector || offers.summary, 110),
        body: (
          <ul className="space-y-5">
            {offers.decisions.map((d) => (
              <Quote
                key={d.friend_id}
                who={who(d.friend_id)}
                text={clip(d.reason, 80)}
                badge={
                  d.decision === "offer" ? (
                    <span className="rounded-full bg-pro-soft px-5 py-2 text-pro-deep">
                      {d.amount_lakh !== null ? `₹${d.amount_lakh} lakh` : "Offer"}
                      {d.equity_percent !== null ? ` for ${d.equity_percent}%` : ""}
                    </span>
                  ) : (
                    <span className="rounded-full bg-sand px-5 py-2 text-muted">I&apos;m out</span>
                  )
                }
              />
            ))}
          </ul>
        ),
      };
    }

    case "interview": {
      const r = summary.data;
      const ranked = [...r.competencies].sort((a, b) => b.score - a.score);
      const overall = r.competencies.length ? r.competencies.reduce((sum, c) => sum + c.score, 0) / r.competencies.length : 0;
      // Without "Include my question", only competency names: the written feedback can quote the resume.
      const strength = hide ? (ranked[0] ? `${ranked[0].name} (${ranked[0].score}/5)` : "") : (r.strengths[0] ?? "");
      const improve = hide ? (ranked.at(-1)?.name ?? "") : (r.improvements[0] ?? "");
      return {
        eyebrow: "Mock interview with an AI panel",
        headline: hide ? "I faced a three-person AI interview panel" : title,
        body: (
          <div className="space-y-8">
            <div className="flex items-center gap-6">
              <p className="font-display text-[110px] leading-none font-semibold">
                {overall.toFixed(1)}
                <span className="text-[44px] text-muted">/5</span>
              </p>
              <span className={`rounded-full px-6 py-3 text-[30px] font-semibold ${r.decision === "offer" ? "bg-pro-soft text-pro-deep" : "bg-sand text-muted"}`}>
                {r.decision === "offer" ? "Offer!" : "No offer yet"}
              </span>
            </div>
            <Point label="Top strength" text={clip(strength, 130)} />
            <Point label="One thing to improve" text={clip(improve, 130)} />
          </div>
        ),
      };
    }

    case "scorecard": {
      const card = summary.data;
      const tip = card.fixes[0];
      return {
        eyebrow: "Roasted, then toasted",
        headline: hide ? "My work got roasted by an AI panel" : title,
        body: (
          <div className="space-y-8">
            <p className="font-display text-[46px] leading-tight font-semibold">
              <span className="mr-4 rounded-full bg-terracotta-soft px-5 py-1 align-middle font-mono text-[30px] text-terracotta-deep">{card.overall}/10</span>
              {`“${clip(safe(card.best_roast).replace(/^["“]|["”]$/g, ""), 120)}”`}
            </p>
            {tip && <Point label="The real tip" text={`${safe(tip.title)}: ${clip(safe(tip.detail), 120)}`} />}
          </div>
        ),
      };
    }

    case "letters": {
      const r = summary.data;
      return {
        eyebrow: "Advice from my future selves",
        headline: hide ? "I asked my future selves what to do" : clip(r.decision || title, 110),
        body: (
          <ul className="space-y-6">
            {r.letters.map((l) => (
              <Quote key={l.friend_id} who={who(l.friend_id)} text={`“${safe(keySentence(l.letter))}”`} />
            ))}
          </ul>
        ),
      };
    }

    case "notes": {
      const notes = summary.data;
      return {
        eyebrow: "Study group",
        headline: clip(notes.topic || title, 90),
        body: (
          <div>
            <p className="font-mono text-[24px] font-semibold tracking-[0.14em] text-muted uppercase">3 things I learned</p>
            <ol className="mt-5 space-y-5">
              {notes.key_points.slice(0, 3).map((point, i) => (
                <li key={i} className="flex gap-5 text-[32px] leading-snug">
                  <span className="grid size-14 shrink-0 place-items-center rounded-full bg-room-study/25 font-mono text-[26px] font-semibold text-room-study-ink">
                    {i + 1}
                  </span>
                  {clip(point, 120)}
                </li>
              ))}
            </ol>
          </div>
        ),
      };
    }
  }
}

function DebateBody({ verdict }: { verdict: Extract<ShareResult, { kind: "debate" }>["verdict"] }) {
  const sides = (["pro", "con"] as const).map((side) => {
    const s = verdict.scores[side];
    return { side, persona: DEBATERS.find((p) => p.id === side)!, s, total: s.logic + s.evidence + s.rebuttal };
  });
  return (
    <div className="space-y-8">
      <span
        className={`inline-flex items-center gap-3 rounded-full px-8 py-3 font-display text-[40px] font-semibold ${
          verdict.winner === "pro" ? "bg-pro-soft text-pro-deep" : verdict.winner === "con" ? "bg-con-soft text-con-deep" : "bg-judge-soft text-judge-deep"
        }`}
      >
        <TrophyIcon className="size-10" />
        {verdict.winner === "tie" ? "It's a tie" : `${verdict.winner === "pro" ? "Pro" : "Con"} wins`}
      </span>
      {sides.map(({ side, persona, s, total }) => (
        <div key={side} className="flex items-center gap-6">
          <Avatar persona={persona} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between text-[32px] font-semibold">
              {persona.name}
              <span className="font-mono">{total}/30</span>
            </div>
            <div className="mt-2 h-5 overflow-hidden rounded-full bg-sand">
              <div className={`h-full rounded-full ${side === "pro" ? "bg-pro" : "bg-con"}`} style={{ width: `${(total / 30) * 100}%` }} />
            </div>
            <p className="mt-2 font-mono text-[22px] text-muted">
              Logic {s.logic} · Evidence {s.evidence} · Rebuttal {s.rebuttal}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function VoteBars({ options, total }: { options: { label: string; votes: number }[]; total: number }) {
  const top = Math.max(...options.map((o) => o.votes));
  return (
    <ul className="space-y-5">
      {options.map((o) => (
        <li key={o.label}>
          <div className="flex items-baseline justify-between gap-6 text-[30px]">
            <span className={o.votes === top ? "font-semibold" : ""}>{clip(o.label, 50)}</span>
            <span className="shrink-0 font-mono text-[24px] text-muted">
              {o.votes} {o.votes === 1 ? "vote" : "votes"}
            </span>
          </div>
          <div className="mt-2 h-5 overflow-hidden rounded-full bg-sand">
            <div className={`h-full rounded-full ${o.votes === top ? "bg-accent" : "bg-line-strong"}`} style={{ width: `${(o.votes / (total || 1)) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** A persona with what they said (and an optional badge such as an offer). */
function Quote({ who, text, badge }: { who: { persona?: Persona; name: string }; text: string; badge?: ReactNode }) {
  return (
    <li className="flex gap-5">
      {who.persona && <Avatar persona={who.persona} size="xl" />}
      <div className="min-w-0 flex-1">
        <p className="flex items-center justify-between gap-4 text-[28px] font-semibold">
          {who.name}
          {badge && <span className="shrink-0 text-[26px]">{badge}</span>}
        </p>
        <p className="mt-1 text-[28px] leading-snug text-ink/85">{text}</p>
      </div>
    </li>
  );
}

function Point({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-3xl border-2 border-line bg-surface px-7 py-5">
      <p className="font-mono text-[22px] font-semibold tracking-[0.14em] text-muted uppercase">{label}</p>
      <p className="mt-2 text-[32px] leading-snug">{text}</p>
    </div>
  );
}
