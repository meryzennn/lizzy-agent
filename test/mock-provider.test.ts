import { expect, test } from "bun:test";
import { connect } from "node:net";
import { startMockProvider } from "./helpers/mock-provider";

const protocols = [
  { path: "/v1/chat/completions", protocol: "openai" },
  { path: "/v1/messages", protocol: "anthropic" },
];
const fixture = (name: string) =>
  Bun.file(new URL(`./fixtures/providers/${name}`, import.meta.url));
const headers = {
  "content-type": "application/json",
  authorization: "Bearer FAKE_KEY_FOR_TEST_ONLY",
  "x-api-key": "FAKE_KEY_FOR_TEST_ONLY",
  "anthropic-version": "2023-06-01",
};

test.each(
  protocols.flatMap((provider) =>
    [false, true].map((stream) => ({ ...provider, stream })),
  ),
)(
  "$protocol stream=$stream delivers fixture bytes and captures the request",
  async ({ path, protocol, stream }) => {
    const mock = startMockProvider();
    try {
      expect(mock.url).toBeInstanceOf(URL);
      expect(mock.url.protocol).toBe("http:");
      expect(mock.url.hostname).toBe("127.0.0.1");
      expect(Number(mock.url.port)).toBeGreaterThan(0);
      const body = {
        model: "fake-model",
        messages: [{ role: "user", content: "Say hello 🌍" }],
        max_tokens: 16,
        stream,
        ...(protocol === "openai" && stream
          ? { stream_options: { include_usage: true } }
          : {}),
      };
      const response = await fetch(new URL(path, mock.url), {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe(
        `${stream ? "text/event-stream" : "application/json"}; charset=utf-8`,
      );
      const bytes = new Uint8Array(await response.arrayBuffer());
      expect(bytes).toEqual(
        await fixture(`${protocol}.${stream ? "sse" : "json"}`).bytes(),
      );
      expect(new TextDecoder("utf-8", { fatal: true }).decode(bytes)).toContain(
        "🌍",
      );
      expect(mock.requests).toEqual([{ path, body }]);
    } finally {
      await mock.stop();
    }
  },
);

test.each(protocols)(
  "$protocol selects JSON unless stream is exactly true",
  async ({ path, protocol }) => {
    const mock = startMockProvider();
    try {
      const bodies = [undefined, false, null, "true", 1, {}, []].map(
        (stream) => (stream === undefined ? {} : { stream }),
      );
      for (const body of bodies) {
        const response = await fetch(new URL(path, mock.url), {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });
        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toContain(
          "application/json",
        );
        expect(await response.text()).toBe(
          await fixture(`${protocol}.json`).text(),
        );
      }
      expect(mock.requests).toEqual(bodies.map((body) => ({ path, body })));
    } finally {
      await mock.stop();
    }
  },
);

test.each([
  { method: "GET", path: "/v1/chat/completions" },
  { method: "GET", path: "/v1/messages" },
  { method: "PUT", path: "/v1/chat/completions" },
  { method: "DELETE", path: "/v1/messages" },
  { method: "POST", path: "/unknown" },
  { method: "POST", path: "/v1/models" },
  { method: "POST", path: "/v1/messages/" },
  { method: "POST", path: "/v1/chat/completions/extra" },
])(
  "$method $path returns 404 without capturing or parsing the body",
  async ({ method, path }) => {
    const mock = startMockProvider();
    try {
      const response = await fetch(new URL(path, mock.url), {
        method,
        headers,
        ...(method === "GET" ? {} : { body: "{" }),
      });
      expect(response.status).toBe(404);
      await response.text();
      expect(mock.requests).toEqual([]);
    } finally {
      await mock.stop();
    }
  },
);

test.each(protocols)(
  "$protocol rejects malformed and non-object JSON and remains usable",
  async ({ path }) => {
    const mock = startMockProvider();
    try {
      for (const body of [
        "",
        "{",
        '{"stream":true,}',
        "[]",
        "null",
        '"text"',
        "0",
        "true",
        "false",
      ]) {
        const response = await fetch(new URL(path, mock.url), {
          method: "POST",
          headers,
          body,
        });
        expect(response.status).toBe(400);
        await response.text();
        expect(mock.requests).toEqual([]);
      }
      const response = await fetch(new URL(path, mock.url), {
        method: "POST",
        headers,
        body: "{}",
      });
      expect(response.status).toBe(200);
      await response.text();
      expect(mock.requests).toEqual([{ path, body: {} }]);
    } finally {
      await mock.stop();
    }
  },
);

test("instances isolate ports, captures and shutdown", async () => {
  const first = startMockProvider();
  try {
    const second = startMockProvider();
    try {
      expect(first.url.href).not.toBe(second.url.href);
      expect(first.requests).not.toBe(second.requests);
      const response = await fetch(new URL("/v1/chat/completions", first.url), {
        method: "POST",
        headers,
        body: '{"model":"fake-first"}',
      });
      expect(response.status).toBe(200);
      await response.text();
      expect(second.requests).toEqual([]);
      await first.stop();
      await expect(fetch(new URL("/v1/messages", first.url))).rejects.toThrow();
      const surviving = await fetch(new URL("/v1/messages", second.url), {
        method: "POST",
        headers,
        body: '{"model":"fake-second"}',
      });
      expect(surviving.status).toBe(200);
      await surviving.text();
      expect(first.requests).toEqual([
        { path: "/v1/chat/completions", body: { model: "fake-first" } },
      ]);
      expect(second.requests).toEqual([
        { path: "/v1/messages", body: { model: "fake-second" } },
      ]);
    } finally {
      await second.stop();
    }
  } finally {
    await first.stop();
  }
});

test("stop closes an active connection with an unfinished HTTP request", async () => {
  const mock = startMockProvider();
  const socket = connect({
    host: mock.url.hostname,
    port: Number(mock.url.port),
  });
  try {
    await new Promise<void>((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("error", reject);
    });
    const closed = new Promise<void>((resolve) =>
      socket.once("close", () => resolve()),
    );
    // Keep a request in flight so shutdown must close connections as well as the listener.
    socket.write(
      "POST /v1/messages HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\nContent-Length: 32\r\n\r\n{",
    );
    await mock.stop();
    await closed;
    expect(socket.destroyed).toBe(true);
    expect(mock.requests).toEqual([]);
    await expect(fetch(new URL("/v1/messages", mock.url))).rejects.toThrow();
  } finally {
    socket.destroy();
    await mock.stop();
  }
});

test("OpenAI fixtures form a completion with deltas, finish reason, usage and DONE", async () => {
  const completion = await fixture("openai.json").json();
  expect(completion).toEqual({
    id: "chatcmpl-fake",
    object: "chat.completion",
    created: 0,
    model: "fake-model",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: "Hello 🌍" },
        logprobs: null,
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 4, completion_tokens: 3, total_tokens: 7 },
  });
  const source = await fixture("openai.sse").text();
  expect(source.endsWith("\n\n")).toBe(true);
  const frames = source.slice(0, -2).split("\n\n");
  expect(frames.pop()).toBe("data: [DONE]");
  const chunks = frames.map((frame) => {
    expect(frame.startsWith("data: ")).toBe(true);
    return JSON.parse(frame.slice(6));
  });
  for (const chunk of chunks) {
    expect(chunk).toMatchObject({
      id: completion.id,
      object: "chat.completion.chunk",
      created: 0,
      model: completion.model,
    });
  }
  const choices = chunks.slice(0, -1).map((chunk) => chunk.choices[0]);
  expect(choices.map((choice) => choice.index)).toEqual([0, 0, 0]);
  expect(choices.map((choice) => choice.finish_reason)).toEqual([
    null,
    null,
    "stop",
  ]);
  expect(choices.map((choice) => choice.logprobs)).toEqual([null, null, null]);
  expect(choices[0].delta.role).toBe("assistant");
  expect(choices.map((choice) => choice.delta.content ?? "").join("")).toBe(
    completion.choices[0].message.content,
  );
  expect(choices[2].delta).toEqual({});
  expect(chunks.slice(0, -1).map((chunk) => chunk.usage)).toEqual([
    null,
    null,
    null,
  ]);
  expect(chunks.at(-1)).toMatchObject({ choices: [], usage: completion.usage });
});

