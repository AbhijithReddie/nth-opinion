import type { Metadata } from "next";
import { GroupChatLoader } from "@/components/chat/GroupChatLoader";
import { getRoom } from "@/config/rooms";

const room = getRoom("group-chat");

export const metadata: Metadata = {
  title: room.title,
  description: `${room.description} Pick 3-4 friends, chat in English, Hinglish or Tenglish, and ask the group to vote.`,
  openGraph: { title: `${room.title} · Huddle`, description: room.description, url: room.href },
};

/** /rooms/group-chat. No footer: the chat fills the screen like a messaging app. */
export default function GroupChatPage() {
  return <GroupChatLoader />;
}
