import OpenAI from "openai";
import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";
import type { AgentName, AgentEvent } from "@/types";

// ---------------------------------------------------------------------------
// orq.ai Proxy Client -- routes LLM calls through orq.ai for full tracing
// ---------------------------------------------------------------------------
//
// Uses orq.ai's OpenAI-compatible proxy. Every call automatically gets:
//   - Thread view (grouped by session)
//   - Full system prompt visible in dashboard
//   - Token usage, latency, cost tracking
//   - Model routing and fallback
//   - Real-time trace + timeline view

let _proxyClient: OpenAI | null = null;

function getProxyClient(): OpenAI {
  if (!_proxyClient) {
    _proxyClient = new OpenAI({
      apiKey: process.env.ORQ_API_KEY!,
      baseURL: "https://api.orq.ai/v2/proxy",
    });
  }
  return _proxyClient;
}

// Extend OpenAI params with orq.ai's thread/contact fields
type OrqParams = ChatCompletionCreateParamsNonStreaming & {
  orq?: {
    thread?: { id: string; tags?: string[] };
    contact?: { id: string; display_name?: string };
  };
};

// ---------------------------------------------------------------------------
// traceAgentCall -- runs an LLM call through orq.ai proxy with thread grouping
// ---------------------------------------------------------------------------

export interface TraceAgentCallOptions {
  agent: AgentName;
  sessionId: string;
  model?: string;
  systemPrompt: string;
  userMessage: string;
  metadata?: Record<string, string>;
  contactId?: string;
}

/**
 * Runs an LLM call through orq.ai's proxy for full observability.
 * Every call in the same sessionId appears in the same thread in the dashboard.
 *
 * You'll see in orq.ai:
 *   - System prompt (full text)
 *   - User message
 *   - Assistant response
 *   - Token usage (input/output/total)
 *   - Model used
 *   - Latency
 *   - Thread grouping (all agents in one session)
 *   - Tags per agent
 */
export async function traceAgentCall(options: TraceAgentCallOptions): Promise<{
  content: string | null;
  latencyMs: number;
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
  event: AgentEvent;
}> {
  const client = getProxyClient();
  const startTime = Date.now();

  const params: OrqParams = {
    model: options.model ?? "openai/gpt-4o-mini",
    messages: [
      { role: "system", content: options.systemPrompt },
      { role: "user", content: options.userMessage },
    ],
    orq: {
      thread: {
        id: options.sessionId,
        tags: ["grocery-orchestrator", options.agent],
      },
      ...(options.contactId
        ? { contact: { id: options.contactId, display_name: "Hackaway User" } }
        : {}),
    },
  };

  const completion = await client.chat.completions.create(
    params as ChatCompletionCreateParamsNonStreaming
  );

  const latencyMs = Date.now() - startTime;
  const content = completion.choices?.[0]?.message?.content ?? null;
  const usage = {
    inputTokens: completion.usage?.prompt_tokens ?? 0,
    outputTokens: completion.usage?.completion_tokens ?? 0,
    totalTokens: completion.usage?.total_tokens ?? 0,
  };

  const event: AgentEvent = {
    agent: options.agent,
    action: "SUGGEST",
    message: `${options.agent} completed in ${latencyMs}ms (${usage.totalTokens} tokens)`,
    timestamp: Date.now(),
    details: { latencyMs, ...usage },
  };

  return { content, latencyMs, usage, event };
}

// ---------------------------------------------------------------------------
// traceAgentCallJSON -- same as traceAgentCall but parses JSON response
// ---------------------------------------------------------------------------

/**
 * Convenience wrapper: calls the proxy and parses the response as JSON.
 * Use for agents that return structured output (order-analyst, meal-planner, etc.)
 */
export async function traceAgentCallJSON<T>(
  options: TraceAgentCallOptions
): Promise<{
  result: T;
  latencyMs: number;
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
  event: AgentEvent;
}> {
  const client = getProxyClient();
  const startTime = Date.now();

  const params: OrqParams = {
    model: options.model ?? "openai/gpt-4o-mini",
    messages: [
      { role: "system", content: options.systemPrompt },
      { role: "user", content: options.userMessage },
    ],
    response_format: { type: "json_object" },
    orq: {
      thread: {
        id: options.sessionId,
        tags: ["grocery-orchestrator", options.agent],
      },
    },
  };

  const completion = await client.chat.completions.create(
    params as ChatCompletionCreateParamsNonStreaming
  );

  const latencyMs = Date.now() - startTime;
  const raw = completion.choices?.[0]?.message?.content ?? "{}";
  const result = JSON.parse(raw) as T;
  const usage = {
    inputTokens: completion.usage?.prompt_tokens ?? 0,
    outputTokens: completion.usage?.completion_tokens ?? 0,
    totalTokens: completion.usage?.total_tokens ?? 0,
  };

  const event: AgentEvent = {
    agent: options.agent,
    action: "SUGGEST",
    message: `${options.agent} completed in ${latencyMs}ms (${usage.totalTokens} tokens)`,
    timestamp: Date.now(),
    details: { latencyMs, ...usage },
  };

  return { result, latencyMs, usage, event };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function createSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
