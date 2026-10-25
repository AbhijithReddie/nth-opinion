import { useRoom } from "./RoomContext";

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Message text with @mentions highlighted: personas in their colour, "@you" in the brand colour. */
export function MessageText({ text }: { text: string }) {
  const { setup, persona } = useRoom();

  // Match chosen names and default names (longest first, so "@Big Bro" wins over "@Big").
  const targets = new Map<string, string | null>(); // lowercase name -> colour (null = the user)
  for (const p of setup.participants) {
    const meta = persona(p.id);
    if (!meta) continue;
    targets.set(p.name.toLowerCase(), meta.color);
    targets.set(meta.name.toLowerCase(), meta.color);
  }
  targets.set("you", null);
  const names = [...targets.keys()].sort((a, b) => b.length - a.length).map(escapeRegex);
  const pattern = new RegExp(`(@(?:${names.join("|")}))(?![\\w])`, "gi");

  const parts = text.split(pattern);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 0) return part; // plain text between mentions
        const color = targets.get(part.slice(1).toLowerCase());
        return color ? (
          <span key={i} className="rounded px-0.5 font-semibold" style={{ color, backgroundColor: `${color}1f` }}>
            {part}
          </span>
        ) : (
          <span key={i} className="rounded bg-brand/20 px-0.5 font-semibold text-brand">
            {part}
          </span>
        );
      })}
    </>
  );
}
