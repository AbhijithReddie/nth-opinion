import Link from "next/link";
import type { RoomMeta } from "@/config/rooms";
import { Avatar } from "../chat/Avatar";
import { ArrowRightIcon } from "../icons";
import { RoomIllustration } from "../illustrations/RoomIllustration";
import { StatusBadge } from "../ui/StatusBadge";

/**
 * A room on the home page grid: its illustration, description, example question and cast.
 * Live rooms invite you in; "soon" rooms are dimmed and link to their preview.
 */
export function RoomCard({ room }: { room: RoomMeta }) {
  const live = room.status === "live";

  return (
    <Link
      href={room.href}
      className={`group relative flex h-full flex-col overflow-hidden rounded-3xl border bg-surface shadow-soft transition focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas focus-visible:outline-none ${
        live ? "border-line hover:-translate-y-0.5 hover:shadow-lift" : "border-dashed border-line-strong opacity-80"
      }`}
    >
      <div className="relative px-6 pt-5" style={{ backgroundColor: `color-mix(in srgb, ${room.accent} 14%, white)` }}>
        <StatusBadge status={room.status} className="absolute top-4 right-4" />
        <RoomIllustration roomId={room.id} className="mx-auto max-w-[15rem] transition group-hover:scale-[1.02]" />
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-xl font-semibold text-ink">{room.title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted">{room.description}</p>

        <figure className="mt-4 flex-1">
          <figcaption className="font-mono text-[10px] tracking-[0.16em] uppercase" style={{ color: room.accentInk }}>
            Try asking
          </figcaption>
          <blockquote className="mt-1.5 rounded-2xl rounded-tl-md border border-line bg-sand/70 px-3 py-2 text-sm leading-snug text-ink">
            &ldquo;{room.example.prompt}&rdquo;
          </blockquote>
        </figure>

        <div className="mt-5 flex items-center justify-between gap-3">
          <span role="img" aria-label={`With ${room.cast.map((c) => c.name).join(", ")}`} className="flex -space-x-2">
            {room.cast.slice(0, 4).map((c) => (
              <Avatar key={c.id} persona={c} className="ring-2 ring-surface" />
            ))}
          </span>
          <span className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: room.accentInk }}>
            {live ? "Enter room" : "Preview"}
            <ArrowRightIcon className="size-4 transition group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
