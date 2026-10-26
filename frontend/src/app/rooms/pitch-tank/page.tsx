import type { Metadata } from "next";
import { RoomChatLoader } from "@/components/chat/RoomChatLoader";
import { getRoom } from "@/config/rooms";
import { SITE_NAME } from "@/config/site";

// The backend room id is still "shark-tank".
const room = getRoom("shark-tank");

export const metadata: Metadata = {
  title: room.title,
  description: `${room.description} Practise your pitch, answer tough questions, and see who makes you an offer.`,
  openGraph: { title: `${room.title} · ${SITE_NAME}`, description: room.description, url: room.href },
};

/** /rooms/pitch-tank (the old /rooms/shark-tank redirects here). No footer: the pitch room fills the screen like a messaging app. */
export default function PitchTankPage() {
  return <RoomChatLoader roomId="shark-tank" />;
}
