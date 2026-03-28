import type { AgentName, AgentEvent } from "@/types";
import { getOrqClient } from "./orq-client";

/**
 * Traces an agent step through orq.ai deployments for real-time observability.
 *
 * Each agent in the pipeline gets its own deployment key in orq.ai, allowing:
 * - Real-time trace view (see inputs/outputs/latency per agent)
 * - Thread view (see the full orchestration conversation flow)
 * - Timeline view (see parallel vs sequential execution)
 * - System prompt inspection in the dashboard
 * - Token usage and cost tracking per agent step
 *
 * Usage in the orchestration route:
 *   const result = await traceAgentStep({
 *     agent: "order-analyst",
 *     deploymentKey: "grocery-order-analyst",
 *     systemPrompt: buildOrderAnalystPrompt(analysis, data),
 *     userMessage: "Analyze order history and recommend items",
 *     sessionId,
 *     metadata: { budget: String(intent.budget) },
 *   });
 */
export interface TraceAgentStepOptions {
  agent: AgentName;
  deploymentKey: string;
  systemPrompt: string;
  userMessage: string;
  sessionId: string;
  metadata?: Record<string, string>;
}

export async function traceAgentStep(options: TraceAgentStepOptions) {
  const client = getOrqClient();
  const startTime = Date.now();

  const completion = await client.deployments.invoke({
    key: options.deploymentKey,
    inputs: {
      system_prompt: options.systemPrompt,
      user_message: options.userMessage,
    },
    metadata: {
      agent: options.agent,
      ...options.metadata,
    },
    thread: {
      id: options.sessionId,
      tags: ["grocery-orchestrator", options.agent],
    },
  });

  const latencyMs = Date.now() - startTime;

  const content =
    completion?.choices?.[0]?.message?.type === "content"
      ? completion.choices[0].message.content
      : null;

  return {
    content,
    latencyMs,
    raw: completion,
  };
}

/**
 * Wraps a Vercel AI SDK agent call with orq.ai tracing metadata.
 *
 * Use this when agents run via generateObject/streamText (Vercel AI SDK)
 * but you still want orq.ai to track the execution. This logs the agent
 * step as a deployment invocation for observability without replacing
 * the actual LLM call.
 *
 * Pattern:
 *   const traced = await traceWithOrq({
 *     agent: "meal-planner",
 *     sessionId,
 *     fn: () => mealPlanner(analysis, data, intent),
 *     metadata: { dishes: intent.meals.map(m => m.dish).join(", ") },
 *   });
 */
export async function traceWithOrq<T>(options: {
  agent: AgentName;
  sessionId: string;
  fn: () => Promise<T>;
  metadata?: Record<string, string>;
}): Promise<{ result: T; latencyMs: number; event: AgentEvent }> {
  const startTime = Date.now();

  const result = await options.fn();

  const latencyMs = Date.now() - startTime;

  // Log to orq.ai as a lightweight trace (no LLM call, just metadata)
  const client = getOrqClient();
  try {
    await client.deployments.invoke({
      key: "grocery-trace-log",
      inputs: {
        agent: options.agent,
        latency_ms: String(latencyMs),
        status: "complete",
        result_preview: JSON.stringify(result).slice(0, 500),
      },
      metadata: {
        agent: options.agent,
        latency_ms: String(latencyMs),
        ...options.metadata,
      },
      thread: {
        id: options.sessionId,
        tags: ["grocery-orchestrator", options.agent],
      },
    });
  } catch {
    // Tracing failure should never block the pipeline
    console.warn(`[orq-trace] Failed to log trace for ${options.agent}`);
  }

  const event: AgentEvent = {
    agent: options.agent,
    action: "SUGGEST",
    message: `${options.agent} completed in ${latencyMs}ms`,
    timestamp: Date.now(),
    details: { latencyMs },
  };

  return { result, latencyMs, event };
}

/**
 * Creates a unique session ID for a single orchestration run.
 * Used as the thread ID in orq.ai to group all agent steps together.
 */
export function createSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
