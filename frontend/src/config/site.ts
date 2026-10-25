/** Site-wide constants: name, tagline, links. Change them here and they update everywhere. */

export const SITE_NAME = "Huddle";
export const SITE_TAGLINE = "One problem. A room full of minds.";
export const SITE_DESCRIPTION =
  "Bring a problem to a room of AI personas with different personalities. A director agent decides who speaks, so it feels like a real conversation.";

/** Public URL of the site, used for absolute Open Graph links. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");

// TODO: replace with your repository URL.
export const GITHUB_URL = "https://github.com/your-username/huddle";

export const DISCLAIMER =
  "Huddle's AI personas give friendly perspectives and entertainment, not professional advice. If you're struggling, please talk to someone you trust or call Tele-MANAS at 14416.";
