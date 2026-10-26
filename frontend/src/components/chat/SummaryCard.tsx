import { getRoom } from "@/config/rooms";
import type { SummaryItem } from "@/lib/chatTypes";
import { roomReportInput } from "@/lib/report";
import { DownloadReportButton } from "../share/DownloadReportButton";
import { ShareButton } from "../share/ShareDialog";
import { InterviewCard } from "./InterviewCard";
import { LettersCard } from "./LettersCard";
import { NotesCard } from "./NotesCard";
import { OffersCard } from "./OffersCard";
import { PollCard } from "./PollCard";
import { useRoom } from "./RoomContext";
import { ScorecardCard } from "./ScorecardCard";

/** A room's final output in the chat: picks the card for the summary type. `shareable` adds a Share button (not on samples). */
export function SummaryCard({ item, shareable = false }: { item: SummaryItem; shareable?: boolean }) {
  const { config, setup, demo, userTexts, items, nameOf } = useRoom();
  const room = getRoom(config.roomId);
  return (
    <li className="animate-message-in mx-auto mt-5 w-full max-w-md">
      {item.type === "poll" && <PollCard poll={item.data} ts={item.ts} />}
      {item.type === "offers" && <OffersCard offers={item.data} ts={item.ts} />}
      {item.type === "scorecard" && <ScorecardCard card={item.data} ts={item.ts} />}
      {item.type === "interview" && <InterviewCard result={item.data} ts={item.ts} />}
      {item.type === "letters" && <LettersCard result={item.data} ts={item.ts} />}
      {item.type === "notes" && <NotesCard notes={item.data} ts={item.ts} />}
      {shareable && (
        <div className="mt-2 flex flex-wrap items-start justify-center gap-2">
          <ShareButton result={{ kind: "room", roomId: config.roomId, summary: item, setup, userTexts }} room={room} demo={demo} />
          <DownloadReportButton input={() => roomReportInput(room.title, setup, items, item, nameOf, demo)} />
        </div>
      )}
    </li>
  );
}
