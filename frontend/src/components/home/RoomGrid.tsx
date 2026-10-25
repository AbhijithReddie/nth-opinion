import { LIVE_ROOMS, ROOMS } from "@/config/rooms";
import { SectionHeading } from "../ui/SectionHeading";
import { RoomCard } from "./RoomCard";

/** All rooms from config/rooms.ts, live ones first. */
export function RoomGrid() {
  const rooms = [...ROOMS].sort((a, b) => Number(b.status === "live") - Number(a.status === "live"));
  return (
    <section aria-labelledby="rooms-title" className="py-16 sm:py-20">
      <SectionHeading id="rooms-title" eyebrow="The rooms" title="Pick a room, bring a problem">
        Each room is a different kind of conversation.{" "}
        {LIVE_ROOMS.length === ROOMS.length
          ? `All ${ROOMS.length} are open.`
          : `${LIVE_ROOMS.length} are open now, and ${ROOMS.length - LIVE_ROOMS.length} more are on the way.`}
      </SectionHeading>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rooms.map((room) => (
          <li key={room.id}>
            <RoomCard room={room} />
          </li>
        ))}
      </ul>
    </section>
  );
}
