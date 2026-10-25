/**
 * Client for the chat rooms:
 *   POST /api/rooms/{room_id}/message  (SSE stream of typing / message / reaction / ... events)
 *   POST /api/rooms/{room_id}/summary  (JSON: a poll, investor offers, ...)
 * Errors are thrown as StreamError with a friendly message.
 */

import type { RoomChatConfig } from "@/config/roomChats";
import type {
  ChatItem,
  FutureLetters,
  InterviewResult,
  Offers,
  Poll,
  RoomEvent,
  RoomSetup,
  Scorecard,
  StudyNotes,
  SummaryItem,
} from "./chatTypes";
import { API_URL, readDetail, StreamError, streamSse } from "./sseClient";

/** The backend only looks at the last 40 messages, so there's no point sending more. */
const HISTORY_LIMIT = 40;
const SUMMARY_TIMEOUT_MS = 90_000;

const EVENT_TYPES = new Set(["typing", "message", "reaction", "safety", "mode", "your_turn", "error"]);
const FINAL_EVENTS = new Set(["your_turn", "error"]);

const UNREACHABLE = "Can't reach the Nth Opinion server. Make sure the backend is running and try again.";

/** The parts of every request that describe the room: history, cast, language and context. */
function roomBody(config: RoomChatConfig, setup: RoomSetup, items: ChatItem[]) {
  const context = { ...setup.context };
  if (config.title.contextKey) context[config.title.contextKey] = setup.title;
  return {
    // Recent messages only; summary cards stay in the browser.
    history: items
      .filter((item) => item.kind === "message")
      .slice(-HISTORY_LIMIT)
      .map((m) => ({ id: m.id, sender: m.sender, text: m.text, reply_to: m.replyTo })),
    participants: setup.participants,
    language: setup.language,
    context,
  };
}

function httpMessage(status: number, detail: string | undefined, what: "message" | "summary"): string {
  if (status === 429) return detail ?? "You're sending messages too fast. Take a breather and try again soon.";
  if (status === 422) return detail ?? "Something about that message didn't look right. Please try again.";
  if (status === 503) return detail ?? "The AI is busy right now, please try again in a minute.";
  return what === "summary"
    ? `Couldn't wrap this up right now (error ${status}). Please try again.`
    : `The room's server ran into a problem (error ${status}). Please try again.`;
}

export async function streamRoomMessage(
  config: RoomChatConfig,
  setup: RoomSetup,
  history: ChatItem[],
  message: { id: string; text: string },
  /** The room's current mode, for rooms with modes (null otherwise). */
  mode: string | null,
  onEvent: (event: RoomEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  await streamSse<RoomEvent>({
    path: `/api/rooms/${config.roomId}/message`,
    body: { ...roomBody(config, setup, history), message: message.text, message_id: message.id, mode },
    eventTypes: EVENT_TYPES,
    finalEvents: FINAL_EVENTS,
    onEvent,
    signal,
    messages: {
      unreachable: UNREACHABLE,
      slowStart: "The room took too long to answer. Please try again.",
      lost: "Lost the connection to the room. Please try again.",
      stalled: "The room went quiet and the connection timed out. Please try again.",
      closedEarly: "The connection closed before everyone finished replying. Please try again.",
      http: (status, detail) => httpMessage(status, detail, "message"),
    },
  });
}

/** Checks the summary JSON has the shape this room's card expects. */
function isValidSummary(type: SummaryItem["type"], data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  if (type === "poll") {
    const poll = data as Poll;
    return typeof poll.question === "string" && Array.isArray(poll.options) && Array.isArray(poll.votes);
  }
  if (type === "notes") {
    const notes = data as StudyNotes;
    return Array.isArray(notes.key_points) && Array.isArray(notes.quiz) && Array.isArray(notes.next_topics);
  }
  if (type === "letters") {
    const result = data as FutureLetters;
    return Array.isArray(result.letters) && Array.isArray(result.paths) && Array.isArray(result.next_steps);
  }
  if (type === "interview") {
    const result = data as InterviewResult;
    return typeof result.decision === "string" && Array.isArray(result.verdicts) && Array.isArray(result.competencies);
  }
  if (type === "scorecard") {
    const card = data as Scorecard;
    return typeof card.overall === "number" && Array.isArray(card.scores) && Array.isArray(card.fixes);
  }
  const offers = data as Offers;
  return typeof offers.summary === "string" && Array.isArray(offers.decisions) && Array.isArray(offers.strengths);
}

export async function fetchRoomSummary(
  config: RoomChatConfig,
  setup: RoomSetup,
  items: ChatItem[],
  signal: AbortSignal,
): Promise<SummaryItem["data"]> {
  // Abort on the caller's signal, or after 90 seconds so the button never spins forever.
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort);
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, SUMMARY_TIMEOUT_MS);
  const tooSlow = "That took too long. Please try again.";

  try {
    let response: Response;
    try {
      response = await fetch(`${API_URL}/api/rooms/${config.roomId}/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(roomBody(config, setup, items)),
        signal: controller.signal,
      });
    } catch (err) {
      if (signal.aborted) throw err;
      throw new StreamError(timedOut ? tooSlow : UNREACHABLE);
    }
    if (!response.ok) throw new StreamError(httpMessage(response.status, await readDetail(response), "summary"));

    try {
      const data = await response.json();
      if (!isValidSummary(config.summary.type, data)) throw new Error("unexpected summary shape");
      return data;
    } catch (err) {
      if (signal.aborted) throw err;
      throw new StreamError(timedOut ? tooSlow : "The result came back garbled. Please try again.");
    }
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
  }
}
