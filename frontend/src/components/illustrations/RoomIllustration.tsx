import { Art, Blob, Bot, Bubble, Dots, Figure, Heart, Lines, Person, Sparkle } from "./parts";

/** One original illustration per room, keyed by the room id in config/rooms.ts. */
export function RoomIllustration({ roomId, className = "" }: { roomId: string; className?: string }) {
  const Scene = SCENES[roomId];
  return Scene ? <Scene className={className} /> : null;
}

type SceneProps = { className?: string };

const BLOB = "M58 44C104 4 226 8 272 48c42 36 36 120-10 150-52 34-158 30-206-4C10 162 14 82 58 44Z";

/** Debate Arena: two podiums facing each other, with a judge's gavel between them. */
function DebateScene({ className }: SceneProps) {
  return (
    <Art label="Two robot debaters at podiums facing each other, with a judge's gavel between them" className={className}>
      <Blob d={BLOB} className="fill-butter-soft" />
      <path d="M22 198h276" />
      <Bubble x={22} y={14} w={74} h={30} tail="right" float={0}>
        <path d="M40 29h12M46 23v12" className="stroke-sage-deep" strokeWidth={3} />
        <Lines x={60} y={25} widths={[24, 16]} />
      </Bubble>
      <Bubble x={224} y={14} w={74} h={30} tail="left" float={1.2}>
        <path d="M242 29h12" className="stroke-terracotta-deep" strokeWidth={3} />
        <Lines x={262} y={25} widths={[24, 16]} />
      </Bubble>
      <Sparkle x={160} y={36} r={9} />
      <circle cx="140" cy="56" r="3" className="fill-lavender" stroke="none" />
      <circle cx="182" cy="62" r="2.5" className="fill-sage" stroke="none" />

      {/* Pro, on the left */}
      <Bot x={80} y={64} s={0.95} body="fill-sage" screen="fill-sage-soft" mood="grin" />
      <rect x="36" y="114" width="88" height="14" rx="5" className="fill-sage" />
      <path d="M46 128h68l-8 70H54Z" className="fill-sage" />
      <circle cx="80" cy="160" r="12" className="fill-surface" />
      <path d="M80 154v12M74 160h12" className="stroke-sage-deep" strokeWidth={3} />

      {/* Con, on the right */}
      <Bot x={240} y={64} s={0.95} body="fill-terracotta" screen="fill-terracotta-soft" mood="frown" />
      <rect x="196" y="114" width="88" height="14" rx="5" className="fill-terracotta" />
      <path d="M206 128h68l-8 70h-52Z" className="fill-terracotta" />
      <circle cx="240" cy="160" r="12" className="fill-surface" />
      <path d="M234 160h12" className="stroke-terracotta-deep" strokeWidth={3} />

      {/* The judge's gavel and sound block */}
      <rect x="136" y="182" width="48" height="14" rx="4" className="fill-butter" />
      <g transform="rotate(-30 160 160)">
        <rect x="156" y="138" width="8" height="40" rx="4" className="fill-butter-deep" />
        <rect x="138" y="118" width="44" height="22" rx="6" className="fill-butter" />
        <path d="M150 118v22M170 118v22" strokeWidth={2} />
      </g>
      <path d="M128 166l-8-4M192 166l8-4M126 178h-9M194 178h9" strokeWidth={2} />
    </Art>
  );
}

