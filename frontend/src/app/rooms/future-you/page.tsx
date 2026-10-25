import type { Metadata } from "next";
import { RoomChatLoader } from "@/components/chat/RoomChatLoader";
import { getRoom } from "@/config/rooms";
import { SITE_NAME } from "@/config/site";

const room = getRoom("future-you");

export const metadata: Metadata = {
  title: room.title,
  description: `${room.description} Talk it through, then get a letter from each of your future selves.`,
  openGraph: { title: `${room.title} · ${SITE_NAME}`, description: room.description, url: room.href },
};

/** /rooms/future-you. No footer: the room fills the screen like a messaging app. */
export default function FutureYouPage() {
  return <RoomChatLoader roomId="future-you" />;
}
