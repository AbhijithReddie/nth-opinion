"use client";

import { useState, type FormEvent } from "react";
import { PERSONA_COLOURS } from "@/config/personas";
import type { Language } from "@/config/roomChats";
import {
  generatePersona,
  LIMITS,
  MAX_FRIENDS,
  newFriendId,
  useCustomPersonas,
  type CustomPersona,
  type PersonaDraft,
} from "@/lib/customPersonas";
import { StreamError } from "@/lib/sseClient";
import { TypingIndicator } from "../TypingIndicator";
import { LanguagePicker } from "../chat/setup/LanguagePicker";
import { TextField } from "../chat/setup/TextField";
import { PencilIcon, RefreshIcon, TrashIcon } from "../icons";
import { Button } from "../ui/Button";
import { GeneratedAvatar } from "./GeneratedAvatar";

const EXAMPLES = [
  "My strict but caring dad who worries about money and always asks if I've eaten",
  "An overprotective elder sister who roasts me but would fight anyone for me",
  "A calm startup mentor who asks one sharp question before giving advice",
  "My chill college roommate who turns every problem into a road trip plan",
];

/**
 * My Friends: build a custom persona from a description (preview, regenerate,
 * save), and edit or delete saved ones. Everything stays in this browser.
 */
export function FriendsManager() {
  const { friends, full, save, remove } = useCustomPersonas();
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div className="space-y-10">
      <Builder full={full} onSave={save} />

      <section aria-labelledby="friends-title">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="friends-title" className="font-display text-2xl font-semibold">
            Your friends
          </h2>
          <span className="font-mono text-xs text-muted">
            {friends.length}/{MAX_FRIENDS}
          </span>
        </div>
        {friends.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-line-strong bg-surface/60 p-5 text-center text-muted">
            No friends yet. Describe someone above and they&apos;ll show up here, ready to join your rooms.
          </p>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {friends.map((friend) =>
              editing === friend.id ? (
                <li key={friend.id} className="sm:col-span-2">
                  <EditForm
                    friend={friend}
                    onCancel={() => setEditing(null)}
                    onSave={(next) => {
                      save(next);
                      setEditing(null);
                    }}
                  />
                </li>
              ) : (
                <li key={friend.id}>
                  <FriendCard friend={friend}>
                    <Button variant="secondary" size="sm" onClick={() => setEditing(friend.id)}>
                      <PencilIcon className="size-3.5" /> Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-con-deep"
                      onClick={() => window.confirm(`Delete ${friend.name}? Rooms that already use them keep working.`) && remove(friend.id)}
                    >
                      <TrashIcon className="size-3.5" /> Delete
                    </Button>
                  </FriendCard>
                </li>
              ),
            )}
          </ul>
        )}
      </section>
    </div>
  );
}

/** A friend's card: avatar, name, personality, how they talk and their usual take. */
function FriendCard({ friend, children }: { friend: PersonaDraft; children?: React.ReactNode }) {
  return (
    <article className="flex h-full flex-col rounded-3xl border border-line bg-surface p-5 shadow-soft" style={{ borderColor: `${friend.colour}55` }}>
      <div className="flex items-center gap-3">
        <GeneratedAvatar avatar={friend.avatar} colour={friend.colour} />
        <div className="min-w-0">
          <h3 className="font-display text-xl font-semibold" style={{ color: friend.colour }}>
            {friend.name} <span aria-hidden>{friend.emoji}</span>
          </h3>
          <p className="text-sm text-muted">{friend.personality}</p>
        </div>
      </div>
      <dl className="mt-3 space-y-1.5 text-sm">
        <div>
          <dt className="inline font-semibold">Talks like: </dt>
          <dd className="inline text-muted">{friend.speaking_habits}</dd>
        </div>
        <div>
          <dt className="inline font-semibold">Usual take: </dt>
          <dd className="inline text-muted">{friend.typical_stance}</dd>
        </div>
      </dl>
      {children && <div className="mt-auto flex flex-wrap gap-2 pt-4">{children}</div>}
    </article>
  );
}

