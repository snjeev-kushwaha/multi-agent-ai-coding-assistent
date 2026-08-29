import { getAccessToken } from "../api/client";
import type { StreamEvent } from "../api/types";

/**
 * Native EventSource can't attach an Authorization header, and we don't want
 * auth tokens sitting in a URL (query params end up in logs/browser history).
 * This reads the same SSE wire format via fetch()'s streaming body instead.
 */
export async function streamJobEvents(
  url: string,
  onEvent: (event: StreamEvent) => void,
  signal: AbortSignal
): Promise<void> {
  const token = getAccessToken();
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`Stream connection failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const dataLine = chunk.split("\n").find((line) => line.startsWith("data: "));
      if (!dataLine) continue; // keepalive comment lines, etc.
      try {
        const parsed = JSON.parse(dataLine.slice("data: ".length));
        onEvent(parsed as StreamEvent);
      } catch {
        // Malformed frame -- ignore rather than crash the whole stream.
      }
    }
  }
}
