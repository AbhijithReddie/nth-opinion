import { FRIENDS_BY_ID, isFriendId } from "@/config/friends";
import type { GroupSetup } from "@/lib/chatTypes";

/** Display name for a sender: "You", the user's chosen name for a friend, or the friend's default name. */
export function senderName(setup: GroupSetup, sender: string): string {
  if (sender === "user") return "You";
  const chosen = setup.friends.find((f) => f.id === sender)?.name;
  if (chosen) return chosen;
  return isFriendId(sender) ? FRIENDS_BY_ID[sender].name : "Someone";
}

/** "Rohit is typing...", "Rohit and Priya are typing...", "Rohit, Priya and Meera are typing...". */
export function typingLabel(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0]} is typing...`;
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)} are typing...`;
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