/** Describe someone, preview the generated persona, regenerate or save it. */
function Builder({ full, onSave }: { full: boolean; onSave: (friend: CustomPersona) => void }) {
  const [description, setDescription] = useState("");
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [language, setLanguage] = useState<Language>("english");
  const [draft, setDraft] = useState<PersonaDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ message: string; refused: boolean } | null>(null);
  const [saved, setSaved] = useState("");

  const tooShort = description.trim().length < 10;

  async function build(e?: FormEvent) {
    e?.preventDefault();
    if (busy || tooShort) return;
    setBusy(true);
    setProblem(null);
    setSaved("");
    try {
      setDraft(await generatePersona({ description: description.trim(), name: name.trim(), relationship: relationship.trim(), language }));
    } catch (err) {
      setDraft(null);
      setProblem({
        message: err instanceof StreamError ? err.message : "Couldn't build your friend right now. Please try again.",
        refused: err instanceof StreamError && err.code === "persona_refused",
      });
    } finally {
      setBusy(false);
    }
  }

  function keep() {
    if (!draft) return;
    onSave({ ...draft, id: newFriendId() });
    setSaved(`${draft.name} is saved. Invite them from any room's setup screen.`);
    setDraft(null);
    setDescription("");
    setName("");
    setRelationship("");
  }

  return (
    <section aria-labelledby="builder-title" className="rounded-3xl border border-line bg-surface p-5 shadow-soft sm:p-6">
      <h2 id="builder-title" className="font-display text-2xl font-semibold">
        Build your own friend
      </h2>
      <p className="mt-1 text-muted">Describe a type of person, not a real one. They&apos;ll get a personality, a way of talking and an avatar.</p>

      {full ? (
        <p className="mt-4 rounded-xl bg-sand p-3 text-sm">You have {MAX_FRIENDS} friends, the most this page keeps. Delete one to make room.</p>
      ) : (
        <form onSubmit={build} noValidate className="mt-5 space-y-5">
          <div>
            <TextField
              id="friend-description"
              label="Describe them"
              value={description}
              onChange={setDescription}
              placeholder="e.g. My strict but caring dad who always asks if I've eaten"
              max={LIMITS.description}
              required
              multiline
              rows={3}
            />
            <div className="mt-2 flex flex-wrap gap-2" aria-label="Example descriptions">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setDescription(example)}
                  className="rounded-full border border-line-strong bg-canvas px-3 py-1 text-left text-xs text-ink transition hover:bg-sand focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField id="friend-name" label="Name (optional)" value={name} onChange={setName} placeholder="e.g. Papa" max={LIMITS.name} required={false} />
            <TextField
              id="friend-relationship"
              label="Relationship (optional)"
              value={relationship}
              onChange={setRelationship}
              placeholder="e.g. dad, cousin, mentor"
              max={40}
              required={false}
            />
          </div>
          <LanguagePicker value={language} onChange={setLanguage} />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="lg" disabled={busy || tooShort}>
              {busy ? (
                <>
                  Building <TypingIndicator label="Building your friend" />
                </>
              ) : (
                "Build my friend"
              )}
            </Button>
            {tooShort && description && <span className="text-sm text-muted">A little more detail, please (10+ characters).</span>}
          </div>
        </form>
      )}

      <div aria-live="polite">
        {problem && (
          <p
            className={`mt-5 rounded-xl border px-4 py-3 text-sm ${problem.refused ? "border-accent/40 bg-lavender-soft text-ink" : "border-con/30 bg-con-soft text-ink"}`}
          >
            {problem.message}
          </p>
        )}
        {saved && <p className="mt-5 rounded-xl border border-pro/30 bg-pro-soft px-4 py-3 text-sm font-medium text-pro-deep">{saved}</p>}
        {draft && (
          <div className="mt-6 space-y-3">
            <p className="font-mono text-[11px] tracking-[0.16em] text-muted uppercase">Preview</p>
            <FriendCard friend={draft}>
              <Button onClick={keep}>Save friend</Button>
              <Button variant="secondary" onClick={() => build()} disabled={busy}>
                <RefreshIcon className="size-4" /> {busy ? "Regenerating..." : "Regenerate"}
              </Button>
              <Button variant="ghost" onClick={() => setDraft(null)}>
                Discard
              </Button>
            </FriendCard>
          </div>
        )}
      </div>
    </section>
  );
}

/** Edit a saved friend's name, emoji, colour and descriptions (same limits as the backend). */
function EditForm({ friend, onSave, onCancel }: { friend: CustomPersona; onSave: (next: CustomPersona) => void; onCancel: () => void }) {
  const [form, setForm] = useState(friend);
  const set = (key: keyof CustomPersona) => (value: string) => setForm((f) => ({ ...f, [key]: value }));
  const fields = ["name", "emoji", "personality", "speaking_habits", "typical_stance"] as const;
  const missing = fields.some((f) => !form[f].trim());

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!missing) onSave(Object.fromEntries(Object.entries(form).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v])) as CustomPersona);
      }}
      noValidate
      className="space-y-4 rounded-3xl border border-line bg-surface p-5 shadow-soft"
    >
      <div className="flex items-center gap-3">
        <GeneratedAvatar avatar={form.avatar} colour={form.colour} />
        <h3 className="font-display text-xl font-semibold">Edit {friend.name}</h3>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <TextField id={`edit-name-${friend.id}`} label="Name" value={form.name} onChange={set("name")} placeholder="Name" max={LIMITS.name} required />
        <TextField id={`edit-emoji-${friend.id}`} label="Emoji" value={form.emoji} onChange={set("emoji")} placeholder="🙂" max={LIMITS.emoji} required />
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Colour</legend>
        <div className="flex flex-wrap gap-2">
          {Object.entries(PERSONA_COLOURS).map(([colourName, hex]) => (
            <label key={hex} className="cursor-pointer" title={colourName}>
              <input type="radio" name={`colour-${friend.id}`} value={hex} checked={form.colour === hex} onChange={() => set("colour")(hex)} className="peer sr-only" />
              <span
                className="block size-8 rounded-full ring-offset-2 ring-offset-surface peer-checked:ring-2 peer-checked:ring-ink peer-focus-visible:ring-2 peer-focus-visible:ring-primary"
                style={{ backgroundColor: hex }}
              />
              <span className="sr-only">{colourName}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <TextField id={`edit-personality-${friend.id}`} label="Personality" value={form.personality} onChange={set("personality")} placeholder="Who they are" max={LIMITS.personality} required multiline rows={2} />
      <TextField id={`edit-habits-${friend.id}`} label="Speaking habits" value={form.speaking_habits} onChange={set("speaking_habits")} placeholder="How they talk" max={LIMITS.speaking_habits} required multiline rows={2} />
      <TextField id={`edit-stance-${friend.id}`} label="Usual take" value={form.typical_stance} onChange={set("typical_stance")} placeholder="Their usual advice" max={LIMITS.typical_stance} required multiline rows={2} />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={missing}>
          Save changes
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        {missing && <span className="text-sm text-muted">Every field needs something in it.</span>}
      </div>
    </form>
  );
}
