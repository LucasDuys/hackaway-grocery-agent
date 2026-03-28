import { anthropic } from "@ai-sdk/anthropic";
import { createOpenAI, openai } from "@ai-sdk/openai";

// ---------------------------------------------------------------------------
// Provider detection -- check which API keys are available at runtime
// ---------------------------------------------------------------------------

function hasOpenAI(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

function hasOpenRouter(): boolean {
  return !!process.env.OPENROUTER_API_KEY;
}

function hasAnthropic(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

// ---------------------------------------------------------------------------
// OpenRouter provider -- uses createOpenAI with custom baseURL
// This gives proper support for tool mode and structured outputs
// ---------------------------------------------------------------------------

function getOpenRouter() {
  const or = createOpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY!,
  });
  return or;
}

// ---------------------------------------------------------------------------
// Model mapping per provider
// ---------------------------------------------------------------------------

type AgentRole =
  | "order-analyst"
  | "meal-planner"
  | "schedule-agent"
  | "budget-optimizer"
  | "orchestrator";

/**
 * Returns the best available model for a given agent role.
 *
 * Priority chain:
 *   1. OpenAI (if OPENAI_API_KEY is set)
 *   2. OpenRouter (if OPENROUTER_API_KEY is set)
 *   3. Anthropic (if ANTHROPIC_API_KEY is set)
 *   4. Throws a clear error if no keys are available
 */
export function getModel(agent: AgentRole) {
  // --- Try OpenAI first ---
  if (hasOpenAI()) {
    const openaiModels: Record<AgentRole, ReturnType<typeof openai>> = {
      "order-analyst": openai("gpt-4.1-mini"),
      "meal-planner": openai("gpt-4.1-mini"),
      "schedule-agent": openai("gpt-4.1-mini"),
      "budget-optimizer": openai("gpt-4.1"),
      orchestrator: openai("gpt-4.1-mini"),
    };
    return openaiModels[agent];
  }

  // --- Try OpenRouter second ---
  if (hasOpenRouter()) {
    const or = getOpenRouter();
    return or("openai/gpt-4.1-mini");
  }

  // --- Try Anthropic third ---
  if (hasAnthropic()) {
    return anthropic("claude-sonnet-4-20250514");
  }

  // --- No provider available ---
  throw new Error(
    "No AI provider configured. Set one of: OPENAI_API_KEY, OPENROUTER_API_KEY, or ANTHROPIC_API_KEY in your environment."
  );
}

// Keep backward-compatible AGENT_MODELS export (lazy -- evaluated on access)
export const AGENT_MODELS = new Proxy(
  {} as Record<AgentRole, ReturnType<typeof getModel>>,
  {
    get(_target, prop: string) {
      return getModel(prop as AgentRole);
    },
  }
);
