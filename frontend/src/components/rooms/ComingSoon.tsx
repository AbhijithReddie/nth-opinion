import type { Metadata } from "next";
import { getRoom, LIVE_ROOMS } from "@/config/rooms";
import { SITE_NAME } from "@/config/site";
import { Footer } from "../Footer";
import { Avatar } from "../chat/Avatar";
import { ArrowRightIcon } from "../icons";
import { RoomIllustration } from "../illustrations/RoomIllustration";
import { ButtonLink } from "../ui/Button";
import { StatusBadge } from "../ui/StatusBadge";

/** Page metadata for a coming-soon room, from config/rooms.ts. */
export function comingSoonMetadata(roomId: string): Metadata {
  const room = getRoom(roomId);
  return {
    title: `${room.title} (coming soon)`,
    description: room.description,
    openGraph: { title: `${room.title} · ${SITE_NAME}`, description: room.description, url: room.href },
  };
}

/** A "coming soon" room page: what the room is, who'll be in it, and links to the live rooms. */
export function ComingSoon({ roomId }: { roomId: string }) {
  const room = getRoom(roomId);

  return (
    <>
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-14 sm:px-6 sm:py-20">
        <div className="animate-fade-up text-center">
          <RoomIllustration roomId={room.id} className="mx-auto max-w-xs" />
          <StatusBadge status="soon" className="mt-6" />
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-balance sm:text-5xl">{room.title}</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-pretty text-muted">{room.description}</p>
          <p className="mt-2 font-mono text-xs tracking-[0.18em] text-muted uppercase">Coming soon</p>
        </div>

        <section aria-labelledby="cast-title" className="mt-12 rounded-3xl border border-line bg-surface p-5 shadow-soft sm:p-8">
          <h2 id="cast-title" className="font-mono text-[11px] tracking-[0.2em] text-primary-deep uppercase">
            Who&apos;ll be in the room
          </h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-3">
            {room.cast.map((member) => (
              <li key={member.id} className="flex items-center gap-3 rounded-2xl border border-line bg-sand/60 p-3.5 sm:flex-col sm:text-center">
                <Avatar persona={member} size="lg" />
                <span>
                  <span className="block font-semibold">{member.name}</span>
                  <span className="block text-sm text-muted">{member.tagline}</span>
                </span>
              </li>
            ))}
            <li className="flex items-center gap-3 rounded-2xl border border-dashed border-line-strong p-3.5 sm:flex-col sm:justify-center sm:text-center">
              <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-full border-2 border-dashed border-line-strong bg-surface font-display text-lg font-semibold text-muted">
                You
              </span>
              <span>
                <span className="block font-semibold">You</span>
                <span className="block text-sm text-muted">In the middle of it all</span>
              </span>
            </li>
          </ul>
        </section>

        <section aria-labelledby="live-title" className="mt-10 text-center">
          <h2 id="live-title" className="font-display text-xl font-semibold">
            Can&apos;t wait? These rooms are open now
          </h2>
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            {LIVE_ROOMS.map((live, i) => (
              <ButtonLink key={live.id} href={live.href} variant={i === 0 ? "primary" : "secondary"}>
                {live.title}
                <ArrowRightIcon className="size-4" />
              </ButtonLink>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
