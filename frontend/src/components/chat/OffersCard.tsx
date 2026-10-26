import type { InvestorDecision, Offers } from "@/lib/chatTypes";
import { Avatar } from "./Avatar";
import { formatLakh, formatTime } from "./chatNames";
import { useRoom } from "./RoomContext";

/** Pitch Tank summary: each investor's offer (or "out"), the founder's ask, strengths and concerns. */
export function OffersCard({ offers, ts }: { offers: Offers; ts: number }) {
  const { setup } = useRoom();
  const offerCount = offers.decisions.filter((d) => d.decision === "offer").length;

  return (
    <section aria-label="Investor offers" className="rounded-2xl border border-butter bg-surface p-4 text-left shadow-lift">
      <p className="font-mono text-[10px] tracking-[0.18em] text-butter-deep uppercase">
        💰 The decision · {formatTime(ts)}
      </p>
      <h3 className="mt-1.5 font-display text-lg leading-snug font-semibold">
        {offerCount === 0 ? "No deal this time" : `${offerCount} ${offerCount === 1 ? "offer" : "offers"} on the table`}
      </h3>
      <p className="mt-1 text-sm text-muted">{offers.summary}</p>
      {setup.context.ask && (
        <p className="mt-2 inline-block rounded-lg bg-sand px-2.5 py-1 text-xs text-ink">
          Your ask: <span className="font-semibold">{setup.context.ask}</span>
        </p>
      )}

      <ul className="mt-4 space-y-2.5">
        {offers.decisions.map((d) => (
          <DecisionRow key={d.friend_id} decision={d} />
        ))}
      </ul>

      {(offers.strengths.length > 0 || offers.concerns.length > 0) && (
        <div className="mt-4 grid gap-3 border-t border-line pt-3 text-sm sm:grid-cols-2">
          <FeedbackList title="What worked" items={offers.strengths} className="text-pro-deep" marker="+" />
          <FeedbackList title="What worried them" items={offers.concerns} className="text-con-deep" marker="−" />
        </div>
      )}
    </section>
  );
}

/** One investor: "₹50 L for 10%" with the implied valuation, or "Out", plus their reason. */
function DecisionRow({ decision: d }: { decision: InvestorDecision }) {
  const { persona, nameOf } = useRoom();
  const meta = persona(d.friend_id);
  if (!meta) return null;
  const offer = d.decision === "offer" && d.amount_lakh != null && d.equity_percent != null;
  const valuation = offer ? (d.amount_lakh! / d.equity_percent!) * 100 : null;

  return (
    <li
      className={`rounded-xl border p-3 ${offer ? "bg-butter-soft" : "border-line bg-sand/60"}`}
      style={offer ? { borderColor: `${meta.color}55` } : undefined}
    >
      <div className="flex items-center gap-2.5">
        <Avatar persona={meta} size="sm" />
        <span className="font-semibold" style={{ color: meta.color }}>
          {nameOf(d.friend_id)}
        </span>
        <span
          className={`ml-auto rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider uppercase ${
            offer ? "bg-butter text-ink" : "bg-sand-deep text-muted"
          }`}
        >
          {offer ? "Offer" : "Out"}
        </span>
      </div>
      {offer && (
        <p className="mt-2 text-base">
          <span className="font-mono font-semibold">{formatLakh(d.amount_lakh!)}</span>
          <span className="text-muted"> for </span>
          <span className="font-mono font-semibold">{d.equity_percent}%</span>
          <span className="block text-xs text-muted">
            Values the company at {formatLakh(valuation!)}
            {d.conditions && <> · {d.conditions}</>}
          </span>
        </p>
      )}
      <p className="mt-1.5 text-sm text-muted">&ldquo;{d.reason}&rdquo;</p>
    </li>
  );
}

function FeedbackList({ title, items, className, marker }: { title: string; items: string[]; className: string; marker: string }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className={`font-mono text-[10px] tracking-[0.18em] uppercase ${className}`}>{title}</p>
      <ul className="mt-1.5 space-y-1 text-ink">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden className={className}>
              {marker}
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
