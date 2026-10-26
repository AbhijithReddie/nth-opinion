/**
 * Document uploads (a resume, a job description, a pitch deck, notes).
 *
 * The backend reads the file in memory, never stores it, and returns a short
 * digest. Rooms send only that digest with their requests. Documents are kept
 * in memory for this browser session only: never in localStorage, so a reload
 * forgets them (the user uploads again).
 */

import { useSyncExternalStore } from "react";
import { API_URL, readError, StreamError } from "./sseClient";

export type DocType = "resume" | "job_description" | "pitch_deck" | "notes";

/** What the extract / digest endpoints return. `text` is never sent anywhere else or put in reports. */
export interface RoomDocument {
  doc_type: DocType;
  filename: string;
  pages: number;
  char_count: number;
  digest: string;
}

export const DOC_LABELS: Record<DocType, string> = {
  resume: "Resume",
  job_description: "Job description",
  pitch_deck: "Pitch deck",
  notes: "Notes",
};

export const MAX_FILE_MB = 5;
export const PASTE_LIMITS = { min: 50, max: 12_000 };
export const ACCEPT = ".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";

export const PRIVACY_NOTICE =
  "Your file is processed in memory and never stored by Nth Opinion. Its text is sent to Google Gemini to generate responses. Don't upload anything you're not comfortable sharing.";

const UNREACHABLE = "Can't reach the Nth Opinion server. Make sure the backend is running and try again.";

/** Keep only what rooms and the UI need (the full text is dropped right away). */
const keep = (d: RoomDocument & { text?: string }): RoomDocument => ({
  doc_type: d.doc_type,
  filename: d.filename,
  pages: d.pages,
  char_count: d.char_count,
  digest: d.digest,
});

/** Upload a file; `onProgress` gets 0-1 while it uploads. Errors are thrown as StreamError with a friendly message. */
export function uploadDocument(file: File, docType: DocType, onProgress: (fraction: number) => void): Promise<RoomDocument> {
  // Checked again on the server (which looks at the real content, not the name).
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    return Promise.reject(new StreamError(`That file is over ${MAX_FILE_MB} MB. Try a smaller file, or paste the text instead.`, "too_large"));
  }
  return new Promise((resolve, reject) => {
    // XMLHttpRequest, because fetch can't report upload progress.
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}/api/documents/extract`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onerror = () => reject(new StreamError(UNREACHABLE, "unreachable"));
    xhr.onload = () => {
      let body: { detail?: string; code?: string } & Partial<RoomDocument> = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // not JSON
      }
      if (xhr.status >= 200 && xhr.status < 300 && body.digest) return resolve(keep(body as RoomDocument));
      const fallback = xhr.status === 429 ? "Too many documents this hour. Try again later." : `Couldn't read that file (error ${xhr.status}).`;
      reject(new StreamError(body.detail ?? fallback, xhr.status === 429 ? "rate_limited" : body.code));
    };
    const form = new FormData();
    form.append("file", file);
    form.append("doc_type", docType);
    xhr.send(form);
  });
}

/** Pasted text instead of a file. */
export async function digestText(docType: DocType, text: string): Promise<RoomDocument> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/documents/digest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doc_type: docType, text }),
    });
  } catch {
    throw new StreamError(UNREACHABLE, "unreachable");
  }
  if (!response.ok) {
    const { detail, code } = await readError(response);
    throw new StreamError(detail ?? `Couldn't read that text (error ${response.status}).`, response.status === 429 ? "rate_limited" : code);
  }
  return keep(await response.json());
}

// --- per-room documents, in memory only ---------------------------------------------
const store = new Map<string, RoomDocument[]>();
const listeners = new Set<() => void>();
const NONE: RoomDocument[] = [];

/** A room's documents right now (for building requests). */
export const getRoomDocuments = (roomId: string) => store.get(roomId) ?? NONE;

export function setRoomDocument(roomId: string, docType: DocType, doc: RoomDocument | null) {
  const others = getRoomDocuments(roomId).filter((d) => d.doc_type !== docType);
  store.set(roomId, doc ? [...others, doc] : others);
  listeners.forEach((listener) => listener());
}

/** A room's documents, re-rendering when they change. Empty on the server. */
export function useRoomDocuments(roomId: string): RoomDocument[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => getRoomDocuments(roomId),
    () => NONE,
  );
}

/** The digests a room request carries. */
export const documentsForRequest = (roomId: string) =>
  getRoomDocuments(roomId).map(({ doc_type, filename, digest }) => ({ doc_type, filename, digest }));
