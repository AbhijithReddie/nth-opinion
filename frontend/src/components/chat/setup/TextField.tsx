/** A labelled single-line input for the setup screen (room title and context fields). */
export function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  max,
  required,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  max: number;
  required: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block font-display text-lg font-bold">
        {label}
        {required && <span className="sr-only"> (required)</span>}
      </label>
      <input
        id={id}
        value={value}
        maxLength={max}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="h-11 w-full rounded-xl border border-white/10 bg-arena-950/80 px-4 text-base text-ink placeholder:text-faint focus:border-brand/50 focus:ring-2 focus:ring-brand/25 focus:outline-none"
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-faint">
          {hint}
        </p>
      )}
    </div>
  );
}
