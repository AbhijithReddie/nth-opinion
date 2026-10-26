import { SITE_EXPLAINER, SITE_TAGLINE } from "@/config/site";
import { Wordmark } from "../brand/Wordmark";
import { ArrowRightIcon } from "../icons";
import { Doodles } from "../illustrations/Decor";
import { HeroIllustration } from "../illustrations/HeroIllustration";
import { ButtonLink } from "../ui/Button";

/** Top of the home page: name, tagline, explainer, a short pitch, the two main calls to action, and the round-table illustration. */
export function HomeHero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="animate-fade-up relative grid items-center gap-10 pt-12 pb-14 text-center sm:pt-16 lg:grid-cols-[1.05fr_1fr] lg:pb-20 lg:text-left"
    >
      <div aria-hidden className="doodle-dots pointer-events-none absolute inset-x-0 top-0 -z-10 h-[30rem]" />
      <Doodles className="opacity-80" />
      <div>
        <h1 id="hero-title" className="text-5xl sm:text-7xl">
          <Wordmark />
        </h1>
        <p className="mt-3 bg-linear-to-r from-primary-deep to-accent-deep bg-clip-text font-display text-2xl font-semibold text-balance text-transparent italic sm:text-4xl">
          {SITE_TAGLINE}
        </p>
        <p className="mt-4 font-display text-lg font-medium text-balance text-ink sm:text-xl">{SITE_EXPLAINER}</p>
        <p className="mx-auto mt-3 max-w-xl text-base text-pretty text-muted sm:text-lg lg:mx-0">
          Bring a problem, a decision or a hot take. A room of AI personas with very different personalities talks it
          through with you, and a director agent decides who speaks next.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
          <ButtonLink href="/rooms/group-chat" size="lg" className="w-full sm:w-auto">
            Start a Group Chat <ArrowRightIcon className="size-4" />
          </ButtonLink>
          <ButtonLink href="/debate" variant="secondary" size="lg" className="w-full sm:w-auto">
            Try the Debate Arena
          </ButtonLink>
        </div>
      </div>
      <HeroIllustration className="mx-auto max-w-md sm:max-w-lg lg:max-w-none" />
    </section>
  );
}
