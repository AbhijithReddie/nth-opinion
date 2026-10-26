import Link from "next/link";
import type { RoomMeta } from "@/config/rooms";
import { RoomIcon } from "../illustrations/RoomIcon";
import { StatusBadge } from "../ui/StatusBadge";

/** One room in the navbar dropdown / mobile drawer: icon tile, title, Live/Soon badge, one-line description. */
export function RoomMenuItem({ room, onNavigate, active }: { room: RoomMeta; onNavigate: () => void; active: boolean }) {
  return (
    <Link
      href={room.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      data-menu-item
      className={`group flex items-start gap-3 rounded-xl p-2.5 transition hover:bg-sand focus-visible:bg-sand focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none ${
        active ? "bg-sand" : ""
      }`}
    >
      <RoomIcon room={room} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-semibold text-ink">{room.title}</span>
          <StatusBadge status={room.status} />
        </span>
        <span className="mt-0.5 block text-[13px] leading-snug text-muted">{room.description}</span>
      </span>
    </Link>
  );
}