test("Anthropic fixtures form a message with matched block events and cumulative usage", async () => {
  const message = await fixture("anthropic.json").json();
  expect(message).toEqual({
    id: "msg_fake",
    type: "message",
    role: "assistant",
    model: "fake-model",
    content: [{ type: "text", text: "Hello 🌍" }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 4, output_tokens: 3 },
  });
  const source = await fixture("anthropic.sse").text();
  expect(source.endsWith("\n\n")).toBe(true);
  const events = source
    .slice(0, -2)
    .split("\n\n")
    .map((frame) => {
      const [event, data] = frame.split("\n");
      expect(data.startsWith("data: ")).toBe(true);
      const payload = JSON.parse(data.slice(6));
      expect(event).toBe(`event: ${payload.type}`);
      return payload;
    });
  expect(events.map((event) => event.type)).toEqual([
    "message_start",
    "content_block_start",
    "content_block_delta",
    "content_block_stop",
    "message_delta",
    "message_stop",
  ]);
  expect(events[0].message).toEqual({
    ...message,
    content: [],
    stop_reason: null,
    usage: { input_tokens: 4, output_tokens: 0 },
  });
  expect(events.slice(1, 4).map((event) => event.index)).toEqual([0, 0, 0]);
  expect(events[1].content_block).toEqual({ type: "text", text: "" });
  expect(events[2].delta).toEqual({
    type: "text_delta",
    text: message.content[0].text,
  });
  expect(events[4].delta).toEqual({
    stop_reason: message.stop_reason,
    stop_sequence: null,
  });
  expect(events[4].usage).toEqual({
    output_tokens: message.usage.output_tokens,
  });
  expect(events[5]).toEqual({ type: "message_stop" });
});
