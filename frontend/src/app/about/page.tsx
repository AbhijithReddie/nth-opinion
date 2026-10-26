import type { Metadata } from "next";
import { AgentDiagram } from "@/components/about/AgentDiagram";
import { LogoMark } from "@/components/brand/LogoMark";
import { Wordmark } from "@/components/brand/Wordmark";
import { Footer } from "@/components/Footer";
import { TECH_STACK } from "@/components/home/BuiltWith";
import { EyeIcon, HeartIcon } from "@/components/icons";
import { ButtonLink } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { DISCLAIMER, SITE_EXPLAINER, SITE_NAME, SITE_TAGLINE } from "@/config/site";

export const metadata: Metadata = {
  title: "About",
  description: "What Nth Opinion is, how its AI agents and director work, and the tech behind it.",
  openGraph: { title: `About · ${SITE_NAME}`, url: "/about" },
};

/** About: what Nth Opinion is, how the agents + director work (diagram), tech stack and the disclaimer. */
export default function AboutPage() {
  return (
    <>
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 space-y-16 px-4 py-14 sm:px-6 sm:py-20">
        <section className="animate-fade-up text-center">
          <LogoMark className="mx-auto size-16" />
          <h1 className="mt-5 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            About <Wordmark />
          </h1>
          <p className="mt-2 font-display text-xl text-primary-deep italic">{SITE_TAGLINE}</p>
          <p className="mt-1 text-base text-muted">{SITE_EXPLAINER}</p>
          <div className="mx-auto mt-6 max-w-2xl space-y-4 text-left text-base leading-relaxed text-muted sm:text-lg">
            <p>
              Most AI chat is one assistant giving one careful answer. Real advice rarely works like that. You ask
              your friends, and one roasts you, one hypes you up, one points out the risk you were ignoring.
            </p>
            <p>
              Nth Opinion recreates that. Why stop at a second opinion? Every room puts several AI agents with distinct personalities around your
              problem: friends in a group chat, debaters in front of a judge, investors grilling your pitch, a panel
              roasting your resume, interviewers testing you, future versions of you, and a study group that quizzes you.
            </p>
          </div>
        </section>

        <section aria-labelledby="agents-title" className="space-y-8">
          <SectionHeading id="agents-title" eyebrow="How it works" title="Agents, plus a director">
            Each agent is an LLM persona with its own personality, speaking habits and typical stance. A separate
            director agent decides, one step at a time, who would naturally respond next. It isn&apos;t round-robin.
          </SectionHeading>
          <AgentDiagram />
          <div className="grid gap-4 sm:grid-cols-3">
            <Explainer title="Director">
              Uses structured output to choose: speak (who, replying to what), react (who, which emoji) or end.
              It picks whoever was mentioned, disagrees, or has been quiet.
            </Explainer>
            <Explainer title="Safety first">
              Every message is checked first. If someone seems to be in crisis, the jokes stop, every agent becomes
              gentle, and a helpline is shown.
            </Explainer>
            <Explainer title="Live streaming">
              Typing indicators, messages and reactions stream to your browser as they happen, so it feels like real
              people typing.
            </Explainer>
          </div>
          <div className="flex gap-3 rounded-2xl border border-accent/40 bg-lavender-soft p-5">
            <EyeIcon className="mt-0.5 size-5 shrink-0 text-accent-deep" />
            <div>
              <h3 className="font-display text-lg font-semibold">Watch it happen: Behind the scenes</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink/85">
                Turn on &ldquo;Behind the scenes&rdquo; (the eye button in any room) to watch the agents work live. A
                diagram of the room lights up as the safety check, the director and each persona run, a timeline lists
                every decision the director makes and why, and counters show the turn&apos;s messages, reactions, steps
                and time. It shows decisions and timings only, never the prompts behind them.
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Explainer title="Build your own friend">
              On the My Friends page, describe a type of person (a strict but caring dad, a calm mentor) and get an AI
              friend with their own personality and avatar, saved in your browser. Real people can&apos;t be built,
              and whatever you write only describes a character: it can never change the room&apos;s rules or safety.
            </Explainer>
            <Explainer title="Cross-room guests">
              Invite a persona from another room, or one of your own friends, as a guest: a friend in the audience at
              your pitch, a coach in your corner at an interview. Guests speak less, and never take over the room&apos;s
              main job: investors still decide and interviewers still score.
            </Explainer>
            <Explainer title="Your documents">
              Upload a resume, a job description, a pitch deck or notes in the rooms that use them. The file is read in
              memory and never stored, only a short summary is shared with the room, and it isn&apos;t saved in your
              browser either. Its text is sent to Google Gemini, which writes the replies. Instructions hidden in a
              document are never followed; the room points them out as a red flag.
            </Explainer>
            <Explainer title="PDF reports">
              At the end of every room, download a PDF report made in your browser: scores, feedback, checklists and
              quizzes. Reports contain the room&apos;s results only, never your uploaded documents.
            </Explainer>
          </div>
        </section>

        <section aria-labelledby="stack-title" className="space-y-8">
          <SectionHeading id="stack-title" eyebrow="Tech stack" title="What it's built with" />
          <ul className="grid gap-3 sm:grid-cols-2">
            {[...TECH_STACK, { name: "Google Gemini", role: "The language models behind every agent and director" }].map((t) => (
              <li key={t.name} className="rounded-2xl border border-line bg-surface p-4 shadow-soft">
                <p className="font-display text-lg font-semibold">{t.name}</p>
                <p className="mt-1 text-sm text-muted">{t.role}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="disclaimer-title" className="rounded-3xl border border-support/30 bg-support-soft p-6 sm:p-8">
          <h2 id="disclaimer-title" className="flex items-center gap-2 font-display text-xl font-semibold text-support">
            <HeartIcon className="size-5" /> Please read
          </h2>
          <p className="mt-3 text-base leading-relaxed text-ink">{DISCLAIMER}</p>
        </section>

        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <ButtonLink href="/rooms/group-chat" size="lg">
            Start a Group Chat
          </ButtonLink>
          <ButtonLink href="/debate" variant="secondary" size="lg">
            Try the Debate Arena
          </ButtonLink>
        </div>
      </main>
      <Footer />
    </>
  );
}

function Explainer({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-soft">
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{children}</p>
    </div>
  );
}
