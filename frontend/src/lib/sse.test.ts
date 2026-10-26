import { describe, expect, it } from "vitest";
import { SseParser } from "./sse";

/** Feed chunks in order and collect every event. */
function parse(chunks: string[]) {
  const parser = new SseParser();
  const events = chunks.flatMap((chunk) => parser.push(chunk));
  return [...events, ...parser.flush()];
}

describe("SseParser", () => {
  it("parses whole events", () => {
    expect(parse(['event: typing\ndata: {"friend_id":"rohit"}\n\n'])).toEqual([{ event: "typing", data: '{"friend_id":"rohit"}' }]);
  });

  it("handles sse-starlette's \\r\\n line endings", () => {
    expect(parse(["event: done\r\ndata: {}\r\n\r\n"])).toEqual([{ event: "done", data: "{}" }]);
  });

  it("reassembles an event split across chunks anywhere", () => {
    const full = 'event: message\r\ndata: {"text":"hello"}\r\n\r\n';
    for (let cut = 1; cut < full.length; cut++) {
      expect(parse([full.slice(0, cut), full.slice(cut)])).toEqual([{ event: "message", data: '{"text":"hello"}' }]);
    }
  });

  it("splits \\r and \\n across chunks without inventing a blank line", () => {
    expect(parse(["event: a\r", "\ndata: 1\r", "\n\r", "\n"])).toEqual([{ event: "a", data: "1" }]);
  });

  it("reads several events from one chunk and keeps the unfinished one", () => {
    const parser = new SseParser();
    expect(parser.push("event: a\ndata: 1\n\nevent: b\ndata: 2\n\nevent: c\nda")).toHaveLength(2);
    expect(parser.push("ta: 3\n\n")).toEqual([{ event: "c", data: "3" }]);
  });

  it("ignores keep-alive comments and joins multi-line data", () => {
    expect(parse([": ping\n\n", "event: x\ndata: line1\ndata: line2\n\n"])).toEqual([{ event: "x", data: "line1\nline2" }]);
  });

  it("defaults the event name to message and drops events without data", () => {
    expect(parse(["data: hi\n\n", "event: empty\n\n"])).toEqual([{ event: "message", data: "hi" }]);
  });

  it("flushes a last event that had no trailing blank line", () => {
    expect(parse(["event: done\ndata: {}"])).toEqual([{ event: "done", data: "{}" }]);
  });
});
