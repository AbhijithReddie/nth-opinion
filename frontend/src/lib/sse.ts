/**
 * A tiny Server-Sent Events parser for streams read with fetch().
 *
 * EventSource only supports GET, but /api/debate is a POST, so we read the
 * response body ourselves. Network chunks can end anywhere (mid-line, mid-event,
 * even between the \r and \n of a line break), so text is buffered until a full
 * event (terminated by a blank line) has arrived.
 */

export interface RawSseEvent {
  event: string;
  data: string;
}

export class SseParser {
  private buffer = "";

  /** Feed decoded text in; returns every event completed by this chunk. */
  push(chunk: string): RawSseEvent[] {
    this.buffer += chunk;

    // A trailing \r may be the first half of a \r\n split across chunks,
    // so hold it back until the next chunk shows what follows it.
    let carry = "";
    if (this.buffer.endsWith("\r")) {
      carry = "\r";
      this.buffer = this.buffer.slice(0, -1);
    }
    // sse-starlette uses \r\n line endings; normalise everything to \n.
    this.buffer = this.buffer.replace(/\r\n?/g, "\n");

    const blocks = this.buffer.split("\n\n");
    // The last piece is an unfinished event (or ""), keep it for later.
    this.buffer = (blocks.pop() ?? "") + carry;

    return blocks.map(parseBlock).filter((e): e is RawSseEvent => e !== null);
  }

  /** Call when the stream ends, in case the last event had no trailing blank line. */
  flush(): RawSseEvent[] {
    const rest = this.buffer.replace(/\r\n?/g, "\n").trim();
    this.buffer = "";
    const event = rest ? parseBlock(rest) : null;
    return event ? [event] : [];
  }
}

/** Parse one event block ("event: x\ndata: {...}") into its name and data. */
function parseBlock(block: string): RawSseEvent | null {
  let event = "message";
  const dataLines: string[] = [];

  for (const line of block.split("\n")) {
    if (!line || line.startsWith(":")) continue; // blank line or keep-alive comment (": ping")
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    // Per the SSE spec, a single space after the colon is not part of the value.
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);

    if (field === "event") event = value;
    else if (field === "data") dataLines.push(value);
  }

  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join("\n") };
}
