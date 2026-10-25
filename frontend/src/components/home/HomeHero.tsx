import { SITE_NAME, SITE_TAGLINE } from "@/config/site";
import { HuddleMark } from "../brand/HuddleMark";
import { ArrowRightIcon } from "../icons";
import { ButtonLink } from "../ui/Button";

/** Top of the home page: logo, name, tagline, a short pitch and the two main calls to action. */
export function HomeHero() {
  return (
    <section aria-labelledby="hero-title" className="animate-fade-up relative pt-14 pb-16 text-center sm:pt-20 sm:pb-24">
      <div aria-hidden className="arena-grid pointer-events-none absolute inset-x-0 top-0 -z-10 h-[30rem]" />
      <HuddleMark className="mx-auto size-24 drop-shadow-[0_20px_40px_rgba(117,99,240,0.45)] sm:size-28" />
      <h1 id="hero-title" className="mt-6 font-display text-5xl font-extrabold tracking-tight sm:text-7xl">
        {SITE_NAME}
      </h1>
      <p className="mt-3 bg-linear-to-r from-cyan via-brand to-coral bg-clip-text font-display text-2xl font-bold text-balance text-transparent sm:text-4xl">
        {SITE_TAGLINE}
      </p>
      <p className="mx-auto mt-5 max-w-xl text-base text-pretty text-muted sm:text-lg">
        Bring a problem, a decision or a hot take. A room of AI personas with very different personalities talks it
        through with you, and a director agent decides who speaks next.
      </p>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <ButtonLink href="/rooms/group-chat" size="lg" className="w-full sm:w-auto">
          Start a Group Chat <ArrowRightIcon className="size-4" />
        </ButtonLink>
        <ButtonLink href="/debate" variant="secondary" size="lg" className="w-full sm:w-auto">
          Try the Debate Arena
        </ButtonLink>
      </div>
    </section>
  );
}
