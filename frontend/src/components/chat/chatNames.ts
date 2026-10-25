/** "Rohit is typing...", "Rohit and Priya are typing...", "Rohit, Priya and Meera are typing...". */
export function typingLabel(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0]} is typing...`;
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)} are typing...`;
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** Fill `{key}` placeholders in config copy, e.g. "{title} is ready". */
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);
}

/** ₹ amounts given in lakhs: 50 -> "₹50 L", 250 -> "₹2.5 Cr". */
export function formatLakh(lakh: number): string {
  if (lakh >= 100) {
    const crore = lakh / 100;
    return `₹${Number.isInteger(crore) ? crore : crore.toFixed(crore < 10 ? 2 : 1).replace(/\.?0+$/, "")} Cr`;
  }
  return `₹${Number.isInteger(lakh) ? lakh : lakh.toFixed(1)} L`;
}
