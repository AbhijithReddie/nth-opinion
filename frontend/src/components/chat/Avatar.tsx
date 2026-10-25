import { FRIENDS_BY_ID, type FriendId } from "@/config/friends";

const SIZES = { xs: "size-6 text-xs", sm: "size-8 text-base", md: "size-10 text-lg", lg: "size-14 text-2xl" };

/** A friend's round avatar: their emoji on a tint of their colour. */
export function Avatar({ id, size = "sm", className = "" }: { id: FriendId; size?: keyof typeof SIZES; className?: string }) {
  const friend = FRIENDS_BY_ID[id];
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full border ${SIZES[size]} ${className}`}
      style={{ backgroundColor: `${friend.color}26`, borderColor: `${friend.color}66` }}
    >
      {friend.emoji}
    </span>
  );
}
