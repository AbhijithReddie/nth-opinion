import type { Metadata } from "next";
import { RoomChatLoader } from "@/components/chat/RoomChatLoader";
import { getRoom } from "@/config/rooms";
import { SITE_NAME } from "@/config/site";

const room = getRoom("study-group");

export const metadata: Metadata = {
  title: room.title,
  description: `${room.description} Learn step by step, get quizzed, and leave with study notes.`,
  openGraph: { title: `${room.title} · ${SITE_NAME}`, description: room.description, url: room.href },
};

/** /rooms/study-group. No footer: the room fills the screen like a messaging app. */
export default function StudyGroupPage() {
  return <RoomChatLoader roomId="study-group" />;
}
