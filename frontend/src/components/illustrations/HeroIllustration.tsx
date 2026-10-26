import { Art, Blob, Bot, Bubble, Dots, Heart, Lines, Person, Sparkle } from "./parts";

/** Home page hero: you at a round table with friendly AI characters, speech bubbles floating above. */
export function HeroIllustration({ className = "" }: { className?: string }) {
  return (
    <Art
      label="A person sitting at a round table with four friendly AI characters, speech bubbles floating above them"
      viewBox="0 0 480 340"
      className={className}
    >
      <Blob
        d="M70 128C82 56 172 22 252 30c90 8 178 40 186 122 8 80-58 148-188 152C130 308 58 262 50 202c-4-30 16-50 20-74Z"
        className="fill-lavender-soft"
      />
      <circle cx="420" cy="64" r="30" className="fill-butter-soft" stroke="none" />
      <circle cx="58" cy="78" r="22" className="fill-sage-soft" stroke="none" />

      {/* Speech bubbles */}
      <Bubble x={44} y={94} w={82} h={30} tail="right" float={0}>
        <path d="M76 103a4.5 4.5 0 1 1 6.5 4c-1.5.8-2 1.8-2 3.4M80.5 115v.2" strokeWidth={2.4} />
        <Lines x={92} y={105} widths={[22, 14]} />
      </Bubble>
      <Bubble x={118} y={58} w={74} h={30} tail="right" fill="fill-lavender" float={0.8}>
        <Dots x={155} y={73} className="fill-ink" />
      </Bubble>
      <Bubble x={200} y={36} w={80} h={38} tail="center" fill="fill-terracotta-soft" float={1.6}>
        <Heart x={222} y={53} s={0.9} />
        <Lines x={238} y={50} widths={[28, 20]} />
      </Bubble>
      <Bubble x={290} y={58} w={74} h={30} tail="left" fill="fill-butter" float={2.4}>
        <path d="M327 66v8M327 80v.2" strokeWidth={3} />
      </Bubble>
      <Bubble x={356} y={94} w={82} h={30} tail="left" fill="fill-sage-soft" float={3.2}>
        <Lines x={372} y={105} widths={[48, 30]} />
      </Bubble>

      {/* Everyone around the table; the tabletop hides their lower halves */}
      <Bot x={100} y={160} s={0.95} body="fill-sage" screen="fill-sage-soft" mood="smile" />
      <Bot x={170} y={128} s={0.9} body="fill-lavender" screen="fill-lavender-soft" mood="grin" />
      <Bot x={310} y={128} s={0.9} body="fill-butter" screen="fill-butter-soft" mood="calm" />
      <Bot x={380} y={160} s={0.95} body="fill-room-study" screen="fill-sage-soft" mood="smile" />
      <Person x={240} y={124} s={1.15} shirt="fill-terracotta" skin={2} />

      {/* The round table */}
      <path d="M226 290l-10 34h48l-10-34Z" className="fill-sand-deep" />
      <ellipse cx="240" cy="326" rx="46" ry="7" className="fill-line-strong" />
      <ellipse cx="240" cy="270" rx="192" ry="46" className="fill-sand-deep" />
      <ellipse cx="240" cy="262" rx="192" ry="46" className="fill-sand" />
      <ellipse cx="240" cy="260" rx="168" ry="34" className="stroke-line-strong" strokeWidth={1.6} />

      {/* Chai, a notebook and a pen */}
      <path d="M160 248h22l-3 18h-16Z" className="fill-surface" />
      <path d="M182 252c6 0 6 9 0 9" strokeWidth={2} />
      <path d="M166 240c-3-5 3-7 0-12M175 240c-3-5 3-7 0-12" strokeWidth={1.8} opacity={0.6} />
      <path d="M298 250h22l-3 18h-16Z" className="fill-surface" />
      <path d="M298 254c-6 0-6 9 0 9" strokeWidth={2} />
      <path d="M306 242c-3-5 3-7 0-12" strokeWidth={1.8} opacity={0.6} />
      <path d="M214 262l50-6 4 20-50 6Z" className="fill-surface" />
      <path d="M224 266l30-4M225 272l22-3" strokeWidth={1.8} opacity={0.5} />
      <path d="M262 282l18-12" className="stroke-terracotta-deep" strokeWidth={3} />

      <Sparkle x={36} y={210} r={9} />
      <Sparkle x={452} y={206} r={7} className="fill-lavender" />
      <Sparkle x={240} y={14} r={7} className="fill-sage" />
      <circle cx="458" cy="132" r="4" className="fill-terracotta" stroke="none" />
      <circle cx="22" cy="150" r="3.5" className="fill-butter" stroke="none" />
    </Art>
  );
}
