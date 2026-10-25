import type { Metadata } from "next";
import { RoomChatLoader } from "@/components/chat/RoomChatLoader";
import { getRoom } from "@/config/rooms";
import { SITE_NAME } from "@/config/site";

const room = getRoom("interview-panel");

export const metadata: Metadata = {
  title: room.title,
  description: `${room.description} Practise answering one question at a time, then see whether the panel would hire you and why.`,
  openGraph: { title: `${room.title} · ${SITE_NAME}`, description: room.description, url: room.href },
};

/** /rooms/interview-panel. No footer: the room fills the screen like a messaging app. */
export default function InterviewPanelPage() {
  return <RoomChatLoader roomId="interview-panel" />;
}
