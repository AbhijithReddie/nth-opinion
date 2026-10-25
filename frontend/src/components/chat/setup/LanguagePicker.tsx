import { LANGUAGES, type Language } from "@/config/roomChats";

/** English / Hinglish / Tenglish as a segmented radio group. */
export function LanguagePicker({ value, onChange }: { value: Language; onChange: (lang: Language) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 font-display text-lg font-bold">Language</legend>
      <div className="grid grid-cols-3 gap-2">
        {LANGUAGES.map((lang) => (
          <label
            key={lang.id}
            className={`flex cursor-pointer flex-col items-center rounded-xl border px-2 py-2.5 text-center transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand/60 ${
              value === lang.id ? "border-brand/60 bg-brand/15 text-ink" : "border-white/10 bg-arena-900/70 text-muted hover:text-ink"
            }`}
          >
            <input
              type="radio"
              name="language"
              value={lang.id}
              checked={value === lang.id}
              onChange={() => onChange(lang.id)}
              className="sr-only"
            />
            <span className="text-sm font-semibold">{lang.label}</span>
            <span className="mt-0.5 text-[11px] leading-tight text-faint">{lang.hint}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
