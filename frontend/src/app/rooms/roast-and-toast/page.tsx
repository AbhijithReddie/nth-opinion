import type { Metadata } from "next";
import { RoomChatLoader } from "@/components/chat/RoomChatLoader";
import { getRoom } from "@/config/rooms";

const room = getRoom("roast-and-toast");

export const metadata: Metadata = {
  title: room.title,
  description: `${room.description} Paste your resume or project, laugh at the roast, then get a scorecard with real fixes.`,
  openGraph: { title: `${room.title} · Huddle`, description: room.description, url: room.href },
};

/** /rooms/roast-and-toast. No footer: the room fills the screen like a messaging app. */
export default function RoastAndToastPage() {
  return <RoomChatLoader roomId="roast-and-toast" />;
}
