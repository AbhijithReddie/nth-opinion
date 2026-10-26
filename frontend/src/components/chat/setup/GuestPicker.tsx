"use client";

import Link from "next/link";
import type { Persona } from "@/config/personas";
import { ROOM_CHATS, type RoomChatConfig } from "@/config/roomChats";
import { getRoom } from "@/config/rooms";
import { CheckIcon } from "../../icons";
import { Avatar } from "../Avatar";

/**
 * "Invite a guest": pick personas from other rooms, or from My Friends, to drop
 * into this room with a smaller role (the room's config says what guests do here).
 */
export function GuestPicker({
  config,
  friends,
  memberIds,
  selected,
  canAddMore,
  onToggle,
}: {
  config: RoomChatConfig;
  /** The user's own personas that aren't already members. */
  friends: Persona[];
  memberIds: string[];
  selected: string[];
  /** False once the room is full (max guests, or the room's total cap). */
  canAddMore: boolean;
  onToggle: (id: string) => void;
}) {
  const guests = config.guests!;
  const otherRooms = (Object.values(ROOM_CHATS) as RoomChatConfig[]).filter((c) => c.roomId !== config.roomId);
  const groups = [
    { title: "My Friends", people: friends.filter((f) => !memberIds.includes(f.id)) },
    ...otherRooms.map((c) => ({ title: getRoom(c.roomId).title, people: c.personas })),
  ];

  return (
    <details className="group mt-8 rounded-3xl border border-line bg-surface p-5 shadow-soft sm:p-6" open={selected.length > 0 || undefined}>
      <summary className="flex cursor-pointer list-none items-baseline justify-between gap-3 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
        <span>
          <span className="font-display text-lg font-semibold">Invite a guest</span>
          <span className="ml-2 text-sm text-muted">(optional)</span>
          <span className="block text-sm text-muted">{guests.role}</span>
        </span>
        <span aria-live="polite" className="shrink-0 font-mono text-xs text-muted">
          {selected.length}/{guests.max}
          <span className="ml-2 inline-block transition group-open:rotate-180" aria-hidden>
            ▾
          </span>
        </span>
      </summary>

      <div className="mt-4 space-y-4">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="font-mono text-[11px] tracking-[0.16em] text-muted uppercase">{group.title}</p>
            {group.people.length === 0 ? (
              <p className="mt-1.5 text-sm text-muted">
                No friends yet.{" "}
                <Link href="/friends" className="font-semibold text-primary-deep underline underline-offset-4">
                  Build your own friend
                </Link>
              </p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-2">
                {group.people.map((p) => {
                  const on = selected.includes(p.id);
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        aria-pressed={on}
                        disabled={!on && !canAddMore}
                        onClick={() => onToggle(p.id)}
                        title={p.tagline}
                        className={`inline-flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm transition focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
                          on ? "border-transparent bg-lavender-soft font-semibold text-ink" : "border-line-strong bg-surface text-ink hover:bg-sand"
                        }`}
                        style={on ? { boxShadow: `0 0 0 2px ${p.color}` } : undefined}
                      >
                        <Avatar persona={p} size="xs" />
                        {p.name}
                        {on && <CheckIcon className="size-3.5" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}
