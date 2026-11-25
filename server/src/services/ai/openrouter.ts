import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/errors.js";

// Calls the learner's own AI provider (OpenRouter, Gemini or Anthropic) with
// their own key. Every failure becomes an AiError with a stable code and a
// message written for the learner. Messages never include the key, the
// request body or the provider's raw reply, and no error carries a `cause`,
// so nothing secret can reach a response or a log.

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
export const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
export const DEFAULT_INTERVIEW_MODEL = "google/gemini-2.5-flash";
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
export const DEFAULT_ANTHROPIC_MODEL = "claude-haiku-5-5";
export type AiProviderName = "OPENROUTER" | "GEMINI" | "ANTHROPIC";

export function defaultInterviewModel(provider: AiProviderName = "OPENROUTER"): string {
  if (provider === "GEMINI") return DEFAULT_GEMINI_MODEL;
  if (provider === "ANTHROPIC") return DEFAULT_ANTHROPIC_MODEL;
  return env.OPENROUTER_INTERVIEW_MODEL ?? DEFAULT_INTERVIEW_MODEL;
}

export type AiErrorCode =
  | "AI_NOT_CONFIGURED"
  | "AI_KEY_REQUIRED"
  | "AI_KEY_INVALID"
  | "AI_OUT_OF_CREDIT"
  | "AI_RATE_LIMITED"
  | "AI_PROVIDER_TIMEOUT"
  | "AI_PROVIDER_ERROR"
  | "AI_MODEL_UNAVAILABLE"
  | "AI_BAD_OUTPUT";

const AI_ERRORS: Record<AiErrorCode, { status: number; message: string }> = {
  AI_NOT_CONFIGURED: { status: 503, message: "AI interviews are not set up on this server." },
  AI_KEY_REQUIRED: { status: 409, message: "Add your AI provider key in settings to start an AI interview." },
  AI_KEY_INVALID: { status: 422, message: "Your AI provider did not accept this key. Check that you copied the whole key, or create a new one." },
  AI_OUT_OF_CREDIT: { status: 402, message: "Your AI provider key is out of credit. Add credit with your provider or pick a free model." },
  AI_RATE_LIMITED: { status: 429, message: "Your AI provider is rate limiting the key. Wait a minute and try again." },
  AI_PROVIDER_TIMEOUT: { status: 504, message: "Your AI provider took too long to answer. Please try again." },
  AI_PROVIDER_ERROR: { status: 502, message: "Your AI provider could not answer right now. Please try again in a moment." },
  AI_MODEL_UNAVAILABLE: { status: 422, message: "Your AI provider could not use the chosen model. Check the model id in settings." },
  AI_BAD_OUTPUT: { status: 502, message: "The interviewer sent a reply we could not use. Please try again." },
};

export class AiError extends AppError {
  constructor(code: AiErrorCode, message = AI_ERRORS[code].message) {
    super(message, AI_ERRORS[code].status, code);
  }
}

type FetchImpl = typeof fetch;

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ChatRequest = {
  provider?: AiProviderName;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  maxTokens: number;
  temperature?: number;
  responseFormat?: { type: "json_schema"; json_schema: unknown };
  timeoutMs?: number;
  fetchImpl?: FetchImpl;
  /** Token counts for the call, when the provider reports them (Anthropic only for now). */
  onUsage?: (usage: { inputTokens: number; outputTokens: number }) => void;
};

const chatResponseSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })).min(1),
});

const keyResponseSchema = z.object({
  data: z.object({
    limit_remaining: z.number().nullable().optional(),
    is_free_tier: z.boolean().optional(),
  }),
});

function headers(apiKey: string, provider: AiProviderName): Record<string, string> {
  const common = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (provider === "GEMINI") return common;
  return {
    ...common,
    "HTTP-Referer": env.APP_URL,
    "X-OpenRouter-Title": "buildment",
  };
}

