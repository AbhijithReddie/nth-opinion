/**
 * The PDF report, drawn with @react-pdf/renderer in the browser (loaded only when
 * someone clicks "Download PDF report"; see ./index.ts).
 *
 * Chai & Sage style: cream page, ink text, Fraunces headings, Figtree body,
 * IBM Plex Mono numbers. Reports contain the room's outputs only, never the
 * text of uploaded documents.
 */

import { Circle, Document, Font, Page, Path, Rect, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import type { ReportInput } from "./index";

const C = {
  canvas: "#fbf7f0",
  surface: "#ffffff",
  sand: "#f3ece1",
  line: "#e8dfd1",
  ink: "#2b2240",
  muted: "#5e5670",
  terracotta: "#b84a36",
  terracottaDeep: "#9a3b2a",
  terracottaSoft: "#f7e4dd",
  sageDeep: "#3f6b4e",
  sageSoft: "#e3ede5",
  lavenderDeep: "#5f4ba0",
  lavenderSoft: "#eee9f9",
  butterDeep: "#7a5800",
  butterSoft: "#fcf1cf",
};

const DISCLAIMER = "AI-generated perspectives for practice and entertainment, not professional advice.";

let fontsRegistered = false;
/** The site's fonts (WOFF copies in public/fonts; react-pdf can't read next/font's WOFF2). */
export function registerFonts(origin: string) {
  if (fontsRegistered) return;
  fontsRegistered = true;
  Font.register({ family: "Fraunces", src: `${origin}/fonts/fraunces-latin-600-normal.woff`, fontWeight: 600 });
  Font.register({
    family: "Figtree",
    fonts: [
      { src: `${origin}/fonts/figtree-latin-400-normal.woff`, fontWeight: 400 },
      { src: `${origin}/fonts/figtree-latin-600-normal.woff`, fontWeight: 600 },
    ],
  });
  Font.register({ family: "PlexMono", src: `${origin}/fonts/ibm-plex-mono-latin-400-normal.ttf` });
  Font.registerHyphenationCallback((word) => [word]); // no mid-word hyphens
}

/**
 * Text the report fonts can draw (their Latin subset): rupee as "Rs", no emoji or other scripts
 * (Hinglish and Tenglish are written in Roman script, so they stay).
 */
export function clean(text: string | null | undefined): string {
  return (text ?? "")
    .replace(/₹\s?/g, "Rs ")
    .replace(/[→⇒]/g, "->")
    .replace(/[^\u0000-ÿŒœ–—‘’“”•…€™]/gu, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([.,!?;:])/g, "$1") // a removed emoji can leave "clearly ."
    .trim();
}

const s = StyleSheet.create({
  page: { backgroundColor: C.canvas, color: C.ink, fontFamily: "Figtree", fontSize: 10.5, lineHeight: 1.45, paddingTop: 40, paddingBottom: 64, paddingHorizontal: 44 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  brand: { flexDirection: "row", alignItems: "center" },
  wordmark: { fontFamily: "Fraunces", fontWeight: 600, fontSize: 18, marginLeft: 8 },
  sup: { fontSize: 9, verticalAlign: "super" },
  meta: { fontFamily: "PlexMono", fontSize: 8.5, color: C.muted, textAlign: "right" },
  demo: { marginTop: 3, alignSelf: "flex-end", backgroundColor: C.lavenderSoft, color: C.lavenderDeep, fontSize: 8, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 6 },
  eyebrow: { fontFamily: "PlexMono", fontSize: 8.5, letterSpacing: 1.5, color: C.terracottaDeep, textTransform: "uppercase" },
  title: { fontFamily: "Fraunces", fontWeight: 600, fontSize: 24, lineHeight: 1.15, marginTop: 4 },
  subtitle: { color: C.muted, marginTop: 4, fontSize: 11 },
  h2: { fontFamily: "Fraunces", fontWeight: 600, fontSize: 14, marginTop: 18, marginBottom: 6 },
  card: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 10, marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "flex-start" },
  bold: { fontWeight: 600 },
  muted: { color: C.muted },
  mono: { fontFamily: "PlexMono" },
  bullet: { flexDirection: "row", marginBottom: 3 },
  bulletMark: { width: 12, color: C.terracottaDeep },
  checkbox: { width: 9, height: 9, borderWidth: 1, borderColor: C.ink, borderRadius: 2, marginTop: 3, marginRight: 7 },
  pill: { borderRadius: 8, paddingVertical: 2, paddingHorizontal: 7, fontSize: 9, fontWeight: 600 },
  // Fixed footer on every page: a rule and the disclaimer (absolutely positioned).
  footerRule: { position: "absolute", bottom: 44, left: 44, right: 44, borderTopWidth: 1, borderTopColor: C.line },
  footerText: { position: "absolute", bottom: 26, left: 44, right: 44, fontSize: 8, color: C.muted },
});

/** The logo mark (the favicon's simplified shapes): a speech bubble with three AI heads and a person. */
function Logo() {
  return (
    <Svg width={26} height={26} viewBox="0 0 32 32">
      <Path fill={C.terracotta} d="M9 1H23A8 8 0 0 1 31 9V19A8 8 0 0 1 23 27H14L7 31.5L9 27A8 8 0 0 1 1 19V9A8 8 0 0 1 9 1Z" />
      <Rect x={3.5} y={9.5} width={7} height={6.5} rx={2} fill="#A9CDB3" />
      <Rect x={12.5} y={3.5} width={7} height={6.5} rx={2} fill="#D3C6F2" />
      <Rect x={21.5} y={9.5} width={7} height={6.5} rx={2} fill="#F2CF63" />
      <Circle cx={16} cy={16.2} r={3.4} fill="#FFF8EE" />
      <Path fill="#FFF8EE" d="M9.5 26C9.5 22.2 12.3 20.6 16 20.6S22.5 22.2 22.5 26Z" />
    </Svg>
  );
}

// --- small building blocks ---------------------------------------------------------
const H2 = ({ children }: { children: ReactNode }) => <Text style={s.h2}>{children}</Text>;

function Bullets({ items, mark = "•" }: { items: string[]; mark?: string }) {
  return (
    <View>
      {items.filter(Boolean).map((item, i) => (
        <View key={i} style={s.bullet} wrap={false}>
          <Text style={s.bulletMark}>{mark}</Text>
          <Text style={{ flex: 1 }}>{clean(item)}</Text>
        </View>
      ))}
    </View>
  );
}

/** A checklist with empty boxes to tick on paper. */
function Checklist({ items }: { items: { title: string; detail?: string }[] }) {
  return (
    <View>
      {items.map((item, i) => (
        <View key={i} style={[s.row, { marginBottom: 5 }]} wrap={false}>
          <View style={s.checkbox} />
          <Text style={{ flex: 1 }}>
            <Text style={s.bold}>{clean(item.title)}</Text>
            {item.detail ? <Text style={s.muted}>{` ${clean(item.detail)}`}</Text> : null}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Card({ title, aside, children }: { title?: string; aside?: ReactNode; children?: ReactNode }) {
  return (
    <View style={s.card} wrap={false}>
      {(title || aside) && (
        <View style={[s.row, { justifyContent: "space-between", marginBottom: children ? 3 : 0 }]}>
          {title ? <Text style={s.bold}>{clean(title)}</Text> : <View />}
          {aside}
        </View>
      )}
      {children}
    </View>
  );
}

function Pill({ text, tone }: { text: string; tone: "good" | "bad" | "neutral" }) {
  const colours = { good: [C.sageSoft, C.sageDeep], bad: [C.terracottaSoft, C.terracottaDeep], neutral: [C.sand, C.muted] }[tone];
  return <Text style={[s.pill, { backgroundColor: colours[0], color: colours[1] }]}>{clean(text)}</Text>;
}

/** A score as a bar out of `max`. */
function Bar({ value, max, colour = C.sageDeep }: { value: number; max: number; colour?: string }) {
  return (
    <View style={{ height: 6, backgroundColor: C.sand, borderRadius: 3, marginTop: 3 }}>
      <View style={{ width: `${Math.max(0, Math.min(1, value / max)) * 100}%`, height: 6, backgroundColor: colour, borderRadius: 3 }} />
    </View>
  );
}

const RECOMMENDATION: Record<string, [string, "good" | "bad"]> = {
  strong_hire: ["Strong hire", "good"],
  hire: ["Hire", "good"],
  no_hire: ["No hire", "bad"],
  strong_no_hire: ["Strong no hire", "bad"],
};

// --- the document ----------------------------------------------------------------------
export function ReportDocument({ input, date }: { input: ReportInput; date: string }) {
  const body = input.kind === "debate" ? debateBody(input) : roomBody(input);
  return (
    <Document title={`${input.roomTitle} report - Nth Opinion`} author="Nth Opinion" subject={DISCLAIMER}>
      <Page size="A4" style={s.page}>
        <View style={s.header} fixed>
          <View style={s.brand}>
            <Logo />
            <Text style={s.wordmark}>
              N<Text style={s.sup}>th</Text> Opinion
            </Text>
          </View>
          <View>
            <Text style={s.meta}>{clean(input.roomTitle)} · {date}</Text>
            {input.demo && <Text style={s.demo}>From a demo conversation</Text>}
          </View>
        </View>

        <Text style={s.eyebrow}>{clean(input.roomTitle)} report</Text>
        <Text style={s.title}>{clean(body.title)}</Text>
        {body.subtitle ? <Text style={s.subtitle}>{clean(body.subtitle)}</Text> : null}

        {body.content}

        <View style={s.footerRule} fixed />
        <Text style={s.footerText} fixed>
          {DISCLAIMER}
        </Text>
      </Page>
    </Document>
  );
}

type Body = { title: string; subtitle?: string; content: ReactNode };

function debateBody(input: Extract<ReportInput, { kind: "debate" }>): Body {
  const { verdict, turns } = input;
  const winner = verdict.winner === "tie" ? "It's a tie" : `${verdict.winner === "pro" ? "Pro" : "Con"} wins`;
  return {
    title: `"${input.topic}"`,
    subtitle: `${input.rounds} ${input.rounds === 1 ? "round" : "rounds"} · ${winner}`,
    content: (
      <>
        <H2>Scores</H2>
        {(["pro", "con"] as const).map((side) => {
          const sc = verdict.scores[side];
          const total = sc.logic + sc.evidence + sc.rebuttal;
          return (
            <Card key={side} title={side === "pro" ? "Pro (for the motion)" : "Con (against the motion)"} aside={<Text style={s.mono}>{total}/30</Text>}>
              <Bar value={total} max={30} colour={side === "pro" ? C.sageDeep : C.terracottaDeep} />
              <Text style={[s.mono, s.muted, { fontSize: 8.5, marginTop: 4 }]}>
                Logic {sc.logic} · Evidence {sc.evidence} · Rebuttal {sc.rebuttal}
              </Text>
            </Card>
          );
        })}
        <H2>Decision memo</H2>
        <Text>{clean(verdict.memo)}</Text>
        <H2>Full transcript</H2>
        {turns.map((t, i) => (
          <Card key={i} title={`Round ${t.round} · ${t.speaker === "pro" ? "Pro" : "Con"}`}>
            <Text>{clean(t.text)}</Text>
          </Card>
        ))}
      </>
    ),
  };
}

function roomBody(input: Extract<ReportInput, { kind: "room" }>): Body {
  const { summary, nameOf } = input;
  const personaMessages = input.messages.filter((m) => m.sender !== "user");

  switch (summary.type) {
    case "interview": {
      const r = summary.data;
      const overall = r.competencies.length ? r.competencies.reduce((sum, c) => sum + c.score, 0) / r.competencies.length : 0;
      return {
        title: input.setupTitle || "Mock interview",
        subtitle: `Overall ${overall.toFixed(1)}/5 · ${r.decision === "offer" ? "The panel would make an offer" : "No offer yet"}`,
        content: (
          <>
            <Text style={{ marginTop: 8 }}>{clean(r.summary)}</Text>
            <H2>The panel</H2>
            {r.verdicts.map((v) => {
              const [label, tone] = RECOMMENDATION[v.recommendation] ?? [v.recommendation, "bad"];
              return (
                <Card key={v.friend_id} title={nameOf(v.friend_id)} aside={<Pill text={label} tone={tone} />}>
                  <Text style={s.muted}>{clean(v.reason)}</Text>
                </Card>
              );
            })}
            <H2>Scores</H2>
            {r.competencies.map((c) => (
              <Card key={c.name} title={c.name} aside={<Text style={s.mono}>{c.score}/5</Text>}>
                <Bar value={c.score} max={5} />
                <Text style={[s.muted, { marginTop: 4 }]}>{clean(c.note)}</Text>
              </Card>
            ))}
            {r.recap?.length ? (
              <>
                <H2>Question by question</H2>
                {r.recap.map((q, i) => (
                  <Card key={i} title={`${i + 1}. ${q.question}`}>
                    <Text style={s.muted}>Your answer: {clean(q.answer)}</Text>
                    <Text style={{ marginTop: 2 }}>Feedback: {clean(q.feedback)}</Text>
                  </Card>
                ))}
              </>
            ) : null}
            <H2>Strengths</H2>
            <Bullets items={r.strengths} mark="+" />
            <H2>Areas to improve</H2>
            <Checklist items={r.improvements.map((title) => ({ title }))} />
            {r.job_match ? (
              <>
                <H2>Job match: {r.job_match.score}/100</H2>
                <Bar value={r.job_match.score} max={100} />
                <View style={[s.row, { marginTop: 8 }]}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={s.bold}>Skills you match</Text>
                    <Bullets items={r.job_match.matched_skills} mark="+" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.bold}>Missing or weak</Text>
                    <Bullets items={r.job_match.missing_skills} mark="-" />
                  </View>
                </View>
                <Text style={[s.bold, { marginTop: 6 }]}>Top 3 to work on</Text>
                <Checklist items={r.job_match.focus.map((title) => ({ title }))} />
              </>
            ) : null}
          </>
        ),
      };
    }

    case "offers": {
      const o = summary.data;
      const offer = (d: (typeof o.decisions)[number]) =>
        d.decision === "offer" ? `Offer: Rs ${d.amount_lakh ?? "?"} lakh for ${d.equity_percent ?? "?"}%` : "Out";
      return {
        title: input.setupTitle || "My pitch",
        subtitle: [input.context.sector, input.context.ask && `Ask: ${input.context.ask}`].filter(Boolean).join(" · "),
        content: (
          <>
            <H2>How the pitch went</H2>
            <Text>{clean(o.summary)}</Text>
            <H2>The investors</H2>
            {o.decisions.map((d) => (
              <Card key={d.friend_id} title={nameOf(d.friend_id)} aside={<Pill text={offer(d)} tone={d.decision === "offer" ? "good" : "neutral"} />}>
                <Text style={s.muted}>{clean(d.reason)}</Text>
                {d.conditions ? <Text style={{ marginTop: 2 }}>Condition: {clean(d.conditions)}</Text> : null}
              </Card>
            ))}
            <H2>Strengths</H2>
            <Bullets items={o.strengths} mark="+" />
            <H2>Key concerns</H2>
            <Checklist items={o.concerns.map((title) => ({ title }))} />
            {o.slide_feedback?.length ? (
              <>
                <H2>Slide by slide</H2>
                {o.slide_feedback.map((n, i) => (
                  <Card key={i} title={`Slide ${n.slide}`}>
                    <Text style={s.muted}>{clean(n.feedback)}</Text>
                  </Card>
                ))}
              </>
            ) : null}
          </>
        ),
      };
    }

    case "scorecard": {
      const card = summary.data;
      // The roast phase: persona messages before the switch to real feedback.
      const best = clean(card.best_roast).replace(/^"|"$/g, "");
      const roasts = input.roastLines.filter((m) => clean(m.text) !== best).slice(0, 4);
      return {
        title: input.setupTitle || "Roast & Toast",
        subtitle: `Overall ${card.overall}/10 · ${card.verdict}`,
        content: (
          <>
            <H2>Best roast lines</H2>
            <Card>
              <Text style={{ fontFamily: "Fraunces", fontWeight: 600, fontSize: 12 }}>{`"${best}"`}</Text>
            </Card>
            {roasts.map((m, i) => (
              <Bullets key={i} items={[`${nameOf(m.sender)}: ${m.text}`]} mark="-" />
            ))}
            <H2>The toast</H2>
            <Text>{clean(card.best_toast)}</Text>
            <H2>Scores</H2>
            {card.scores.map((c) => (
              <Card key={c.category} title={c.category} aside={<Text style={s.mono}>{c.score}/10</Text>}>
                <Bar value={c.score} max={10} colour={C.terracottaDeep} />
                <Text style={[s.muted, { marginTop: 4 }]}>{clean(c.note)}</Text>
              </Card>
            ))}
            <H2>Your improvement checklist</H2>
            <Checklist items={card.fixes.map((f) => ({ title: f.title, detail: f.detail }))} />
          </>
        ),
      };
    }

    case "notes": {
      const n = summary.data;
      return {
        title: n.topic || input.setupTitle,
        subtitle: "Study notes",
        content: (
          <>
            <H2>Key points</H2>
            <Bullets items={n.key_points} />
            <H2>Analogies and memes</H2>
            <Bullets items={[n.memory_trick, ...(n.analogies ?? [])]} mark="*" />
            <H2>Self-quiz</H2>
            {n.quiz.slice(0, 5).map((q, i) => (
              <Card key={i} title={`${i + 1}. ${q.question}`}>
                <Text style={s.muted}>Answer: {clean(q.answer)}</Text>
              </Card>
            ))}
            {n.weak_spots.length ? (
              <>
                <H2>Go over these again</H2>
                <Checklist items={n.weak_spots.map((title) => ({ title }))} />
              </>
            ) : null}
            <H2>Study next</H2>
            <Bullets items={n.next_topics} mark="->" />
          </>
        ),
      };
    }

    case "poll": {
      const poll = summary.data;
      const total = poll.votes.length || 1;
      // Highlights: the most-reacted persona messages, in the order they were sent.
      const highlights = [...personaMessages]
        .map((m, i) => ({ m, i }))
        .sort((a, b) => b.m.reactions.length - a.m.reactions.length || a.i - b.i)
        .slice(0, 6)
        .sort((a, b) => a.i - b.i);
      return {
        title: input.setupTitle || "The Group Chat",
        subtitle: input.messages.find((m) => m.sender === "user")?.text,
        content: (
          <>
            <H2>The vote: {clean(poll.question)}</H2>
            {poll.options.map((option) => {
              const votes = poll.votes.filter((v) => v.option === option);
              return (
                <Card key={option} title={option} aside={<Text style={s.mono}>{votes.length} {votes.length === 1 ? "vote" : "votes"}</Text>}>
                  <Bar value={votes.length} max={total} colour={C.lavenderDeep} />
                  {votes.map((v) => (
                    <Text key={v.friend_id} style={[s.muted, { marginTop: 3 }]}>
                      {nameOf(v.friend_id)}: {clean(v.reason)}
                    </Text>
                  ))}
                </Card>
              );
            })}
            <H2>Conversation highlights</H2>
            {highlights.map(({ m }, i) => (
              <Bullets key={i} items={[`${nameOf(m.sender)}: ${m.text}`]} mark="-" />
            ))}
          </>
        ),
      };
    }

    case "letters": {
      const r = summary.data;
      return {
        title: r.decision || input.setupTitle,
        subtitle: "Advice from your future selves",
        content: (
          <>
            {r.letters.map((l) => (
              <View key={l.friend_id}>
                <H2>{nameOf(l.friend_id)}</H2>
                <Text>{clean(l.letter)}</Text>
              </View>
            ))}
            {r.paths.length ? (
              <>
                <H2>The paths</H2>
                {r.paths.map((p, i) => (
                  <Card key={i} title={p.option}>
                    <Text>Upside: {clean(p.upside)}</Text>
                    <Text style={s.muted}>Risk: {clean(p.risk)}</Text>
                  </Card>
                ))}
              </>
            ) : null}
            <H2>Reflection checklist</H2>
            <Checklist items={[...r.next_steps.map((title) => ({ title })), ...(r.question ? [{ title: r.question }] : [])]} />
          </>
        ),
      };
    }
  }
}