/** The Group Chat: a phone full of colourful chat bubbles. */
function GroupChatScene({ className }: SceneProps) {
  return (
    <Art label="A phone screen full of colourful chat bubbles from a group of friends" className={className}>
      <Blob d={BLOB} className="fill-lavender-soft" />
      <Bubble x={18} y={112} w={74} h={30} tail="right" fill="fill-sage-soft" float={0.6}>
        <Dots x={55} y={127} className="fill-sage-deep" />
      </Bubble>
      <Bubble x={232} y={138} w={72} h={30} tail="left" fill="fill-butter-soft" float={1.6}>
        <Lines x={246} y={150} widths={[40, 26]} />
      </Bubble>
      <Heart x={58} y={62} s={1.3} />
      <Heart x={270} y={92} s={0.9} className="fill-lavender" />
      <g transform="translate(262 46)">
        <circle r="14" className="fill-butter" />
        <path d="M-6-3q2-3 4 0M2-3q2-3 4 0" strokeWidth={2} />
        <path d="M-7 3q7 9 14 0Z" className="fill-ink" strokeWidth={1.6} />
      </g>
      <Sparkle x={36} y={176} r={7} className="fill-lavender" />
      <Sparkle x={292} y={192} r={6} />

      <rect x="104" y="8" width="112" height="204" rx="22" className="fill-ink" />
      <rect x="112" y="20" width="96" height="180" rx="14" className="fill-surface" stroke="none" />
      <rect x="146" y="12.5" width="28" height="4" rx="2" className="fill-line-strong" stroke="none" />
      <g stroke="none">
        <circle cx="122" cy="48" r="5" className="fill-lavender-deep" />
        <rect x="131" y="40" width="58" height="16" rx="8" className="fill-lavender" />
        <circle cx="122" cy="72" r="5" className="fill-butter-deep" />
        <rect x="131" y="64" width="66" height="16" rx="8" className="fill-butter" />
        <rect x="146" y="90" width="54" height="16" rx="8" className="fill-terracotta" />
        <circle cx="122" cy="122" r="5" className="fill-sage-deep" />
        <rect x="131" y="114" width="62" height="16" rx="8" className="fill-sage" />
        <rect x="131" y="134" width="40" height="16" rx="8" className="fill-lavender-soft" />
        <rect x="140" y="156" width="60" height="16" rx="8" className="fill-terracotta" />
        <rect x="131" y="178" width="32" height="14" rx="7" className="fill-sand" />
      </g>
      <Dots x={147} y={185} className="fill-faint" />
      <path d="M152 98h32M156 164h34" className="stroke-surface" strokeWidth={2} opacity={0.8} />
    </Art>
  );
}

/** Pitch Tank: a pitch stage under a spotlight, facing three investor chairs. */
function PitchScene({ className }: SceneProps) {
  const chairs = [
    { x: 206, y: 150, fill: "fill-lavender" },
    { x: 248, y: 138, fill: "fill-butter" },
    { x: 290, y: 150, fill: "fill-terracotta" },
  ];
  return (
    <Art label="A pitch stage with a rising chart under a spotlight, facing three empty investor chairs" className={className}>
      <Blob d={BLOB} className="fill-sage-soft" />
      <path d="M86 0h30l58 178H30Z" className="fill-butter/35" stroke="none" />
      <ellipse cx="102" cy="188" rx="80" ry="15" className="fill-sand-deep" />
      <ellipse cx="102" cy="182" rx="80" ry="15" className="fill-sand" />

      {/* Easel and pitch board with a rising chart */}
      <path d="M80 182 94 112M124 182 110 112M102 112v62" strokeWidth={3} />
      <rect x="62" y="60" width="80" height="56" rx="6" className="fill-surface" />
      <rect x="74" y="94" width="10" height="14" rx="2" className="fill-sage" />
      <rect x="90" y="86" width="10" height="22" rx="2" className="fill-butter" />
      <rect x="106" y="76" width="10" height="32" rx="2" className="fill-terracotta" />
      <path d="M72 84 92 74l14 4 24-14" className="stroke-sage-deep" strokeWidth={2.6} />
      <path d="m122 63 8 1-2 8" className="stroke-sage-deep" strokeWidth={2.6} />

      {/* Three investor chairs */}
      {chairs.map((c) => (
        <g key={c.x} transform={`translate(${c.x} ${c.y}) scale(0.78)`}>
          <path d="M-18 24 -22 44M18 24l4 20" strokeWidth={3} />
          <rect x="-18" y="-50" width="36" height="40" rx="12" className={c.fill} />
          <rect x="-26" y="-26" width="9" height="26" rx="4" className={c.fill} />
          <rect x="17" y="-26" width="9" height="26" rx="4" className={c.fill} />
          <rect x="-22" y="-12" width="44" height="14" rx="5" className={c.fill} />
          <rect x="-22" y="-12" width="44" height="14" rx="5" className="fill-surface/25" stroke="none" />
        </g>
      ))}
      <path d="M180 170h128" strokeWidth={2} opacity={0.4} />

      <g transform="translate(206 44)">
        <circle r="13" className="fill-butter" />
        <path d="M-4-5h7a3 3 0 0 1 0 6h-7M-4-1h8M-1 1l6 6" strokeWidth={2} />
      </g>
      <circle cx="232" cy="66" r="8" className="fill-butter" />
      <Sparkle x={278} y={36} r={8} className="fill-sage" />
      <Sparkle x={168} y={34} r={6} />
    </Art>
  );
}

