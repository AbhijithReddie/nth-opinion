import Link from "next/link";
import type { RoomMeta } from "@/config/rooms";
import { ArrowRightIcon } from "../icons";
import { StatusBadge } from "../ui/StatusBadge";

/** A room on the home page grid. Live rooms invite you in; "soon" rooms are dimmed and link to their preview. */
export function RoomCard({ room }: { room: RoomMeta }) {
  const live = room.status === "live";

  return (
    <Link
      href={room.href}
      className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border p-5 transition focus-visible:ring-2 focus-visible:ring-brand/70 focus-visible:outline-none ${
        live
          ? "border-white/[0.09] bg-arena-900/80 hover:-translate-y-0.5 hover:border-white/20"
          : "border-dashed border-white/[0.08] bg-arena-900/40 hover:border-white/15"
      }`}
    >
      {/* Soft glow in the room's accent colour. */}
      <span
        aria-hidden
        className={`pointer-events-none absolute -top-16 -right-16 size-40 rounded-full blur-3xl transition ${live ? "opacity-25 group-hover:opacity-40" : "opacity-10"}`}
        style={{ backgroundColor: room.accent }}
      />

      <div className="flex items-start justify-between gap-3">
        <span
          aria-hidden
          className={`grid size-12 place-items-center rounded-2xl border text-2xl ${live ? "" : "grayscale-[40%]"}`}
          style={{ borderColor: `${room.accent}40`, backgroundColor: `${room.accent}14` }}
        >
          {room.icon}
        </span>
        <StatusBadge status={room.status} />
      </div>

      <h3 className={`mt-4 font-display text-xl font-bold ${live ? "text-ink" : "text-ink/75"}`}>{room.title}</h3>
      <p className={`mt-1.5 flex-1 text-sm leading-relaxed ${live ? "text-muted" : "text-faint"}`}>{room.description}</p>

      <div className="mt-5 flex items-center justify-between gap-3">
        <span aria-label={`With ${room.cast.map((c) => c.name).join(", ")}`} className="flex -space-x-1.5">
          {room.cast.slice(0, 4).map((c) => (
            <span
              key={c.name}
              aria-hidden
              className="grid size-7 place-items-center rounded-full border border-arena-900 bg-arena-700 text-sm"
            >
              {c.emoji}
            </span>
          ))}
        </span>
        <span className={`inline-flex items-center gap-1 text-sm font-semibold ${live ? "text-ink" : "text-faint"}`}>
          {live ? "Enter room" : "Preview"}
          <ArrowRightIcon className="size-4 transition group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
