import { trace, type Span, type Tracer } from "@opentelemetry/api";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import type { AgentName, AgentEvent } from "@/types";

// ---------------------------------------------------------------------------
// OTEL Provider -- sends traces to orq.ai's OTEL endpoint
// ---------------------------------------------------------------------------

let _initialized = false;
let _tracer: Tracer;

function ensureInitialized(): Tracer {
  if (!_initialized) {
    const exporter = new OTLPTraceExporter({
      url: "https://api.orq.ai/v2/otel/v1/traces",
      headers: {
        Authorization: `Bearer ${process.env.ORQ_API_KEY}`,
      },
    });

    const provider = new NodeTracerProvider({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: "grocery-orchestrator",
        [ATTR_SERVICE_VERSION]: "1.0.0",
      }),
      spanProcessors: [new BatchSpanProcessor(exporter)],
    });

    provider.register();

    _tracer = trace.getTracer("grocery-orchestrator");
    _initialized = true;
  }
  return _tracer;
}

// ---------------------------------------------------------------------------
// traceAgentCall -- wraps any agent function with a full OTEL span
// ---------------------------------------------------------------------------

/**
 * Wraps a Vercel AI SDK agent call with OpenTelemetry tracing that reports
 * to orq.ai. Every field is visible in the orq dashboard:
 *
 * - System prompt (full text)
 * - User message / inputs
 * - Agent output (full JSON)
 * - Model used (e.g. gpt-4o-mini)
 * - Provider (openai / anthropic)
 * - Latency
 * - Token usage (if available from Vercel AI SDK response)
 * - Session/thread grouping
 * - Error status
 *
 * Usage:
 *   const result = await traceAgentCall({
 *     agent: "order-analyst",
 *     sessionId,
 *     model: "gpt-4o-mini",
 *     provider: "openai",
 *     systemPrompt: buildOrderAnalystPrompt(analysis, data),
 *     userMessage: "Analyze order history",
 *     fn: async () => {
 *       const { object } = await generateObject({ ... });
 *       return object;
 *     },
 *     // Optional: pass token usage after the call
 *     getUsage: (result) => ({ inputTokens: 1200, outputTokens: 350 }),
 *   });
 */
export interface TraceAgentCallOptions<T> {
  agent: AgentName;
  sessionId: string;
  model: string;
  provider: "openai" | "anthropic";
  systemPrompt: string;
  userMessage: string;
  fn: () => Promise<T>;
  metadata?: Record<string, string>;
  getUsage?: (result: T) => { inputTokens?: number; outputTokens?: number };
}

export async function traceAgentCall<T>(
  options: TraceAgentCallOptions<T>
): Promise<{ result: T; latencyMs: number; event: AgentEvent }> {
  const tracer = ensureInitialized();

  return tracer.startActiveSpan(
    `agent.${options.agent}`,
    async (span: Span) => {
      const startTime = Date.now();

      // GenAI semantic convention attributes
      span.setAttribute("gen_ai.system", options.provider);
      span.setAttribute("gen_ai.request.model", options.model);
      span.setAttribute("gen_ai.request.type", "chat");

      // Agent-specific attributes
      span.setAttribute("agent.name", options.agent);
      span.setAttribute("agent.session_id", options.sessionId);
      span.setAttribute("agent.system_prompt", options.systemPrompt);
      span.setAttribute("agent.user_message", options.userMessage);

      // Custom metadata
      if (options.metadata) {
        for (const [k, v] of Object.entries(options.metadata)) {
          span.setAttribute(`agent.metadata.${k}`, v);
        }
      }

      try {
        const result = await options.fn();
        const latencyMs = Date.now() - startTime;

        // Log output
        span.setAttribute(
          "agent.output",
          typeof result === "string"
            ? result
            : JSON.stringify(result)
        );
        span.setAttribute("agent.latency_ms", latencyMs);

        // Token usage if available
        if (options.getUsage) {
          const usage = options.getUsage(result);
          if (usage.inputTokens) {
            span.setAttribute("gen_ai.usage.input_tokens", usage.inputTokens);
          }
          if (usage.outputTokens) {
            span.setAttribute("gen_ai.usage.output_tokens", usage.outputTokens);
          }
        }

        span.setStatus({ code: 1 }); // OK
        span.end();

        const event: AgentEvent = {
          agent: options.agent,
          action: "SUGGEST",
          message: `${options.agent} completed in ${latencyMs}ms`,
          timestamp: Date.now(),
          details: { latencyMs },
        };

        return { result, latencyMs, event };
      } catch (error) {
        const latencyMs = Date.now() - startTime;
        span.setStatus({
          code: 2, // ERROR
          message: error instanceof Error ? error.message : String(error),
        });
        span.setAttribute("agent.error", String(error));
        span.setAttribute("agent.latency_ms", latencyMs);
        span.end();
        throw error;
      }
    }
  );
}

// ---------------------------------------------------------------------------
// traceToolCall -- traces individual tool/function invocations within agents
// ---------------------------------------------------------------------------

/**
 * Traces a tool call (e.g. Picnic API fetch, analysis computation).
 * Shows up as a child span under the parent agent span in orq.ai.
 */
export async function traceToolCall<T>(options: {
  name: string;
  agent: AgentName;
  fn: () => Promise<T>;
  metadata?: Record<string, string>;
}): Promise<T> {
  const tracer = ensureInitialized();

  return tracer.startActiveSpan(`tool.${options.name}`, async (span: Span) => {
    span.setAttribute("gen_ai.tool.name", options.name);
    span.setAttribute("agent.name", options.agent);

    if (options.metadata) {
      for (const [k, v] of Object.entries(options.metadata)) {
        span.setAttribute(`tool.metadata.${k}`, v);
      }
    }

    try {
      const result = await options.fn();
      span.setStatus({ code: 1 });
      span.end();
      return result;
    } catch (error) {
      span.setStatus({
        code: 2,
        message: error instanceof Error ? error.message : String(error),
      });
      span.end();
      throw error;
    }
  });
}

// ---------------------------------------------------------------------------
// traceOrchestration -- top-level span for the entire pipeline
// ---------------------------------------------------------------------------

/**
 * Wraps the full orchestration pipeline (all 5 agents) in a single parent span.
 * In orq.ai this becomes the root trace, with each agent as a child span.
 *
 * Usage in the orchestration route:
 *   const result = await traceOrchestration(sessionId, userInput, async () => {
 *     // ... run all agents ...
 *     return cartSummary;
 *   });
 */
export async function traceOrchestration<T>(
  sessionId: string,
  userInput: string,
  fn: () => Promise<T>
): Promise<T> {
  const tracer = ensureInitialized();

  return tracer.startActiveSpan("orchestration.pipeline", async (span: Span) => {
    span.setAttribute("orchestration.session_id", sessionId);
    span.setAttribute("orchestration.user_input", userInput);

    try {
      const result = await fn();
      span.setStatus({ code: 1 });
      span.end();
      return result;
    } catch (error) {
      span.setStatus({
        code: 2,
        message: error instanceof Error ? error.message : String(error),
      });
      span.end();
      throw error;
    }
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function createSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
