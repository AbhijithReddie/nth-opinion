import type { SummaryItem } from "@/lib/chatTypes";
import { OffersCard } from "./OffersCard";
import { PollCard } from "./PollCard";

/** A room's final output in the chat: picks the card for the summary type. */
export function SummaryCard({ item }: { item: SummaryItem }) {
  return (
    <li className="animate-message-in mx-auto mt-5 w-full max-w-md">
      {item.type === "poll" ? <PollCard poll={item.data} ts={item.ts} /> : <OffersCard offers={item.data} ts={item.ts} />}
    </li>
  );
}
