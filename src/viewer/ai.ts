import type { DocsAiConfig } from "../types";

const AI_KEY_STORAGE_KEY = "docs-viewer-ai-key";

const DEFAULT_MODELS = {
  openai: "gpt-4o",
  anthropic: "claude-haiku-4-5-20251001",
} as const;

const SYSTEM_PROMPT = `You are a helpful assistant that answers questions about technical documentation.
Answer concisely and accurately based only on the documentation context provided.
Use markdown formatting in your responses — bold for emphasis, code blocks for code, lists where appropriate.
If the answer isn't in the documentation, say so clearly.
When your answer references a specific doc section, cite it inline using a markdown link with the exact path from the available doc links list. Example: see the [Auth API](api-reference/auth) section. Embed citations naturally in your prose.`;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function detectProvider(key: string): "openai" | "anthropic" | null {
  if (key.startsWith("sk-ant-")) return "anthropic";
  if (key.startsWith("sk-")) return "openai";
  return null;
}

export function getStoredApiKey(): string | null {
  try {
    return localStorage.getItem(AI_KEY_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeApiKey(key: string) {
  localStorage.setItem(AI_KEY_STORAGE_KEY, key);
}

export function removeStoredApiKey() {
  localStorage.removeItem(AI_KEY_STORAGE_KEY);
}

export function resolveAiConfig(ai: true | DocsAiConfig): DocsAiConfig {
  return ai === true ? {} : ai;
}

export function resolveApiKey(config: DocsAiConfig): string | null {
  return config.key ?? getStoredApiKey();
}

export function resolveProvider(
  config: DocsAiConfig,
  key: string
): "openai" | "anthropic" | null {
  return config.provider ?? detectProvider(key);
}


export async function* streamAiAnswer(
  ai: true | DocsAiConfig,
  messages: ChatMessage[],
  context: string,
  signal?: AbortSignal
): AsyncIterable<string> {
  const config = resolveAiConfig(ai);

  if (config.ask) {
    yield* config.ask(messages, context);
    return;
  }

  const key = resolveApiKey(config);
  if (!key) throw new Error("No API key available");

  const provider = resolveProvider(config, key);
  if (!provider)
    throw new Error(
      "Could not detect provider from API key prefix. Please check your key."
    );

  const model = config.model ?? DEFAULT_MODELS[provider];

  if (provider === "openai") {
    yield* streamOpenAI(key, model, messages, context, signal);
  } else {
    yield* streamAnthropic(key, model, messages, context, signal);
  }
}

async function* streamOpenAI(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  context: string,
  signal?: AbortSignal
): AsyncIterable<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal,
    body: JSON.stringify({
      model,
      stream: true,
      messages: [
        {
          role: "system",
          content: `${SYSTEM_PROMPT}\n\nDocumentation:\n${context}`,
        },
        ...messages,
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as any)?.error?.message ?? `OpenAI error ${res.status}`
    );
  }

  yield* parseSSE(res, (data) => {
    if (data === "[DONE]") return null;
    const parsed = JSON.parse(data);
    return parsed.choices?.[0]?.delta?.content ?? null;
  });
}

async function* streamAnthropic(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  context: string,
  signal?: AbortSignal
): AsyncIterable<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    signal,
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      stream: true,
      system: `${SYSTEM_PROMPT}\n\nDocumentation:\n${context}`,
      messages,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as any)?.error?.message ?? `Anthropic error ${res.status}`
    );
  }

  yield* parseSSE(res, (data) => {
    const parsed = JSON.parse(data);
    if (parsed.type === "content_block_delta") {
      return parsed.delta?.text ?? null;
    }
    return null;
  });
}

async function* parseSSE(
  res: Response,
  extract: (data: string) => string | null
): AsyncIterable<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (!data) continue;
      try {
        const chunk = extract(data);
        if (chunk) yield chunk;
      } catch {
        // skip malformed lines
      }
    }
  }
}
