import type { Metadata } from "next";
import { AgentDiagram } from "@/components/about/AgentDiagram";
import { HuddleMark } from "@/components/brand/HuddleMark";
import { Footer } from "@/components/Footer";
import { TECH_STACK } from "@/components/home/BuiltWith";
import { HeartIcon } from "@/components/icons";
import { ButtonLink } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { DISCLAIMER, SITE_TAGLINE } from "@/config/site";

export const metadata: Metadata = {
  title: "About",
  description: "What Huddle is, how its AI agents and director work, and the tech behind it.",
  openGraph: { title: "About · Huddle", url: "/about" },
};

/** About: what Huddle is, how the agents + director work (diagram), tech stack and the disclaimer. */
export default function AboutPage() {
  return (
    <>
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 space-y-16 px-4 py-14 sm:px-6 sm:py-20">
        <section className="animate-fade-up text-center">
          <HuddleMark className="mx-auto size-16" />
          <h1 className="mt-5 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">About Huddle</h1>
          <p className="mt-2 font-display text-xl text-brand">{SITE_TAGLINE}</p>
          <div className="mx-auto mt-6 max-w-2xl space-y-4 text-left text-base leading-relaxed text-muted sm:text-lg">
            <p>
              Most AI chat is one assistant giving one careful answer. Real advice rarely works like that. You ask
              your friends, and one roasts you, one hypes you up, one points out the risk you were ignoring.
            </p>
            <p>
              Huddle recreates that. Every room puts several AI agents with distinct personalities around your
              problem: friends in a group chat, debaters in front of a judge, investors grilling your pitch, a panel
              roasting your resume, interviewers testing you, and even future versions of you.
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
        </section>

        <section aria-labelledby="stack-title" className="space-y-8">
          <SectionHeading id="stack-title" eyebrow="Tech stack" title="What it's built with" />
          <ul className="grid gap-3 sm:grid-cols-2">
            {[...TECH_STACK, { name: "Google Gemini", role: "The language models behind every agent and director" }].map((t) => (
              <li key={t.name} className="rounded-2xl border border-white/[0.07] bg-arena-900/70 p-4">
                <p className="font-display font-bold">{t.name}</p>
                <p className="mt-1 text-sm text-muted">{t.role}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="disclaimer-title" className="rounded-3xl border border-support/25 bg-support/[0.06] p-6 sm:p-8">
          <h2 id="disclaimer-title" className="flex items-center gap-2 font-display text-xl font-bold text-support">
            <HeartIcon className="size-5" /> Please read
          </h2>
          <p className="mt-3 text-base leading-relaxed text-ink/90">{DISCLAIMER}</p>
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
    <div className="rounded-2xl border border-white/[0.07] bg-arena-900/70 p-5">
      <h3 className="font-display text-lg font-bold">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{children}</p>
    </div>
  );
}
