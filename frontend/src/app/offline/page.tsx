import type { Metadata } from "next";
import Link from "next/link";
import { RoomIcon } from "@/components/illustrations/RoomIcon";
import { LIVE_ROOMS } from "@/config/rooms";

export const metadata: Metadata = {
  title: "You're offline",
  description: "Nth Opinion needs the internet to talk to the AI, but the demo conversations work offline.",
  robots: { index: false },
};

/**
 * Shown by the service worker (public/sw.js) when a page can't be loaded offline.
 * The demo replays are cached, so each room's demo still plays.
 */
export default function OfflinePage() {
  return (
    <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-14 sm:px-6 sm:py-20">
      <p className="font-mono text-[11px] tracking-[0.2em] text-primary-deep uppercase">No connection</p>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">You&apos;re offline</h1>
      <p className="mt-3 max-w-xl text-lg text-muted">
        The AI rooms need the internet, but you can still watch a real recorded conversation in any room. Demos work
        offline once you&apos;ve opened Nth Opinion on this device before.
      </p>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {LIVE_ROOMS.map((room) => (
          <li key={room.id}>
            <Link
              href={`${room.href}?demo=1`}
              className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-soft transition hover:bg-sand focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
            >
              <RoomIcon room={room} />
              <span>
                <span className="block font-display text-lg font-semibold">{room.title}</span>
                <span className="text-sm text-primary-deep">Watch the demo →</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
