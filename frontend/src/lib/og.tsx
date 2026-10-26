/**
 * Link-preview images (Open Graph + Twitter, 1200 x 630), drawn with next/og.
 * Used by the opengraph-image / twitter-image files of the home page and every room.
 *
 * next/og can't run the Tailwind classes the illustrations are coloured with, so
 * the illustration is turned into a standalone SVG: its components are rendered
 * to markup here, and every `fill-*` / `stroke-*` class becomes a real colour
 * read from the theme tokens in globals.css.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { Fragment, isValidElement, type ReactNode } from "react";
import { RoomIllustration } from "@/components/illustrations/RoomIllustration";
import { getRoom } from "@/config/rooms";
import { SITE_EXPLAINER, SITE_TAGLINE, SITE_URL } from "@/config/site";

export const OG_SIZE = { width: 1200, height: 630 };

/** The theme's colours by token name ("sage-deep" -> "#..."), from the --color-* variables in globals.css. */
async function themeColors(): Promise<Map<string, string>> {
  const css = await readFile(join(process.cwd(), "src", "app", "globals.css"), "utf8");
  const raw = new Map([...css.matchAll(/--color-([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  const resolve = (value: string, depth = 0): string => {
    const ref = value.match(/^var\(--color-([\w-]+)\)$/);
    return ref && depth < 5 ? resolve(raw.get(ref[1]) ?? "#000", depth + 1) : value;
  };
  return new Map([...raw.keys()].map((name) => [name, resolve(raw.get(name)!)]));
}

/** SVG attributes for a Tailwind class list: fill-x, fill-x/40, stroke-x, ... (anything else is dropped). */
function classToAttrs(className: string, colors: Map<string, string>): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const token of className.split(/\s+/)) {
    const m = token.match(/^(fill|stroke)-([\w-]+?)(?:\/(\d+))?$/);
    const color = m && colors.get(m[2]);
    if (!m || !color) continue;
    attrs[m[1]] = color;
    if (m[3]) attrs[`${m[1]}-opacity`] = String(Number(m[3]) / 100);
  }
  return attrs;
}

const escapeXml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const attrName = (prop: string) => (prop === "viewBox" ? prop : prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`));

/** Render a tree of plain SVG components (no hooks) to markup, turning class names into colours. */
function toSvg(node: ReactNode, colors: Map<string, string>): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return escapeXml(String(node));
  if (Array.isArray(node)) return node.map((child) => toSvg(child, colors)).join("");
  if (!isValidElement(node)) return "";
  const { type } = node;
  const props = node.props as Record<string, unknown> & { children?: ReactNode; className?: string };
  if (type === Fragment) return toSvg(props.children, colors);
  if (typeof type === "function") return toSvg((type as (p: unknown) => ReactNode)(props), colors);
  if (typeof type !== "string") return "";

  const attrs: Record<string, string> = type === "svg" ? { xmlns: "http://www.w3.org/2000/svg" } : {};
  for (const [key, value] of Object.entries(props)) {
    if (key === "children" || key === "className" || key === "style" || value === undefined || typeof value === "object") continue;
    attrs[attrName(key)] = String(value);
  }
  Object.assign(attrs, classToAttrs(props.className ?? "", colors));
  const attrText = Object.entries(attrs)
    .map(([k, v]) => ` ${k}="${escapeXml(v)}"`)
    .join("");
  return `<${type}${attrText}>${toSvg(props.children, colors)}</${type}>`;
}

const toDataUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

/** The site's logo icon, as a data URI. */
async function logoIcon() {
  return toDataUri(await readFile(join(process.cwd(), "public", "nth-opinion-icon.svg"), "utf8"));
}

/** "N" + raised "th" + "Opinion", top-aligned so "th" sits like an ordinal superscript. */
function Wordmark({ size }: { size: number }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", fontSize: size, fontWeight: 700, letterSpacing: -size / 32 }}>
      <span>N</span>
      <span style={{ fontSize: size * 0.48, marginTop: size * 0.19, marginLeft: 2, letterSpacing: 0 }}>th</span>
      <span style={{ marginLeft: size / 4 }}>Opinion</span>
    </div>
  );
}

const SITE_ADDRESS = SITE_URL.replace(/^https?:\/\//, "");

/** The home page's preview: logo, wordmark, tagline. */
export async function siteOgImage() {
  const icon = await logoIcon();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(circle at 15% 0%, #fcf1cf 0%, transparent 45%), radial-gradient(circle at 90% 10%, #eee9f9 0%, transparent 45%), #fbf7f0",
          color: "#2b2240",
          fontFamily: "sans-serif",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={icon} width={220} height={220} alt="" />
        <div style={{ marginTop: 28, display: "flex" }}>
          <Wordmark size={96} />
        </div>
        <div style={{ marginTop: 8, fontSize: 40, color: "#9a3b2a" }}>{SITE_TAGLINE}</div>
        <div style={{ marginTop: 6, fontSize: 30, color: "#5e5670" }}>{SITE_EXPLAINER}</div>
      </div>
    ),
    OG_SIZE,
  );
}

/** A room's preview: its title and one-line description on the left, its illustration on the right. */
export async function roomOgImage(roomId: string) {
  const room = getRoom(roomId);
  const [colors, icon] = await Promise.all([themeColors(), logoIcon()]);
  const accent = colors.get(room.accent.match(/--color-([\w-]+)/)?.[1] ?? "") ?? "#e9dfcf";
  const accentInk = colors.get(room.accentInk.match(/--color-([\w-]+)/)?.[1] ?? "") ?? "#2b2240";
  const art = toDataUri(toSvg(<RoomIllustration roomId={room.id} />, colors));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          padding: "56px 64px",
          background: `radial-gradient(circle at 92% 10%, ${accent}66 0%, transparent 42%), radial-gradient(circle at 0% 100%, ${accent}33 0%, transparent 40%), #fbf7f0`,
          color: "#2b2240",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", width: 560 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={icon} width={64} height={64} alt="" />
            <Wordmark size={40} />
          </div>
          <div style={{ marginTop: 56, fontSize: 24, fontWeight: 700, letterSpacing: 4, textTransform: "uppercase", color: accentInk }}>
            An Nth Opinion room
          </div>
          <div style={{ marginTop: 12, fontSize: 68, fontWeight: 700, lineHeight: 1.05, letterSpacing: -1 }}>{room.title}</div>
          <div style={{ marginTop: 20, fontSize: 30, lineHeight: 1.3, color: "#5e5670" }}>{room.description}</div>
          <div style={{ marginTop: "auto", display: "flex", fontSize: 26, color: "#5e5670" }}>
            <span style={{ fontWeight: 700, color: "#2b2240" }}>Get your Nth Opinion</span>
            <span style={{ marginLeft: 14, color: accentInk }}>{SITE_ADDRESS}</span>
          </div>
        </div>
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={art} width={500} height={344} alt="" />
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
