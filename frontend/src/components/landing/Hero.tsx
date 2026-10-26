import { RoomIllustration } from "../illustrations/RoomIllustration";
import { HowItWorks } from "./HowItWorks";

/** Headline, one-line pitch, the podium illustration and the three-step explainer at the top of the page. */
export function Hero() {
  return (
    <header className="animate-fade-up text-center">
      <RoomIllustration roomId="debate" className="mx-auto mb-4 max-w-[17rem] sm:max-w-xs" />
      <p className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface px-3 py-1 font-mono text-[11px] tracking-[0.2em] text-muted uppercase shadow-soft">
        <span className="size-1.5 animate-pulse rounded-full bg-con" />
        Nth Opinion room · Debate Arena
      </p>
      <h1 className="font-display text-[2.6rem] leading-[0.95] font-semibold tracking-tight text-balance sm:text-6xl md:text-7xl">
        Two AIs enter.
        <br />
        <span className="bg-linear-to-r from-pro-deep via-ink to-con-deep bg-clip-text text-transparent italic">One argument wins.</span>
      </h1>
      <p className="mx-auto mt-5 max-w-xl text-base text-pretty text-muted sm:text-lg">
        Give the arena any topic and watch two AI debaters fight it out in real time, then hear an AI judge score
        the clash.
      </p>
      <HowItWorks />
    </header>
  );
}
