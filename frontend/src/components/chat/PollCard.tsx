import type { Poll } from "@/lib/chatTypes";
import { PollIcon } from "../icons";
import { Avatar } from "./Avatar";
import { formatTime } from "./chatNames";
import { useRoom } from "./RoomContext";

/** Group Chat summary: the question, a bar per option, and each friend's one-line reason. */
export function PollCard({ poll, ts }: { poll: Poll; ts: number }) {
  const { persona, nameOf } = useRoom();
  const total = poll.votes.length || 1;
  const counts = poll.options.map((option) => poll.votes.filter((v) => v.option === option).length);
  const top = Math.max(...counts);

  return (
    <section aria-label="Group poll" className="rounded-2xl border border-accent/50 bg-surface p-4 text-left shadow-lift">
      <p className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.18em] text-accent-deep uppercase">
        <PollIcon className="size-3.5" /> Group vote · {formatTime(ts)}
      </p>
      <h3 className="mt-1.5 font-display text-lg leading-snug font-semibold">{poll.question}</h3>

      <ul className="mt-3 space-y-2">
        {poll.options.map((option, i) => {
          const pct = Math.round((counts[i] / total) * 100);
          const winning = counts[i] === top && top > 0;
          return (
            <li key={option}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span className={winning ? "font-semibold text-ink" : "text-ink"}>{option}</span>
                <span className="font-mono text-xs text-muted">
                  {counts[i]} {counts[i] === 1 ? "vote" : "votes"}
                </span>
              </div>
              <div
                role="meter"
                aria-label={option}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
                className="h-2 overflow-hidden rounded-full bg-sand"
              >
                <div
                  className={`animate-bar-grow h-full origin-left rounded-full ${winning ? "bg-linear-to-r from-accent to-accent-deep" : "bg-line-strong"}`}
                  style={{ width: `${pct}%`, animationDelay: `${150 + i * 100}ms` }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <ul className="mt-4 space-y-2 border-t border-line pt-3">
        {poll.votes.map((vote) => {
          const meta = persona(vote.friend_id);
          return meta ? (
            <li key={vote.friend_id} className="flex items-start gap-2 text-sm">
              <Avatar persona={meta} size="xs" className="mt-0.5" />
              <p className="min-w-0">
                <span className="font-semibold">{nameOf(vote.friend_id)}</span>
                <span className="text-muted"> voted </span>
                <span className="font-semibold text-accent-deep">{vote.option}</span>
                <span className="block text-muted">&ldquo;{vote.reason}&rdquo;</span>
              </p>
            </li>
          ) : null;
        })}
      </ul>
    </section>
  );
}
