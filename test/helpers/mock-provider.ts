// shortcut: fixed synthetic replies, extend fixtures when adapter tests need more scenarios.
export function startMockProvider() {
  const requests: Array<{ path: string; body: unknown }> = [];
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      const protocol =
        path === "/v1/chat/completions"
          ? "openai"
          : path === "/v1/messages"
            ? "anthropic"
            : undefined;
      if (request.method !== "POST" || !protocol) {
        return new Response("Not found", { status: 404 });
      }
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return new Response("Invalid JSON", { status: 400 });
      }
      if (body === null || typeof body !== "object" || Array.isArray(body)) {
        return new Response("Expected object", { status: 400 });
      }
      requests.push({ path, body });
      const streaming = "stream" in body && body.stream === true;
      const bytes = await Bun.file(
        new URL(
          `../fixtures/providers/${protocol}.${streaming ? "sse" : "json"}`,
          import.meta.url,
        ),
      ).bytes();
      const output = streaming
        ? new ReadableStream<Uint8Array>({
            start(controller) {
              for (let offset = 0; offset < bytes.length; offset += 11) {
                controller.enqueue(bytes.slice(offset, offset + 11));
              }
              controller.close();
            },
          })
        : bytes;
      return new Response(output, {
        headers: {
          "content-type": streaming
            ? "text/event-stream; charset=utf-8"
            : "application/json; charset=utf-8",
        },
      });
    },
  });
  return {
    url: server.url,
    requests,
    stop: async () => {
      await server.stop(true);
    },
  };
}
