import { HowItWorks } from "./HowItWorks";

/** Headline, one-line pitch and the three-step explainer at the top of the page. */
export function Hero() {
  return (
    <header className="animate-fade-up text-center">
      <p className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[11px] tracking-[0.2em] text-muted uppercase">
        <span className="size-1.5 animate-pulse rounded-full bg-con" />
        Nth Opinion room · Debate Arena
      </p>
      <h1 className="font-display text-[2.6rem] leading-[0.95] font-extrabold tracking-tight text-balance sm:text-6xl md:text-7xl">
        Two AIs enter.
        <br />
        <span className="bg-linear-to-r from-pro via-ink to-con bg-clip-text text-transparent">One argument wins.</span>
      </h1>
      <p className="mx-auto mt-5 max-w-xl text-base text-pretty text-muted sm:text-lg">
        Give the arena any topic and watch two AI debaters fight it out in real time, then hear an AI judge score
        the clash.
      </p>
      <HowItWorks />
    </header>
  );
}
