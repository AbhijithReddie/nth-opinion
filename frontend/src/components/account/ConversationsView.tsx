"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RequireAccount } from "./RequireAccount";
import { ROOMS } from "@/config/rooms";
import { account, AccountError, type ConversationSummary } from "@/lib/account";
import { restoreConversation } from "@/lib/conversationSave";
import { PencilIcon, TrashIcon } from "../icons";

const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

/** /conversations: saved conversations grouped by room, with resume, rename and delete. */
export function ConversationsView({ userId }: { userId: string }) {
  const router = useRouter();
  const [list, setList] = useState<ConversationSummary[] | null>(null);
  const [max, setMax] = useState(50);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    account
      .conversations()
      .then((r) => {
        setList(r.conversations);
        setMax(r.max);
      })
      .catch((e: AccountError) => setError(e.message));
  }, [userId]);

  async function act(fn: () => Promise<void>) {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof AccountError ? e.message : "Something went wrong. Try again.");
    }
  }

  const resume = (c: ConversationSummary) =>
    act(async () => {
      const full = await account.conversation(c.id);
      const room = ROOMS.find((r) => r.id === c.room_id);
      if (!room || !restoreConversation(full, userId)) throw new AccountError("That room isn't available any more.", "not_found");
      router.push(room.href);
    });

  const rename = (id: string, title: string) =>
    act(async () => {
      const updated = await account.updateConversation(id, { title });
      setList((l) => l?.map((c) => (c.id === id ? { ...c, ...updated } : c)) ?? null);
      setRenaming(null);
    });

  const remove = (c: ConversationSummary) =>
    act(async () => {
      if (!window.confirm(`Delete "${c.title}"? This can't be undone.`)) return;
      await account.deleteConversation(c.id);
      setList((l) => l?.filter((x) => x.id !== c.id) ?? null);
    });

  if (!list) return error ? <p role="alert">{error}</p> : <p role="status" className="text-muted">Loading your conversations…</p>;

  const groups = ROOMS.map((room) => ({ room, items: list.filter((c) => c.room_id === room.id) })).filter((g) => g.items.length);
  return (
    <div className="space-y-8">
      <p className="text-sm text-muted">
        {list.length} of {max} saved. To save a conversation, turn on &ldquo;Save conversation&rdquo; in a room&apos;s menu.
      </p>
      {error && (
        <p role="alert" className="rounded-xl border border-con/30 bg-con-soft px-4 py-3 text-sm">
          {error}
        </p>
      )}
      {!groups.length && <p className="rounded-3xl border border-line bg-surface p-8 text-center text-muted shadow-soft">Nothing saved yet.</p>}
      {groups.map(({ room, items }) => (
        <section key={room.id} aria-labelledby={`room-${room.id}`} className="space-y-3">
          <h2 id={`room-${room.id}`} className="font-display text-xl font-semibold">
            {room.title}
          </h2>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
            {items.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  {renaming?.id === c.id ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (renaming.title.trim()) void rename(c.id, renaming.title.trim());
                      }}
                      className="flex gap-2"
                    >
                      <label htmlFor={`title-${c.id}`} className="sr-only">
                        New title
                      </label>
                      <input
                        id={`title-${c.id}`}
                        autoFocus
                        maxLength={120}
                        value={renaming.title}
                        onChange={(e) => setRenaming({ id: c.id, title: e.target.value })}
                        className="h-9 min-w-0 flex-1 rounded-lg border border-line-strong px-3 text-sm focus:border-primary focus:outline-none"
                      />
                      <button type="submit" className="h-9 rounded-lg bg-primary px-3 text-xs font-semibold text-white">
                        Save
                      </button>
                      <button type="button" onClick={() => setRenaming(null)} className="h-9 rounded-lg px-2 text-xs font-semibold text-muted">
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <>
                      <p className="truncate font-semibold">{c.title}</p>
                      <p className="text-xs text-muted">Updated {dateFormat.format(new Date(c.updated_at))}</p>
                    </>
                  )}
                </div>
                <button type="button" onClick={() => void resume(c)} className="h-9 rounded-lg bg-primary px-3 text-xs font-semibold text-white hover:bg-primary-deep">
                  Resume
                </button>
                <button
                  type="button"
                  aria-label={`Rename ${c.title}`}
                  onClick={() => setRenaming({ id: c.id, title: c.title })}
                  className="grid size-9 place-items-center rounded-lg text-muted hover:bg-sand hover:text-ink"
                >
                  <PencilIcon className="size-4" />
                </button>
                <button type="button" aria-label={`Delete ${c.title}`} onClick={() => void remove(c)} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-con-soft hover:text-con-deep">
                  <TrashIcon className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** The page body: asks guests to sign in first. */
export function ConversationsScreen() {
  return <RequireAccount what="your saved conversations">{(userId) => <ConversationsView userId={userId} />}</RequireAccount>;
}