/** Interview Panel: three interviewers behind a table, and one empty candidate chair. */
function InterviewScene({ className }: SceneProps) {
  return (
    <Art label="Three interviewers seated behind a table, facing one empty candidate chair" className={className}>
      <Blob d={BLOB} className="fill-room-interview/15" />
      <Bubble x={186} y={6} w={56} h={28} tail="left" float={0.4}>
        <path d="M209 15a4.5 4.5 0 1 1 6.5 4c-1.5.8-2 1.8-2 3.4M213.5 27v.2" strokeWidth={2.4} />
      </Bubble>
      <Sparkle x={52} y={40} r={8} className="fill-lavender" />
      <Sparkle x={276} y={60} r={6} />

      <Person x={100} y={50} s={0.72} shirt="#A8407F" skin={1} long />
      <Person x={160} y={40} s={0.72} shirt="#2D6B73" skin={4} glasses />
      <Person x={220} y={50} s={0.72} shirt="#876000" skin={2} hair="grey" />

      <rect x="58" y="108" width="204" height="16" rx="6" className="fill-surface" />
      <rect x="68" y="124" width="184" height="40" rx="4" className="fill-sand-deep" />
      <path d="M84 104l22-2 2 6H86ZM142 104h24v4h-24ZM206 102l24 2-2 6h-22Z" className="fill-surface" strokeWidth={1.8} />
      <rect x="240" y="96" width="10" height="12" rx="2" className="fill-terracotta" strokeWidth={1.8} />

      {/* The candidate's chair, seen from behind */}
      <rect x="134" y="150" width="52" height="42" rx="14" className="fill-room-interview" />
      <path d="M144 160h32" className="stroke-surface" strokeWidth={2} opacity={0.6} />
      <rect x="126" y="186" width="68" height="11" rx="5" className="fill-room-interview" />
      <path d="M136 197l-4 18M184 197l4 18" strokeWidth={3} />
    </Art>
  );
}

/** Future You: three versions of a person along a winding path. */
function FutureScene({ className }: SceneProps) {
  const road = "M14 216c76-12 40-62 116-74 72-11 40-56 104-66 50-8 40-40 70-50";
  return (
    <Art label="Three versions of the same person, now, at 30 and at 50, along a winding path" className={className}>
      <Blob d={BLOB} className="fill-room-future/15" />
      <g transform="translate(58 48)">
        <circle r="18" className="fill-butter" />
        <path d="M0-26v-6M0 26v6M-26 0h-6M26 0h6M-18-18l-4-4M18-18l4-4M-18 18l-4 4M18 18l4 4" strokeWidth={2.2} />
      </g>
      <path d={road} className="stroke-line-strong" strokeWidth={28} />
      <path d={road} className="stroke-sand" strokeWidth={23} />
      <path d={road} className="stroke-surface" strokeWidth={2.2} strokeDasharray="6 9" />
      <path d="M302 30V4" strokeWidth={2.4} />
      <path d="M302 4l16 5-16 6Z" className="fill-terracotta" strokeWidth={2} />

      <Figure x={236} y={30} s={0.6} shirt="#876000" skin={2} hair="grey" glasses />
      <Figure x={148} y={74} s={0.78} shirt="#2D6B73" skin={2} />
      <Figure x={64} y={122} s={1} shirt="fill-terracotta" skin={2} />

      <Sparkle x={196} y={30} r={6} className="fill-lavender" />
      <Sparkle x={112} y={110} r={5} />
      <Sparkle x={270} y={112} r={7} className="fill-room-future" />
    </Art>
  );
}

