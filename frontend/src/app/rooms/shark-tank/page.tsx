import type { Metadata } from "next";
import { RoomChatLoader } from "@/components/chat/RoomChatLoader";
import { getRoom } from "@/config/rooms";
import { SITE_NAME } from "@/config/site";

const room = getRoom("shark-tank");

export const metadata: Metadata = {
  title: room.title,
  description: `${room.description} Practise your pitch, answer tough questions, and see who makes you an offer.`,
  openGraph: { title: `${room.title} · ${SITE_NAME}`, description: room.description, url: room.href },
};

/** /rooms/shark-tank. No footer: the pitch room fills the screen like a messaging app. */
export default function SharkTankPage() {
  return <RoomChatLoader roomId="shark-tank" />;
}
