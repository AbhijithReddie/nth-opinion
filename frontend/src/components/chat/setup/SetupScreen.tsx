"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { findBuiltIn, type Language, type RoomChatConfig } from "@/config/roomChats";
import { getRoom } from "@/config/rooms";
import type { RoomSetup } from "@/lib/chatTypes";
import { toPersona, useCustomPersonas, type CustomPersona } from "@/lib/customPersonas";
import { DOC_LABELS, useRoomDocuments } from "@/lib/documents";
import { BackdropBlobs } from "../../illustrations/Decor";
import { RoomIllustration } from "../../illustrations/RoomIllustration";
import { SampleSection } from "../../rooms/SampleSection";
import { WatchDemoButton } from "../../replay/DemoNotice";
import { Button } from "../../ui/Button";
import { RoomSample } from "../RoomSample";
import { DocumentUpload } from "./DocumentUpload";
import { GuestPicker } from "./GuestPicker";
import { LanguagePicker } from "./LanguagePicker";
import { PersonaCard } from "./PersonaCard";
import { TextField } from "./TextField";

/**
 * Create (or edit) a room: the title, the room's extra details (context fields),
 * the cast (picked and renamed, or a fixed panel; in the Group Chat the user's own
 * friends too), optional guests from other rooms or My Friends, documents to upload
 * (rooms that take them; kept in memory only), and the language.
 * Below the form, "See it in action" shows the room's sample conversation; its
 * "Try this example" button fills the form, and the example's first message is
 * handed to the chat (via `onDraft`) when the room is created.
 */
