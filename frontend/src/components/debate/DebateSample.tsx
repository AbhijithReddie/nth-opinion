import type { RoomMeta } from "@/config/rooms";
import type { Speaker } from "@/lib/types";
import { SampleSection } from "../rooms/SampleSection";
import { Scorecard } from "./Scorecard";
import { TurnCard } from "./TurnCard";

/**
 * The Debate Arena's "See it in action": the hand-written example debate, drawn with the
 * real turn cards and scorecard. Shown only before a debate starts, so its ids never clash with a live verdict.
 */
export function DebateSample({ room, onTry }: { room: RoomMeta; onTry: () => void }) {
  const { conversation, result } = room.example;
  // Pro opens each round and Con answers it, so turns pair up into rounds.
  const turns = conversation.flatMap((line, i) => ("sender" in line ? [{ speaker: line.sender as Speaker, round: Math.floor(i / 2) + 1, text: line.text }] : []));

  return (
    <SampleSection room={room} onTry={onTry}>
      <div className="space-y-3 pt-4">
        {turns.map((t) => (
          <TurnCard key={`${t.speaker}-${t.round}`} speaker={t.speaker} round={t.round} text={t.text} streaming={false} />
        ))}
      </div>
      {result.type === "verdict" && (
        <div className="mt-5 space-y-3">
          <Scorecard verdict={result.data} />
          <p className="rounded-2xl border border-judge bg-judge-soft px-4 py-3 text-sm leading-relaxed text-ink">
            <span className="font-semibold text-judge-deep">From the judge&apos;s memo: </span>
            {result.data.memo.split(/\n\s*\n/)[0]}
          </p>
        </div>
      )}
    </SampleSection>
  );
}
