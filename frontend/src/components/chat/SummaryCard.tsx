import type { SummaryItem } from "@/lib/chatTypes";
import { InterviewCard } from "./InterviewCard";
import { LettersCard } from "./LettersCard";
import { OffersCard } from "./OffersCard";
import { PollCard } from "./PollCard";
import { ScorecardCard } from "./ScorecardCard";

/** A room's final output in the chat: picks the card for the summary type. */
export function SummaryCard({ item }: { item: SummaryItem }) {
  return (
    <li className="animate-message-in mx-auto mt-5 w-full max-w-md">
      {item.type === "poll" && <PollCard poll={item.data} ts={item.ts} />}
      {item.type === "offers" && <OffersCard offers={item.data} ts={item.ts} />}
      {item.type === "scorecard" && <ScorecardCard card={item.data} ts={item.ts} />}
      {item.type === "interview" && <InterviewCard result={item.data} ts={item.ts} />}
      {item.type === "letters" && <LettersCard result={item.data} ts={item.ts} />}
    </li>
  );
}
