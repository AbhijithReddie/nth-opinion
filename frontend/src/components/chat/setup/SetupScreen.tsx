"use client";

import { useState, type FormEvent } from "react";
import { FRIENDS, FRIENDS_BY_ID, MAX_FRIENDS, MIN_FRIENDS, type FriendId, type Language } from "@/config/friends";
import type { GroupFriend, GroupSetup } from "@/lib/chatTypes";
import { Button } from "../../ui/Button";
import { FriendPickerCard } from "./FriendPickerCard";
import { LanguagePicker } from "./LanguagePicker";

const DEFAULT_GROUP_NAME = "The Gang";
const GROUP_NAME_MAX = 40;
const DEFAULT_FRIENDS: FriendId[] = ["rohit", "priya", "meera"];

/** Create (or edit) the group: pick 3-4 friends, rename them, choose a language, name the group. */
export function SetupScreen({
  initial,
  onSave,
  onCancel,
}: {
  initial: GroupSetup | null;
  onSave: (setup: GroupSetup) => void;
  /** Present when editing an existing group. */
  onCancel?: () => void;
}) {
  const [groupName, setGroupName] = useState(initial?.groupName ?? DEFAULT_GROUP_NAME);
  const [language, setLanguage] = useState<Language>(initial?.language ?? "english");
  const [selected, setSelected] = useState<FriendId[]>(initial?.friends.map((f) => f.id) ?? DEFAULT_FRIENDS);
  // Chosen names for every friend, so renames survive deselecting and reselecting.
  const [names, setNames] = useState<Record<FriendId, string>>(() => {
    const all = Object.fromEntries(FRIENDS.map((f) => [f.id, f.name])) as Record<FriendId, string>;
    for (const f of initial?.friends ?? []) all[f.id] = f.name;
    return all;
  });

  const full = selected.length >= MAX_FRIENDS;
  const countOk = selected.length >= MIN_FRIENDS && selected.length <= MAX_FRIENDS;
  const namesOk = selected.every((id) => names[id].trim().length > 0);
  const canSave = countOk && namesOk;

  function toggle(id: FriendId) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < MAX_FRIENDS ? [...s, id] : s));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    const friends: GroupFriend[] = selected.map((id) => ({ id, name: names[id].trim() || FRIENDS_BY_ID[id].name }));
    onSave({ groupName: groupName.trim() || DEFAULT_GROUP_NAME, friends, language });
  }

  return (
    <form onSubmit={submit} className="animate-fade-up mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="text-center">
        <p className="font-mono text-[11px] tracking-[0.2em] text-brand uppercase">The Group Chat</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          {initial ? "Edit your group" : "Build your group"}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-muted">
          Pick {MIN_FRIENDS} or {MAX_FRIENDS} friends to talk your problem through with. Rename them if you like.
        </p>
      </header>

      <div className="mt-8">
        <label htmlFor="group-name" className="mb-2 block font-display text-lg font-bold">
          Group name
        </label>
        <input
          id="group-name"
          value={groupName}
          maxLength={GROUP_NAME_MAX}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder={DEFAULT_GROUP_NAME}
          className="h-11 w-full rounded-xl border border-white/10 bg-arena-950/80 px-4 text-base text-ink placeholder:text-faint focus:border-brand/50 focus:ring-2 focus:ring-brand/25 focus:outline-none"
        />
      </div>

      <fieldset className="mt-8">
        <legend className="flex w-full items-baseline justify-between gap-3">
          <span className="font-display text-lg font-bold">Friends</span>
          <span aria-live="polite" className={`font-mono text-xs ${countOk ? "text-cyan" : "text-faint"}`}>
            {selected.length}/{MAX_FRIENDS} picked{full ? " · group is full" : ""}
          </span>
        </legend>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {FRIENDS.map((friend) => {
            const isSelected = selected.includes(friend.id);
            return (
              <FriendPickerCard
                key={friend.id}
                friend={friend}
                selected={isSelected}
                disabled={full && !isSelected}
                name={names[friend.id]}
                onToggle={() => toggle(friend.id)}
                onRename={(name) => setNames((n) => ({ ...n, [friend.id]: name }))}
              />
            );
          })}
        </ul>
      </fieldset>

      <div className="mt-8">
        <LanguagePicker value={language} onChange={setLanguage} />
      </div>

      <div className="mt-10 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
        <p className="text-sm text-faint sm:mr-auto" role="status">
          {!countOk
            ? `Pick ${MIN_FRIENDS} or ${MAX_FRIENDS} friends to continue.`
            : !namesOk
              ? "Every friend needs a name."
              : "Ready when you are."}
        </p>
        {onCancel && (
          <Button variant="secondary" size="lg" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="lg" disabled={!canSave}>
          {initial ? "Save group" : "Create group"}
        </Button>
      </div>
    </form>
  );
}
