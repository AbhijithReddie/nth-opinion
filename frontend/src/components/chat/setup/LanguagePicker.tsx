"use client";

import type { Language } from "@/config/languages";
import { savePreferredLanguage, useLanguages } from "@/hooks/useLanguages";

/**
 * Every supported language as a radio group, each with a short example line.
 * The choice is remembered (localStorage) as the default for the next room.
 */
export function LanguagePicker({ value, onChange, name = "language" }: { value: Language; onChange: (lang: Language) => void; name?: string }) {
  const languages = useLanguages();
  return (
    <fieldset>
      <legend className="mb-2 font-display text-lg font-semibold">Language</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {languages.map((lang) => (
          <label
            key={lang.id}
            className={`flex cursor-pointer flex-col rounded-xl border px-3 py-2.5 text-left transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/50 ${
              value === lang.id ? "border-primary/60 bg-primary-soft text-ink shadow-soft" : "border-line-strong bg-surface text-muted hover:border-ink/25 hover:text-ink"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={lang.id}
              checked={value === lang.id}
              onChange={() => {
                savePreferredLanguage(lang.id);
                onChange(lang.id);
              }}
              className="sr-only"
            />
            <span className="text-sm font-semibold">{lang.label}</span>
            <span className="mt-0.5 text-[11px] leading-snug text-faint italic">{lang.example}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
