import { FRIENDS_BY_ID } from "@/config/friends";
import type { GroupSetup } from "@/lib/chatTypes";

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Message text with @mentions highlighted: friends in their colour, "@you" in the brand colour. */
export function MessageText({ text, setup }: { text: string; setup: GroupSetup }) {
  // Match chosen names and default names (longest first, so "@Big Bro" wins over "@Big").
  const targets = new Map<string, string | null>(); // lowercase name -> colour (null = the user)
  for (const f of setup.friends) {
    targets.set(f.name.toLowerCase(), FRIENDS_BY_ID[f.id].color);
    targets.set(FRIENDS_BY_ID[f.id].name.toLowerCase(), FRIENDS_BY_ID[f.id].color);
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
