import { fetch as expoFetch } from 'expo/fetch';

export type SseEvent = { data: string };

export type SseHandle = { close: () => void };

/**
 * Open a minimal SSE-over-fetch consumer. React Native lacks native EventSource,
 * so we use expo/fetch which exposes the raw ReadableStream body. We parse
 * `data: …\n\n` frames and call onEvent for each one. Other SSE features
 * (event:, id:, retry:) are not used by the Tanya stream.
 */
export async function openSse(
  url: string,
  headers: Record<string, string>,
  onEvent: (e: SseEvent) => void,
  onError: (err: unknown) => void
): Promise<SseHandle> {
  const controller = new AbortController();
  let closed = false;

  const handle: SseHandle = {
    close: () => {
      closed = true;
      controller.abort();
    },
  };

  (async () => {
    try {
      const res = await expoFetch(url, { headers, signal: controller.signal });
      if (!res.ok || !res.body) {
        if (!closed) onError(new Error(`sse http ${res.status}`));
        return;
      }
      const reader = (res.body as ReadableStream<Uint8Array>).getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (!closed) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          for (const line of frame.split('\n')) {
            if (line.startsWith('data: ')) onEvent({ data: line.slice(6) });
          }
        }
      }
    } catch (err) {
      if (!closed) onError(err);
    }
  })();

  return handle;
}
