"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { RoomMeta } from "@/config/rooms";
import { SITE_URL } from "@/config/site";
import { canShareImages, downloadBlob, isPrivate, renderCard, SHARE_SIZES, type ShareResult, type ShareSize } from "@/lib/share";
import { CheckIcon, CloseIcon, DownloadIcon, LinkIcon, ShareIcon } from "../icons";
import { Button } from "../ui/Button";
import { ShareCard } from "./ShareCard";

/** Preview box limits (px): the card is scaled down to fit. */
const PREVIEW_W = 320;
const PREVIEW_H = 440;

/** The "Share" button under a room's result; opens the share dialog. */
export function ShareButton({ result, room, demo = false }: { result: ShareResult; room: RoomMeta; demo?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <ShareIcon className="size-4" /> Share
      </Button>
      {open && <ShareDialog result={result} room={room} demo={demo} onClose={() => setOpen(false)} />}
    </>
  );
}

/**
 * Share dialog: a preview of the result card, square or story size, the
 * "Include my question" privacy toggle (off by default in personal rooms), and
 * Share / Download image / Copy link. A native <dialog> gives focus trapping,
 * Escape to close and the backdrop for free.
 */
function ShareDialog({ result, room, demo, onClose }: { result: ShareResult; room: RoomMeta; demo: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const captureRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [size, setSize] = useState<ShareSize>("square");
  const [includePrivate, setIncludePrivate] = useState(false);
  const [busy, setBusy] = useState<"share" | "download" | null>(null);
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null);
  // Only offered where the browser can share image files (mostly phones). This dialog only renders in the browser.
  const [canShare] = useState(canShareImages);
  const privacyToggle = isPrivate(result);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const card = { result, room, size, demo, includePrivate };
  const { width, height } = SHARE_SIZES[size];
  const scale = Math.min(PREVIEW_W / width, PREVIEW_H / height);
  const filename = `nth-opinion-${room.id}-${size}.png`;

  async function run(action: "share" | "download") {
    if (!captureRef.current || busy) return;
    setBusy(action);
    setStatus(null);
    try {
      const blob = await renderCard(captureRef.current, size);
      if (action === "download") {
        downloadBlob(blob, filename);
        setStatus({ text: "Image saved.", ok: true });
      } else {
        const file = new File([blob], filename, { type: "image/png" });
        await navigator.share({ files: [file], title: "My Nth Opinion", text: `Get your Nth Opinion: ${SITE_URL}` });
      }
    } catch (err) {
      // Closing the phone's share sheet isn't an error.
      if (!(err instanceof DOMException && err.name === "AbortError")) setStatus({ text: "Couldn't create the image. Please try again.", ok: false });
    } finally {
      setBusy(null);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(SITE_URL);
      setStatus({ text: "Link copied.", ok: true });
    } catch {
      setStatus({ text: `Couldn't copy. The link is ${SITE_URL}`, ok: false });
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => e.target === dialogRef.current && dialogRef.current.close()} // click on the backdrop
      className="m-auto max-h-[92dvh] w-[min(26rem,calc(100vw-2rem))] overflow-y-auto rounded-3xl border border-line bg-surface p-0 text-ink shadow-lift backdrop:bg-ink/45"
    >
      <div className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 id={titleId} className="font-display text-xl font-semibold">
            Share your result
          </h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Close"
            className="grid size-9 place-items-center rounded-lg text-muted transition hover:bg-sand hover:text-ink focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
          >
            <CloseIcon className="size-4" />
          </button>
        </div>

        <div role="radiogroup" aria-label="Card size" className="grid grid-cols-2 gap-1 rounded-xl bg-sand p-1">
          {(Object.keys(SHARE_SIZES) as ShareSize[]).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={size === s}
              onClick={() => setSize(s)}
              className={`h-9 rounded-lg text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none ${
                size === s ? "bg-surface text-ink shadow-soft" : "text-muted hover:text-ink"
              }`}
            >
              {SHARE_SIZES[s].label}
            </button>
          ))}
        </div>

        {privacyToggle && (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-canvas p-3 text-sm">
            <input
              type="checkbox"
              checked={includePrivate}
              onChange={(e) => setIncludePrivate(e.target.checked)}
              className="mt-0.5 size-4 accent-primary"
            />
            <span>
              <span className="font-semibold">Include my question</span>
              <span className="block text-muted">
                Off by default: your question, names and personal details (like anything from a resume) stay off the card.
              </span>
            </span>
          </label>
        )}

        {/* Preview: the card at its real size, scaled down to fit. */}
        <div className="flex justify-center">
          <div
            className="overflow-hidden rounded-2xl border border-line shadow-soft"
            style={{ width: width * scale, height: height * scale }}
            role="img"
            aria-label={`Preview of your ${SHARE_SIZES[size].label.toLowerCase()} share card`}
          >
            <div aria-hidden style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
              <ShareCard {...card} />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          {canShare && (
            <Button className="flex-1" onClick={() => run("share")} disabled={!!busy}>
              <ShareIcon className="size-4" /> {busy === "share" ? "Preparing..." : "Share"}
            </Button>
          )}
          <Button variant={canShare ? "secondary" : "primary"} className="flex-1" onClick={() => run("download")} disabled={!!busy}>
            <DownloadIcon className="size-4" /> {busy === "download" ? "Preparing..." : "Download image"}
          </Button>
          <Button variant="secondary" className="flex-1" onClick={copyLink}>
            <LinkIcon className="size-4" /> Copy link
          </Button>
        </div>
        <p role="status" className="flex min-h-5 items-center justify-center gap-1.5 text-center text-sm text-muted">
          {status?.ok && <CheckIcon className="size-4 text-pro-deep" />}
          {status?.text}
        </p>
      </div>

      {/* The full-size card the PNG is made from, kept off screen (the wrapper is moved, not the card, so the image isn't offset). */}
      <div aria-hidden className="pointer-events-none fixed top-0 left-[-20000px]">
        <div ref={captureRef}>
          <ShareCard {...card} />
        </div>
      </div>
    </dialog>
  );
}
