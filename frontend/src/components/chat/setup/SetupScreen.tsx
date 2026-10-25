"use client";

import { useState, type FormEvent } from "react";
import { personaById, type Language, type RoomChatConfig } from "@/config/roomChats";
import type { RoomSetup } from "@/lib/chatTypes";
import { Button } from "../../ui/Button";
import { LanguagePicker } from "./LanguagePicker";
import { PersonaCard } from "./PersonaCard";
import { TextField } from "./TextField";

/**
 * Create (or edit) a room: the title, the room's extra details (context fields),
 * the cast (picked and renamed, or a fixed panel), and the language.
 */
export function SetupScreen({
  config,
  initial,
  onSave,
  onCancel,
}: {
  config: RoomChatConfig;
  initial: RoomSetup | null;
  onSave: (setup: RoomSetup) => void;
  /** Present when editing an existing room. */
  onCancel?: () => void;
}) {
  const { cast, copy } = config;
  const fixedCast = cast.min === config.personas.length; // e.g. Shark Tank: always all three investors
  const titleRequired = !!config.title.contextKey;

  const [title, setTitle] = useState(initial?.title ?? config.title.default);
  const [context, setContext] = useState<Record<string, string>>(initial?.context ?? {});
  const [language, setLanguage] = useState<Language>(initial?.language ?? "english");
  const [selected, setSelected] = useState<string[]>(initial?.participants.map((p) => p.id) ?? cast.defaults);
  // Chosen names for every persona, so renames survive deselecting and reselecting.
  const [names, setNames] = useState<Record<string, string>>(() => {
    const all = Object.fromEntries(config.personas.map((p) => [p.id, p.name]));
    for (const p of initial?.participants ?? []) all[p.id] = p.name;
    return all;
  });

  const full = selected.length >= cast.max;
  const countOk = selected.length >= cast.min && selected.length <= cast.max;
  const namesOk = !cast.renamable || selected.every((id) => names[id].trim().length > 0);
  const titleOk = !titleRequired || title.trim().length > 0;
  const missingField = config.contextFields.find((f) => f.required && !context[f.id]?.trim());
  // A field's own check (e.g. an age range), only once something has been typed.
  const invalidField = config.contextFields
    .map((f) => ({ field: f, error: context[f.id]?.trim() && f.validate ? f.validate(context[f.id].trim()) : null }))
    .find((x) => x.error);
  // Set when "Start" is pressed with something missing: the message turns red.
  const [attempted, setAttempted] = useState(false);

  // What's stopping the user, and which input to jump to. Labels are quoted as written
  // ("What do you want to learn?"), since they can be questions or instructions.
  const blocker: { message: string; inputId?: string } | null = !titleOk
    ? { message: `Fill in “${config.title.label}” to continue.`, inputId: "room-title" }
    : missingField
      ? { message: `Fill in “${missingField.label}” to continue.`, inputId: `context-${missingField.id}` }
      : invalidField
        ? { message: invalidField.error!, inputId: `context-${invalidField.field.id}` }
        : !countOk
          ? { message: `Pick ${cast.min} or ${cast.max} ${cast.noun} to continue.` }
          : !namesOk
            ? { message: `Every one of your ${cast.noun} needs a name.` }
            : null;

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < cast.max ? [...s, id] : s));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (blocker) {
      // The button always looks clickable; instead of a dead disabled state, show what's missing.
      setAttempted(true);
      if (blocker.inputId) document.getElementById(blocker.inputId)?.focus();
      return;
    }
    const cleanContext = Object.fromEntries(
      config.contextFields.map((f) => [f.id, (context[f.id] ?? "").trim()]).filter(([, v]) => v),
    );
    onSave({
      title: title.trim() || config.title.default,
      participants: selected.map((id) => ({
        id,
        name: (cast.renamable ? names[id].trim() : "") || personaById(config, id)!.name,
      })),
      language,
      context: cleanContext,
    });
  }

  return (
    <form onSubmit={submit} noValidate className="animate-fade-up mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="text-center">
        <p className="font-mono text-[11px] tracking-[0.2em] text-brand uppercase">{copy.eyebrow}</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          {initial ? copy.editHeading : copy.heading}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-muted">{copy.intro}</p>
      </header>

      <div className="mt-8 space-y-6">
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
            required={f.required}
            hint={f.hint}
            multiline={f.multiline}
            rows={f.rows}
          />
        ))}
      </div>

      <fieldset className="mt-8">
        <legend className="flex w-full items-baseline justify-between gap-3">
          <span className="font-display text-lg font-bold">{cast.heading}</span>
          {!fixedCast && (
            <span aria-live="polite" className={`font-mono text-xs ${countOk ? "text-cyan" : "text-faint"}`}>
              {selected.length}/{cast.max} picked{full ? " · full" : ""}
            </span>
          )}
        </legend>
        <ul className={`mt-3 grid gap-3 ${fixedCast ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          {config.personas.map((persona) => {
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
                    ? { name: names[persona.id], onRename: (name) => setNames((n) => ({ ...n, [persona.id]: name })) }
                    : undefined
                }
              />
            );
          })}
        </ul>
      </fieldset>

      <div className="mt-8">
        <LanguagePicker value={language} onChange={setLanguage} />
      </div>

      <div className="mt-10 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
        <p id="setup-status" className={`text-sm sm:mr-auto ${blocker && attempted ? "text-coral" : "text-faint"}`} role="status">
          {blocker?.message ?? "Ready when you are."}
        </p>
        {onCancel && (
          <Button variant="secondary" size="lg" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="lg" aria-describedby="setup-status">
          {initial ? "Save" : copy.create}
        </Button>
      </div>
    </form>
  );
}
