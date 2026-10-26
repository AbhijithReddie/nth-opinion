// Generates the PWA and Apple icons from the logo icon (public/nth-opinion-icon.svg).
// Run from frontend/ after changing the logo: node scripts/generate-icons.mjs
// (sharp comes with Next.js; the PNGs are committed.)
import sharp from "sharp";

const SOURCE = "public/nth-opinion-icon.svg";
const CANVAS = "#fbf7f0"; // Chai & Sage canvas, the app's background colour

/** The logo at `size`px, scaled to `scale` of the image, centred on `background` (or transparent). */
async function icon(file, size, { scale = 1, background = null } = {}) {
  const inner = Math.round(size * scale);
  const logo = await sharp(SOURCE, { density: 1200 }).resize(inner, inner).png().toBuffer();
  const base = sharp({
    create: { width: size, height: size, channels: 4, background: background ?? { r: 0, g: 0, b: 0, alpha: 0 } },
  });
  await base.composite([{ input: logo, gravity: "center" }]).png().toFile(file);
  console.log("wrote", file);
}

await icon("public/icons/icon-192.png", 192);
await icon("public/icons/icon-512.png", 512);
// Maskable icons get cropped to a circle or squircle: keep the logo inside the central 80% safe zone.
await icon("public/icons/maskable-192.png", 192, { scale: 0.62, background: CANVAS });
await icon("public/icons/maskable-512.png", 512, { scale: 0.62, background: CANVAS });
// iOS draws transparency as black, so the touch icon gets the canvas colour behind it.
await icon("public/apple-touch-icon.png", 180, { scale: 0.82, background: CANVAS });
