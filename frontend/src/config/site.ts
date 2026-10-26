/** Site-wide constants: name, tagline, links. Change them here and they update everywhere. */

export const SITE_NAME = "Nth Opinion";
export const SITE_TAGLINE = "Why stop at a second?";
export const SITE_EXPLAINER = "One question. A room full of AI minds.";
export const SITE_DESCRIPTION =
  "One question. A room full of AI minds. Bring a problem to a room of AI personas with different personalities. A director agent decides who speaks, so it feels like a real conversation.";

/** Public URL of the site: the metadata base for link previews, and the address printed on share cards. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://nth-opinion.vercel.app").replace(/\/+$/, "");

// TODO: replace with your repository URL.
export const GITHUB_URL = "https://github.com/your-username/nth-opinion";

export const DISCLAIMER =
  "Nth Opinion's AI personas give friendly perspectives and entertainment, not professional advice. If you're struggling, please talk to someone you trust or call Tele-MANAS at 14416.";
