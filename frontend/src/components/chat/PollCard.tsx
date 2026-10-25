import { isFriendId } from "@/config/friends";
import type { GroupSetup, PollItem } from "@/lib/chatTypes";
import { PollIcon } from "../icons";
import { Avatar } from "./Avatar";
import { formatTime, senderName } from "./chatNames";

/** The group's vote: the question, a bar per option, and each friend's one-line reason. */
export function PollCard({ poll, setup }: { poll: PollItem; setup: GroupSetup }) {
  const total = poll.votes.length || 1;
  const counts = poll.options.map((option) => poll.votes.filter((v) => v.option === option).length);
  const top = Math.max(...counts);

  return (
    <li className="animate-message-in mx-auto mt-5 w-full max-w-md">
      <section aria-label="Group poll" className="rounded-2xl border border-brand/30 bg-arena-900 p-4 shadow-[0_10px_40px_-20px_var(--color-brand)]">
        <p className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.18em] text-brand uppercase">
          <PollIcon className="size-3.5" /> Group vote · {formatTime(poll.ts)}
        </p>
        <h3 className="mt-1.5 font-display text-lg leading-snug font-bold">{poll.question}</h3>

        <ul className="mt-3 space-y-2">
          {poll.options.map((option, i) => {
            const pct = Math.round((counts[i] / total) * 100);
            const winning = counts[i] === top && top > 0;
            return (
              <li key={option}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                  <span className={winning ? "font-semibold text-ink" : "text-ink/80"}>{option}</span>
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
                  className="h-2 overflow-hidden rounded-full bg-white/[0.06]"
                >
                  <div
                    className={`animate-bar-grow h-full origin-left rounded-full ${winning ? "bg-linear-to-r from-brand to-cyan" : "bg-white/25"}`}
                    style={{ width: `${pct}%`, animationDelay: `${150 + i * 100}ms` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>

        <ul className="mt-4 space-y-2 border-t border-white/[0.06] pt-3">
          {poll.votes.map((vote) =>
            isFriendId(vote.friend_id) ? (
              <li key={vote.friend_id} className="flex items-start gap-2 text-sm">
                <Avatar id={vote.friend_id} size="xs" className="mt-0.5" />
                <p className="min-w-0">
                  <span className="font-semibold">{senderName(setup, vote.friend_id)}</span>
                  <span className="text-muted"> voted </span>
                  <span className="font-semibold text-brand">{vote.option}</span>
                  <span className="block text-ink/75">&ldquo;{vote.reason}&rdquo;</span>
                </p>
              </li>
            ) : null,
          )}
        </ul>
      </section>
    </li>
  );
}