export function SetupScreen({
  config,
  initial,
  onSave,
  onCancel,
  onDraft,
  onWatchDemo,
  notice,
}: {
  /** A message above the form, e.g. "upload your resume again". */
  notice?: string;
  config: RoomChatConfig;
  initial: RoomSetup | null;
  onSave: (setup: RoomSetup) => void;
  /** Starts the room's demo replay; leave out when the room has no recording. */
  onWatchDemo?: () => void;
  /** Present when editing an existing room. */
  onCancel?: () => void;
  /** Called on save with the message to pre-fill in the chat ("" if none). */
  onDraft?: (message: string) => void;
}) {
  const { cast, copy } = config;
  const room = getRoom(config.roomId);
  const fixedCast = cast.min === config.personas.length; // e.g. Pitch Tank: always all three investors
  const titleRequired = !!config.title.contextKey;

  const [title, setTitle] = useState(initial?.title ?? config.title.default);
  const [context, setContext] = useState<Record<string, string>>(initial?.context ?? {});
  const [language, setLanguage] = useState<Language>(initial?.language ?? "english");
  const [selected, setSelected] = useState<string[]>(initial?.participants.map((p) => p.id) ?? cast.defaults);
  const [guests, setGuests] = useState<string[]>(initial?.guests?.map((g) => g.id) ?? []);

  // The user's own personas: saved friends, plus copies already in this room (still usable after a friend is deleted).
  const { friends } = useCustomPersonas();
  const customs: CustomPersona[] = [...friends, ...(initial?.custom ?? []).filter((c) => !friends.some((f) => f.id === c.id))];
  const memberOptions = [...config.personas, ...(config.customMembers ? customs.map(toPersona) : [])];
  const personaOf = (id: string) => {
    const custom = customs.find((c) => c.id === id);
    return memberOptions.find((p) => p.id === id) ?? (custom ? toPersona(custom) : findBuiltIn(id)?.persona);
  };
  const maxTotal = config.guests?.maxTotal ?? Infinity;
  // Uploaded documents (in memory only). A document can stand in for a required pasted field (e.g. a resume).
  const documents = useRoomDocuments(config.roomId);
  const covered = (f: { replacedBy?: string }) => !!f.replacedBy && documents.some((d) => d.doc_type === f.replacedBy);
  const roomFull = selected.length + guests.length >= maxTotal;
  // Chosen names for every persona, so renames survive deselecting and reselecting.
  const [names, setNames] = useState<Record<string, string>>(() => {
    const all = Object.fromEntries(config.personas.map((p) => [p.id, p.name]));
    for (const p of initial?.participants ?? []) all[p.id] = p.name;
    return all;
  });

  const nameFor = (id: string) => names[id] ?? personaOf(id)?.name ?? "";
  const full = selected.length >= cast.max || roomFull;
  const countOk = selected.length >= cast.min && selected.length <= cast.max;
  const totalOk = selected.length + guests.length <= maxTotal;
  const namesOk = !cast.renamable || selected.every((id) => nameFor(id).trim().length > 0);
  const titleOk = !titleRequired || title.trim().length > 0;
  const missingField = config.contextFields.find((f) => f.required && !context[f.id]?.trim() && !covered(f));
  // A field's own check (e.g. an age range), only once something has been typed.
  const invalidField = config.contextFields
    .map((f) => ({ field: f, error: context[f.id]?.trim() && f.validate ? f.validate(context[f.id].trim()) : null }))
    .find((x) => x.error);
  // Set when "Start" is pressed with something missing: the message turns red.
  const [attempted, setAttempted] = useState(false);
  // The example's first message, once "Try this example" has filled the form.
  const [exampleDraft, setExampleDraft] = useState("");

  // What's stopping the user, and which input to jump to. Labels are quoted as written
  // ("What do you want to learn?"), since they can be questions or instructions.
  const blocker: { message: string; inputId?: string } | null = !titleOk
    ? { message: `Fill in “${config.title.label}” to continue.`, inputId: "room-title" }
    : missingField
      ? {
          message: missingField.replacedBy
            ? `Fill in “${missingField.label}” or upload your ${DOC_LABELS[missingField.replacedBy].toLowerCase()} to continue.`
            : `Fill in “${missingField.label}” to continue.`,
          inputId: `context-${missingField.id}`,
        }
      : invalidField
        ? { message: invalidField.error!, inputId: `context-${invalidField.field.id}` }
        : !countOk
          ? { message: `Pick ${cast.min} or ${cast.max} ${cast.noun} to continue.` }
          : !totalOk
            ? { message: `This room fits ${maxTotal} people, guests included.` }
            : !namesOk
              ? { message: `Every one of your ${cast.noun} needs a name.` }
              : null;

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : !full ? [...s, id] : s));
    setGuests((g) => g.filter((x) => x !== id)); // a member can't also be a guest
  }

  function toggleGuest(id: string) {
    setGuests((g) => (g.includes(id) ? g.filter((x) => x !== id) : g.length < (config.guests?.max ?? 0) && !roomFull ? [...g, id] : g));
  }

  /** Fill the form with the room's example and scroll back up to it. */
  function tryExample() {
    const { fill } = room.example;
    setTitle(fill.title ?? config.title.default);
    setContext({ ...fill.context });
    setAttempted(false);
    setExampleDraft(fill.message);
    document.getElementById("room-title")?.focus({ preventScroll: true });
    document.getElementById("setup-top")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (blocker) {
      // The button always looks clickable; instead of a dead disabled state, show what's missing.
      setAttempted(true);
      if (blocker.inputId) document.getElementById(blocker.inputId)?.focus();
      return;
    }
    // Only carry the example's message over if the form still holds the example.
    const exampleTitle = room.example.fill.title ?? config.title.default;
    onDraft?.(exampleDraft && title.trim() === exampleTitle.trim() ? exampleDraft : "");
    const cleanContext = Object.fromEntries(
      config.contextFields.map((f) => [f.id, (context[f.id] ?? "").trim()]).filter(([, v]) => v),
    );
    const used = new Set([...selected, ...guests]);
    const custom = customs.filter((c) => used.has(c.id));
    onSave({
      title: title.trim() || config.title.default,
      participants: selected.map((id) => ({
        id,
        name: (cast.renamable ? nameFor(id).trim() : "") || personaOf(id)!.name,
      })),
      ...(guests.length ? { guests: guests.map((id) => ({ id, name: personaOf(id)!.name })) } : {}),
      // Copies of the user's own personas, so this room keeps working if they're later edited or deleted.
      ...(custom.length ? { custom } : {}),
      language,
      context: cleanContext,
    });
  }

  return (
    <div className="relative">
    <BackdropBlobs className="h-[28rem]" />
    <form id="setup-top" onSubmit={submit} noValidate className="animate-fade-up mx-auto w-full max-w-3xl scroll-mt-20 px-4 py-10 sm:px-6 sm:py-14">
      <header className="text-center">
        <RoomIllustration roomId={config.roomId} className="mx-auto max-w-[16rem] sm:max-w-xs" />
        <p className="mt-4 font-mono text-[11px] tracking-[0.2em] uppercase" style={{ color: room.accentInk }}>
          {copy.eyebrow}
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          {initial ? copy.editHeading : copy.heading}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-muted">{copy.intro}</p>
        {notice && (
          <p role="status" className="mx-auto mt-4 max-w-md rounded-xl border border-accent/40 bg-lavender-soft px-4 py-2.5 text-sm font-medium text-ink">
            {notice}
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
          <Button variant="secondary" size="sm" onClick={tryExample}>
            Try this example
          </Button>
          <a href="#sample" className="rounded-lg px-2 py-1.5 font-semibold text-primary-deep underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none">
            See a sample conversation ↓
          </a>
        </div>
      </header>

      <div className="mt-8 space-y-6 rounded-3xl border border-line bg-surface p-5 shadow-soft sm:p-6">
        <TextField
          id="room-title"
          label={config.title.label}
          value={title}
          onChange={setTitle}
          placeholder={config.title.placeholder}
          max={config.title.max}
          required={titleRequired}
        />
        {config.contextFields.map((f) => (
          <TextField
            key={f.id}
            id={`context-${f.id}`}
            label={f.label}
            value={context[f.id] ?? ""}
            onChange={(v) => setContext((c) => ({ ...c, [f.id]: v }))}
            placeholder={f.placeholder}
            max={f.max}
            required={f.required && !covered(f)}
            hint={f.replacedBy ? `${f.hint ?? ""} Or upload your ${DOC_LABELS[f.replacedBy].toLowerCase()} below instead.`.trim() : f.hint}
            multiline={f.multiline}
            rows={f.rows}
          />
        ))}
      </div>

      {config.documents && (
        <section aria-labelledby="documents-title" className="mt-8">
          <h2 id="documents-title" className="font-display text-lg font-semibold">
            Documents
          </h2>
          <p className="text-sm text-muted">Upload a file or paste the text. Only a short summary is shared with the room.</p>
          <div className="mt-3 space-y-3">
            {config.documents.map((d) => (
              <DocumentUpload key={d.type} roomId={config.roomId} config={d} doc={documents.find((doc) => doc.doc_type === d.type)} />
            ))}
          </div>
        </section>
      )}

      <fieldset className="mt-8">
        <legend className="flex w-full items-baseline justify-between gap-3">
          <span className="font-display text-lg font-semibold">{cast.heading}</span>
          {!fixedCast && (
            <span aria-live="polite" className={`font-mono text-xs ${countOk ? "text-pro-deep" : "text-muted"}`}>
              {selected.length}/{cast.max} picked{full ? " · full" : ""}
            </span>
          )}
        </legend>
        <ul className={`mt-3 grid gap-3 ${fixedCast ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          {memberOptions.map((persona) => {
            const isSelected = selected.includes(persona.id);
            return (
              <PersonaCard
                key={persona.id}
                persona={persona}
                selection={
                  fixedCast
                    ? null
                    : { selected: isSelected, disabled: full && !isSelected, onToggle: () => toggle(persona.id) }
                }
                rename={
                  cast.renamable && isSelected
                    ? { name: nameFor(persona.id), onRename: (name) => setNames((n) => ({ ...n, [persona.id]: name })) }
                    : undefined
                }
              />
            );
          })}
        </ul>
        {config.customMembers && customs.length === 0 && (
          <p className="mt-3 text-sm text-muted">
            Want someone else in the group?{" "}
            <Link href="/friends" className="font-semibold text-primary-deep underline underline-offset-4">
              Build your own friend
            </Link>
          </p>
        )}
      </fieldset>

      {config.guests && (
        <GuestPicker
          config={config}
          friends={customs.map(toPersona)}
          memberIds={selected}
          selected={guests}
          canAddMore={guests.length < config.guests.max && !roomFull}
          onToggle={toggleGuest}
        />
      )}

      <div className="mt-8">
        <LanguagePicker value={language} onChange={setLanguage} />
      </div>

      <div className="mt-10 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
        <p id="setup-status" className={`text-sm sm:mr-auto ${blocker && attempted ? "font-medium text-con-deep" : "text-muted"}`} role="status">
          {blocker?.message ?? "Ready when you are."}
        </p>
        {onCancel && (
          <Button variant="secondary" size="lg" onClick={onCancel}>
            Cancel
          </Button>
        )}
        {onWatchDemo && <WatchDemoButton onClick={onWatchDemo} />}
        <Button type="submit" size="lg" aria-describedby="setup-status">
          {initial ? "Save" : copy.create}
        </Button>
      </div>
    </form>

    <div className="mx-auto w-full max-w-3xl px-4 pb-16 sm:px-6">
      <SampleSection room={room} onTry={tryExample}>
        <RoomSample config={config} example={room.example} />
      </SampleSection>
    </div>
    </div>
  );
}
