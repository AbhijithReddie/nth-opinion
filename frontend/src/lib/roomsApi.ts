/**
 * Client for the Group Chat room:
 *   POST /api/rooms/group-chat/message  (SSE stream of typing / message / reaction / ... events)
 *   POST /api/rooms/group-chat/summary  (JSON poll)
 * Errors are thrown as StreamError with a friendly message.
 */

import type { Language } from "@/config/friends";
import type { ChatItem, GroupFriend, Poll, RoomEvent } from "./chatTypes";
import { API_URL, readDetail, StreamError, streamSse } from "./sseClient";

const ROOM_PATH = "/api/rooms/group-chat";
/** The backend only looks at the last 40 messages, so there's no point sending more. */
const HISTORY_LIMIT = 40;

const EVENT_TYPES = new Set(["typing", "message", "reaction", "safety", "your_turn", "error"]);
const FINAL_EVENTS = new Set(["your_turn", "error"]);

const UNREACHABLE = "Can't reach the Huddle server. Make sure the backend is running and try again.";

interface RoomContext {
  history: ChatItem[];
  friends: GroupFriend[];
  language: Language;
}

/** The request's history: recent messages only (polls stay in the browser). */
function toHistory(items: ChatItem[]) {
  return items
    .filter((item) => item.kind === "message")
    .slice(-HISTORY_LIMIT)
    .map((m) => ({ id: m.id, sender: m.sender, text: m.text, reply_to: m.replyTo }));
}

function httpMessage(status: number, detail: string | undefined, what: "message" | "vote"): string {
  if (status === 429) return detail ?? "You're sending messages too fast. Take a breather and try again soon.";
  if (status === 422) return detail ?? "Something about that message didn't look right. Please try again.";
  if (status === 503) return detail ?? "The AI is busy right now, please try again in a minute.";
  return what === "vote"
    ? `Couldn't run the vote right now (error ${status}). Please try again.`
    : `The group chat server ran into a problem (error ${status}). Please try again.`;
}

export async function streamGroupMessage(
  message: { id: string; text: string },
  { history, friends, language }: RoomContext,
  onEvent: (event: RoomEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  await streamSse<RoomEvent>({
    path: `${ROOM_PATH}/message`,
    body: { message: message.text, message_id: message.id, history: toHistory(history), friends, language },
    eventTypes: EVENT_TYPES,
    finalEvents: FINAL_EVENTS,
    onEvent,
    signal,
    messages: {
      unreachable: UNREACHABLE,
      slowStart: "The group took too long to answer. Please try again.",
      lost: "Lost the connection to the group. Please try again.",
      stalled: "The group went quiet and the connection timed out. Please try again.",
      closedEarly: "The connection closed before your friends finished replying. Please try again.",
      http: (status, detail) => httpMessage(status, detail, "message"),
    },
  });
}

export async function fetchGroupPoll({ history, friends, language }: RoomContext, signal: AbortSignal): Promise<Poll> {
  // Abort on the caller's signal, or after 90 seconds so the button never spins forever.
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort);
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 90_000);

  try {
    let response: Response;
    try {
      response = await fetch(`${API_URL}${ROOM_PATH}/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history: toHistory(history), friends, language }),
        signal: controller.signal,
      });
    } catch (err) {
      if (signal.aborted) throw err;
      throw new StreamError(timedOut ? "The vote took too long. Please try again." : UNREACHABLE);
    }
    if (!response.ok) throw new StreamError(httpMessage(response.status, await readDetail(response), "vote"));

    try {
      const poll = (await response.json()) as Poll;
      if (!poll?.question || !Array.isArray(poll.options) || !Array.isArray(poll.votes)) throw new Error("bad poll");
      return poll;
    } catch (err) {
      if (signal.aborted) throw err;
      throw new StreamError(timedOut ? "The vote took too long. Please try again." : "The vote came back garbled. Please try again.");
    }
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
  }
}
