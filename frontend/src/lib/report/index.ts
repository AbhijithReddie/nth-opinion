/**
 * "Download PDF report": builds the report in the browser with @react-pdf/renderer.
 * The library and the report layout (ReportDocument.tsx) load only on click, so
 * they don't slow down the room pages.
 */

import type { ChatItem, ChatMessage, RoomSetup, SummaryData } from "../chatTypes";
import { downloadBlob } from "../share";
import type { Turn, Verdict } from "../types";

/** What a report is made from: the room's outputs only (never uploaded document text). */
export type ReportInput =
  | { kind: "debate"; roomTitle: string; demo: boolean; topic: string; rounds: number; turns: Turn[]; verdict: Verdict }
  | {
      kind: "room";
      roomTitle: string;
      demo: boolean;
      summary: SummaryData;
      setupTitle: string;
      context: Record<string, string>;
      messages: ChatMessage[];
      /** Roast & Toast: persona messages from the roast phase. */
      roastLines: ChatMessage[];
      nameOf: (id: string) => string;
    };

/** A chat room's report input, from its setup and chat. */
export function roomReportInput(
  roomTitle: string,
  setup: RoomSetup,
  items: ChatItem[],
  summary: SummaryData,
  nameOf: (id: string) => string,
  demo: boolean,
): ReportInput {
  const messages = items.filter((i): i is ChatMessage => i.kind === "message");
  // Roast lines: persona messages before the first switch out of the starting (roast) mode.
  const firstSwitch = items.findIndex((i) => i.kind === "mode");
  const roastPhase = firstSwitch === -1 ? items : items.slice(0, firstSwitch);
  const roastLines = roastPhase.filter((i): i is ChatMessage => i.kind === "message" && i.sender !== "user");
  // The context is the room's own fields only (e.g. the pitch's sector and ask), never document text.
  return { kind: "room", roomTitle, demo, summary, setupTitle: setup.title, context: setup.context, messages, roastLines, nameOf };
}

export async function downloadReport(input: ReportInput) {
  const [{ pdf }, { ReportDocument, registerFonts }] = await Promise.all([import("@react-pdf/renderer"), import("./ReportDocument")]);
  registerFonts(window.location.origin);
  const date = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  // ReportDocument has no hooks, so calling it gives the <Document> element react-pdf expects.
  const blob = await pdf(ReportDocument({ input, date })).toBlob();
  const slug = input.roomTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  downloadBlob(blob, `nth-opinion-${slug}-report.pdf`);
}