/** Map an HTTP status from OpenRouter onto one of our codes. */
export function errorForStatus(status: number): AiError {
  if (status === 401 || status === 403) return new AiError("AI_KEY_INVALID");
  if (status === 402) return new AiError("AI_OUT_OF_CREDIT");
  if (status === 429) return new AiError("AI_RATE_LIMITED");
  if (status === 400 || status === 404) return new AiError("AI_MODEL_UNAVAILABLE");
  if (status === 408 || status === 504) return new AiError("AI_PROVIDER_TIMEOUT");
  return new AiError("AI_PROVIDER_ERROR");
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

async function send(fetchImpl: FetchImpl, url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  try {
    return await fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    if (isTimeout(error)) throw new AiError("AI_PROVIDER_TIMEOUT");
    throw new AiError("AI_PROVIDER_ERROR");
  }
}

const RETRYABLE: ReadonlySet<AiErrorCode> = new Set(["AI_PROVIDER_TIMEOUT", "AI_PROVIDER_ERROR"]);

// ---- Anthropic (Claude) ----------------------------------------------------------

function anthropicClient(apiKey: string, options: { fetchImpl?: FetchImpl; timeoutMs: number }): Anthropic {
  // Retries are ours (see createChatCompletion), so the SDK makes one attempt.
  return new Anthropic({ apiKey, maxRetries: 0, timeout: options.timeoutMs, ...(options.fetchImpl ? { fetch: options.fetchImpl } : {}) });
}

/** Map an Anthropic SDK error onto one of our codes, without keeping the original. */
export function errorForAnthropic(error: unknown): AiError {
  if (error instanceof Anthropic.APIConnectionTimeoutError) return new AiError("AI_PROVIDER_TIMEOUT");
  if (error instanceof Anthropic.APIConnectionError) return new AiError("AI_PROVIDER_ERROR");
  if (error instanceof Anthropic.APIError && typeof error.status === "number") {
    // A key with no balance left comes back as a 400 that names the credit balance.
    if (error.status === 400 && /credit balance/i.test(error.message)) return new AiError("AI_OUT_OF_CREDIT");
    return errorForStatus(error.status);
  }
  return new AiError("AI_PROVIDER_ERROR");
}

// Structured outputs accept a subset of JSON Schema: no numeric or length bounds,
// no maxItems. Callers still validate the reply with their own zod schema.
const UNSUPPORTED_SCHEMA_KEYS = new Set(["maxItems", "minimum", "maximum", "minLength", "maxLength", "exclusiveMinimum", "exclusiveMaximum"]);

export function toAnthropicSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toAnthropicSchema);
  if (!schema || typeof schema !== "object") return schema;
  return Object.fromEntries(
    Object.entries(schema as Record<string, unknown>)
      .filter(([key]) => !UNSUPPORTED_SCHEMA_KEYS.has(key))
      .map(([key, value]) => [key, toAnthropicSchema(value)])
  );
}

async function anthropicCompletion(request: ChatRequest): Promise<string> {
  const client = anthropicClient(request.apiKey, { fetchImpl: request.fetchImpl, timeoutMs: request.timeoutMs ?? 30_000 });
  const system = request.messages.filter((message) => message.role === "system").map((message) => message.content).join("\n\n");
  const turns = request.messages.flatMap((message) =>
    message.role === "system" ? [] : [{ role: message.role, content: message.content } as Anthropic.MessageParam]
  );
  const jsonSchema = (request.responseFormat?.json_schema as { schema?: unknown } | undefined)?.schema;

  let message: Anthropic.Message;
  try {
    message = await client.messages.create({
      model: request.model,
      // Thinking tokens count toward max_tokens on current Claude models, so leave room.
      max_tokens: Math.max(request.maxTokens, 4096),
      ...(system ? { system } : {}),
      messages: turns,
      output_config: {
        effort: "low",
        ...(jsonSchema ? { format: { type: "json_schema" as const, schema: toAnthropicSchema(jsonSchema) as Record<string, unknown> } } : {}),
      },
    });
  } catch (error) {
    throw errorForAnthropic(error);
  }
  request.onUsage?.({ inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens });
  if (message.stop_reason === "refusal") throw new AiError("AI_BAD_OUTPUT");
  const content = message.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("").trim();
  if (!content) throw new AiError("AI_PROVIDER_ERROR");
  return content;
}

