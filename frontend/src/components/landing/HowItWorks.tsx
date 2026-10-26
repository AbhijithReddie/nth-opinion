import { GavelIcon, ThumbDownIcon, ThumbUpIcon } from "../icons";

const STEPS = [
  { title: "Pro argues", body: "Opens each round making the case for.", Icon: ThumbUpIcon, color: "text-pro-deep", ring: "bg-pro-soft" },
  { title: "Con rebuts", body: "Hits back and argues against.", Icon: ThumbDownIcon, color: "text-con-deep", ring: "bg-con-soft" },
  { title: "Judge decides", body: "Scores both sides and names a winner.", Icon: GavelIcon, color: "text-judge-deep", ring: "bg-judge-soft" },
];

/** The "How it works" strip: three steps joined by a line on wider screens. */
export function HowItWorks() {
  return (
    <ol aria-label="How it works" className="mx-auto mt-10 grid max-w-3xl gap-3 text-left sm:grid-cols-3 sm:gap-4">
      {STEPS.map(({ title, body, Icon, color, ring }, i) => (
        <li
          key={title}
          className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 shadow-soft"
        >
          <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${ring} ${color}`}>
            <Icon className="size-5" />
          </span>
          <span>
            <span className="flex items-baseline gap-2">
              <span className="font-mono text-[11px] text-muted">0{i + 1}</span>
              <span className={`font-display text-lg font-semibold ${color}`}>{title}</span>
            </span>
            <span className="mt-0.5 block text-sm text-muted">{body}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
