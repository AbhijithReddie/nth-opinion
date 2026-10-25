import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SITE_EXPLAINER, SITE_NAME, SITE_TAGLINE } from "@/config/site";

// The link preview image (1200x630 PNG), generated at build time from the logo.
export const alt = `${SITE_NAME}: ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const icon = await readFile(join(process.cwd(), "public", "nth-opinion-icon.svg"), "utf8");
  const iconSrc = `data:image/svg+xml;base64,${Buffer.from(icon).toString("base64")}`;

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
          background: "radial-gradient(circle at 50% 0%, #2a2160 0%, #07080c 70%)",
          color: "#eceef4",
          fontFamily: "sans-serif",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={iconSrc} width={220} height={220} alt="" />
        {/* Wordmark: "N" + raised "th" + "Opinion", top-aligned so "th" sits like an ordinal superscript */}
        <div style={{ marginTop: 28, display: "flex", alignItems: "flex-start", fontSize: 96, fontWeight: 800, letterSpacing: -3 }}>
          <span>N</span>
          <span style={{ fontSize: 46, marginTop: 18, marginLeft: 2, letterSpacing: 0 }}>th</span>
          <span style={{ marginLeft: 24 }}>Opinion</span>
        </div>
        <div style={{ marginTop: 8, fontSize: 40, color: "#8d93a8" }}>{SITE_TAGLINE}</div>
        <div style={{ marginTop: 6, fontSize: 30, color: "#5d6378" }}>{SITE_EXPLAINER}</div>
      </div>
    ),
    size,
  );
}
