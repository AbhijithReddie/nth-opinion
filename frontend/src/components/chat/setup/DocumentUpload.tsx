"use client";

import { useId, useRef, useState, type DragEvent } from "react";
import type { RoomDocumentConfig } from "@/config/roomChats";
import {
  ACCEPT,
  DOC_LABELS,
  digestText,
  MAX_FILE_MB,
  PASTE_LIMITS,
  PRIVACY_NOTICE,
  setRoomDocument,
  uploadDocument,
  type RoomDocument,
} from "@/lib/documents";
import { StreamError } from "@/lib/sseClient";
import { CloseIcon, DownloadIcon } from "../../icons";
import { Button } from "../../ui/Button";

type Status = { kind: "idle" } | { kind: "uploading"; progress: number } | { kind: "reading" } | { kind: "error"; message: string };

/**
 * Upload (drag-and-drop or file picker) or paste one document for a room.
 * Shows progress, the page count and the digest the room will see, which can be removed.
 * The document lives in memory only (lib/documents.ts).
 */
export function DocumentUpload({ roomId, config, doc }: { roomId: string; config: RoomDocumentConfig; doc: RoomDocument | undefined }) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState("");
  const label = DOC_LABELS[config.type];
  const busy = status.kind === "uploading" || status.kind === "reading";

  async function run(work: () => Promise<RoomDocument>) {
    try {
      setRoomDocument(roomId, config.type, await work());
      setStatus({ kind: "idle" });
      setPasting(false);
      setPasted("");
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof StreamError ? err.message : "Couldn't read that. Please try again." });
    }
  }

  function upload(file: File | undefined) {
    if (!file || busy) return;
    setStatus({ kind: "uploading", progress: 0 });
    void run(() =>
      uploadDocument(file, config.type, (progress) =>
        // Once the bytes are sent, the server is reading and summarising the file.
        setStatus(progress >= 1 ? { kind: "reading" } : { kind: "uploading", progress }),
      ),
    );
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    upload(e.dataTransfer.files[0]);
  }

  return (
    <div className="rounded-2xl border border-line bg-canvas p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-base font-semibold">
          {label}{" "}
          <span className={`ml-1 rounded-full px-2 py-0.5 font-sans text-[11px] font-semibold ${config.recommended ? "bg-pro-soft text-pro-deep" : "bg-sand text-muted"}`}>
            {config.recommended ? "Recommended" : "Optional"}
          </span>
        </h3>
        <p className="text-xs text-muted">{config.hint}</p>
      </div>

      {doc ? (
        <div className="mt-3 rounded-xl border border-line bg-surface p-3">
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 text-sm">
              <span className="font-semibold break-all">{doc.filename}</span>
              <span className="text-muted">
                {" "}
                · {doc.pages} {doc.pages === 1 ? "page" : "pages"}
              </span>
            </p>
            <Button variant="ghost" size="sm" onClick={() => setRoomDocument(roomId, config.type, null)} aria-label={`Remove ${label.toLowerCase()}`}>
              <CloseIcon className="size-3.5" /> Remove
            </Button>
          </div>
          <p className="mt-2 font-mono text-[10px] tracking-[0.16em] text-muted uppercase">Here&apos;s what the panel will see</p>
          <p className="mt-1 max-h-40 overflow-y-auto rounded-lg bg-sand/60 p-2.5 text-[13px] leading-relaxed whitespace-pre-wrap text-ink/85">{doc.digest}</p>
        </div>
      ) : pasting ? (
        <div className="mt-3 space-y-2">
          <label htmlFor={`${id}-paste`} className="sr-only">
            Paste your {label.toLowerCase()}
          </label>
          <textarea
            id={`${id}-paste`}
            rows={6}
            value={pasted}
            maxLength={PASTE_LIMITS.max}
            onChange={(e) => setPasted(e.target.value)}
            placeholder={`Paste your ${label.toLowerCase()} as plain text...`}
            className="block w-full rounded-xl border border-line-strong bg-surface p-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={busy || pasted.trim().length < PASTE_LIMITS.min}
              onClick={() => {
                setStatus({ kind: "reading" });
                void run(() => digestText(config.type, pasted.trim()));
              }}
            >
              Use this text
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setPasting(false)}>
              Upload a file instead
            </Button>
            <span className="font-mono text-xs text-muted">
              {pasted.length.toLocaleString()}/{PASTE_LIMITS.max.toLocaleString()}
              {pasted.trim().length < PASTE_LIMITS.min && ` (at least ${PASTE_LIMITS.min})`}
            </span>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`mt-3 flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-5 text-center transition ${
            dragging ? "border-primary bg-primary-soft" : "border-line-strong bg-surface"
          }`}
        >
          <DownloadIcon className="size-5 rotate-180 text-muted" />
          <p className="text-sm">
            Drop your {label.toLowerCase()} here, or{" "}
            <button type="button" onClick={() => inputRef.current?.click()} className="font-semibold text-primary-deep underline underline-offset-4">
              choose a file
            </button>
          </p>
          <p className="text-xs text-muted">PDF, Word (.docx) or .txt, up to {MAX_FILE_MB} MB</p>
          <button type="button" onClick={() => setPasting(true)} className="text-xs font-semibold text-muted underline underline-offset-4 hover:text-ink">
            Paste text instead
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            tabIndex={-1}
            aria-label={`Upload your ${label.toLowerCase()}`}
            onChange={(e) => {
              upload(e.target.files?.[0]);
              e.target.value = ""; // so choosing the same file again still triggers
            }}
          />
        </div>
      )}

      <div aria-live="polite">
        {status.kind === "uploading" && (
          <div className="mt-3">
            <div
              role="progressbar"
              aria-label={`Uploading ${label.toLowerCase()}`}
              aria-valuenow={Math.round(status.progress * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-2 overflow-hidden rounded-full bg-sand"
            >
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${status.progress * 100}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted">Uploading... {Math.round(status.progress * 100)}%</p>
          </div>
        )}
        {status.kind === "reading" && <p className="mt-3 text-sm text-muted">Reading it and preparing a summary for the room...</p>}
        {status.kind === "error" && <p className="mt-3 rounded-lg border border-con/30 bg-con-soft px-3 py-2 text-sm text-ink">{status.message}</p>}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted">{PRIVACY_NOTICE}</p>
    </div>
  );
}
