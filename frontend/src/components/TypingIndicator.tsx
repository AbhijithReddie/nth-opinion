/** Three bouncing dots shown on whoever is speaking (or about to). */
export function TypingIndicator({ className = "", label }: { className?: string; label: string }) {
  return (
    <span role="status" className={`inline-flex items-center gap-1 ${className}`}>
      <span className="sr-only">{label}</span>
      <span className="typing-dot size-1.5 rounded-full bg-current" />
      <span className="typing-dot size-1.5 rounded-full bg-current" />
      <span className="typing-dot size-1.5 rounded-full bg-current" />
    </span>
  );
}