/** Roast & Toast: a microphone with a small flame, next to a raised glass. */
function RoastScene({ className }: SceneProps) {
  return (
    <Art label="A stand-up microphone with a small flame beside it, next to a raised glass for a toast" className={className}>
      <Blob d={BLOB} className="fill-terracotta-soft" />

      {/* Microphone on a stand */}
      <ellipse cx="104" cy="202" rx="30" ry="6" className="fill-ink" />
      <path d="M104 198v-72" strokeWidth={5} />
      <path d="M96 92h16l-4 36h-8Z" className="fill-ink" />
      <rect x="82" y="30" width="44" height="58" rx="22" className="fill-surface" />
      <path d="M86 46h36M84 58h40M84 70h40M88 82h32" strokeWidth={1.6} opacity={0.5} />
      <rect x="86" y="84" width="36" height="10" rx="4" className="fill-terracotta" />

      {/* A small flame */}
      <path
        d="M162 104c18 20 24 38 12 56-6 9-18 9-24 0-10-16 0-28 6-36 0 12 6 14 8 8 2-8-4-18-2-28Z"
        className="fill-terracotta"
      />
      <path d="M162 132c8 10 8 22 2 28-5 4-10-1-9-8 1-6 5-8 7-20Z" className="fill-butter" strokeWidth={1.8} />

      {/* A raised glass */}
      <g transform="rotate(14 236 120)">
        <path d="M218 54h36c0 36-8 50-18 52-10-2-18-16-18-52Z" className="fill-surface" />
        <path d="M220.5 70h31c-1 22-7.5 31-15.5 33-8-2-14.5-11-15.5-33Z" className="fill-butter" stroke="none" />
        <g className="fill-surface" stroke="none">
          <circle cx="232" cy="84" r="2" />
          <circle cx="241" cy="78" r="1.6" />
          <circle cx="238" cy="93" r="1.8" />
        </g>
        <path d="M236 106v48" strokeWidth={3} />
        <ellipse cx="236" cy="156" rx="16" ry="4.5" className="fill-surface" />
      </g>
      <path d="M262 36l9-9M270 50l12-3M254 26l1-11" strokeWidth={2.4} />
      <Sparkle x={290} y={86} r={8} />
      <Sparkle x={198} y={30} r={6} className="fill-terracotta" />
      <path d="M40 120l6 6M46 120l-6 6M276 178l6 6M282 178l-6 6" className="stroke-terracotta" strokeWidth={2.2} />
    </Art>
  );
}

/** Study Group: a stack of books, a lightbulb and doodles. */
function StudyScene({ className }: SceneProps) {
  return (
    <Art label="A stack of books under a glowing lightbulb, surrounded by study doodles" className={className}>
      <Blob d={BLOB} className="fill-room-study/15" />

      {/* Lightbulb */}
      <path d="M156 20V8M120 32l-8-8M192 32l8-8M112 60h-11M200 60h11" className="stroke-butter-deep" strokeWidth={2.6} />
      <circle cx="156" cy="58" r="27" className="fill-butter" />
      <path d="M146 64q5-10 10 0t10 0" strokeWidth={2} />
      <path d="M150 78v8M162 78v8" strokeWidth={2} />
      <rect x="143" y="84" width="26" height="16" rx="4" className="fill-line-strong" />
      <path d="M144 91h24" strokeWidth={1.8} />

      {/* Books */}
      <g transform="rotate(2 155 134)">
        <rect x="100" y="122" width="110" height="22" rx="4" className="fill-terracotta" />
        <rect x="196" y="125" width="10" height="16" rx="1.5" className="fill-surface" strokeWidth={1.8} />
        <path d="M112 133h30" className="stroke-surface" strokeWidth={2.4} />
      </g>
      <g transform="rotate(-3 156 156)">
        <rect x="92" y="144" width="128" height="24" rx="4" className="fill-lavender" />
        <rect x="206" y="148" width="10" height="16" rx="1.5" className="fill-surface" strokeWidth={1.8} />
        <path d="M104 156h38" className="stroke-surface" strokeWidth={2.4} />
      </g>
      <rect x="80" y="168" width="150" height="26" rx="4" className="fill-sage" />
      <rect x="216" y="172" width="10" height="18" rx="1.5" className="fill-surface" strokeWidth={1.8} />
      <path d="M94 181h44" className="stroke-surface" strokeWidth={2.4} />
      <path d="M60 198h200" strokeWidth={2} opacity={0.4} />

      {/* Doodles */}
      <path d="M56 70a3 3 0 1 1 6 0 7 7 0 1 1-14 0 11 11 0 1 1 22 0" className="stroke-lavender-deep" strokeWidth={2.2} />
      <path d="M26 128q8-10 16 0t16 0 16 0" className="stroke-sage-deep" strokeWidth={2.2} />
      <text x="236" y="84" className="fill-ink font-mono" stroke="none" fontSize="20" fontWeight="600">
        x²
      </text>
      <g transform="rotate(35 268 150)">
        <rect x="262" y="112" width="12" height="52" rx="2" className="fill-butter" />
        <path d="M262 164l6 12 6-12Z" className="fill-sand" />
        <rect x="262" y="106" width="12" height="8" rx="2" className="fill-terracotta" />
      </g>
      <Sparkle x={270} y={36} r={8} className="fill-room-study" />
      <Sparkle x={44} y={182} r={6} />
    </Art>
  );
}

const SCENES: Record<string, (props: SceneProps) => React.ReactNode> = {
  debate: DebateScene,
  "group-chat": GroupChatScene,
  "shark-tank": PitchScene,
  "interview-panel": InterviewScene,
  "future-you": FutureScene,
  "roast-and-toast": RoastScene,
  "study-group": StudyScene,
};
