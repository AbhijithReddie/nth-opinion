import type { Metadata } from "next";
import { RoomChatLoader } from "@/components/chat/RoomChatLoader";
import { getRoom } from "@/config/rooms";
import { SITE_NAME } from "@/config/site";

const room = getRoom("group-chat");

export const metadata: Metadata = {
  title: room.title,
  description: `${room.description} Pick 3-4 friends, chat in English, Hinglish or Tenglish, and ask the group to vote.`,
  openGraph: { title: `${room.title} · ${SITE_NAME}`, description: room.description, url: room.href },
};

/** /rooms/group-chat. No footer: the chat fills the screen like a messaging app. */
export default function GroupChatPage() {
  return <RoomChatLoader roomId="group-chat" />;
}