/** Validate an Anthropic key with GET /v1/models, which costs nothing and sends no learner content. */
export async function checkAnthropicKey(apiKey: string, options: { fetchImpl?: FetchImpl; timeoutMs?: number } = {}): Promise<void> {
  try {
    await anthropicClient(apiKey, { fetchImpl: options.fetchImpl, timeoutMs: options.timeoutMs ?? 10_000 }).models.list({ limit: 1 });
  } catch (error) {
    throw errorForAnthropic(error);
  }
}

/** One chat completion. Timeouts and 5xx answers are retried once; key, credit and rate errors are not. */
export async function createChatCompletion(request: ChatRequest): Promise<string> {
  const fetchImpl = request.fetchImpl ?? fetch;
  const provider = request.provider ?? "OPENROUTER";
  if (provider === "ANTHROPIC") return withRetry(() => anthropicCompletion(request));
  const body = JSON.stringify({
    model: request.model,
    messages: request.messages,
    max_tokens: request.maxTokens,
    temperature: request.temperature ?? 0.4,
    ...(request.responseFormat
      ? { response_format: request.responseFormat, ...(provider === "OPENROUTER" ? { provider: { require_parameters: true } } : {}) }
      : {}),
  });

  return withRetry(async () => {
    const response = await send(
      fetchImpl,
      `${provider === "GEMINI" ? GEMINI_BASE_URL : OPENROUTER_BASE_URL}/chat/completions`,
      { method: "POST", headers: headers(request.apiKey, provider), body },
      request.timeoutMs ?? 30_000
    );
    if (!response.ok) throw errorForStatus(response.status);
    const parsed = chatResponseSchema.safeParse(await response.json().catch(() => null));
    const content = parsed.success ? parsed.data.choices[0]!.message.content?.trim() : "";
    if (!content) throw new AiError("AI_PROVIDER_ERROR");
    return content;
  });
}

/** Two attempts at most: only timeouts and provider errors are retried. */
async function withRetry(attemptOnce: () => Promise<string>): Promise<string> {
  let lastError: AiError = new AiError("AI_PROVIDER_ERROR");
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await attemptOnce();
    } catch (error) {
      if (!(error instanceof AiError)) throw new AiError("AI_PROVIDER_ERROR");
      lastError = error;
      if (!RETRYABLE.has(error.code as AiErrorCode)) throw error;
    }
  }
  throw lastError;
}

/**
 * One cheap request that checks a key without spending credit:
 * GET /api/v1/key returns the key's usage and limits.
 */
export async function checkOpenRouterKey(
  apiKey: string,
  options: { fetchImpl?: FetchImpl; timeoutMs?: number } = {}
): Promise<{ limitRemaining: number | null; isFreeTier: boolean }> {
  const response = await send(
    options.fetchImpl ?? fetch,
    `${OPENROUTER_BASE_URL}/key`,
    { method: "GET", headers: headers(apiKey, "OPENROUTER") },
    options.timeoutMs ?? 10_000
  );
  if (!response.ok) throw errorForStatus(response.status);
  const parsed = keyResponseSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw new AiError("AI_PROVIDER_ERROR");
  const limitRemaining = parsed.data.data.limit_remaining ?? null;
  if (limitRemaining !== null && limitRemaining <= 0) throw new AiError("AI_OUT_OF_CREDIT");
  return { limitRemaining, isFreeTier: parsed.data.data.is_free_tier ?? false };
}

/** Validate a Gemini API key without sending learner content. */
export async function checkGeminiKey(
  apiKey: string,
  options: { fetchImpl?: FetchImpl; timeoutMs?: number } = {}
): Promise<void> {
  const response = await send(
    options.fetchImpl ?? fetch,
    "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1",
    { method: "GET", headers: { "x-goog-api-key": apiKey } },
    options.timeoutMs ?? 10_000
  );
  if (!response.ok) throw errorForStatus(response.status);
}
