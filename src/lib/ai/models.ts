import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";

// Model routing: pick the right model for each agent's task
// Swap models freely -- the AI SDK unified interface means no code changes needed
export const AGENT_MODELS = {
  "order-analyst": openai("gpt-4.1-mini"),
  "meal-planner": openai("gpt-4.1-mini"),
  "schedule-agent": openai("gpt-4.1-mini"),
  "budget-optimizer": openai("gpt-4.1"),
  orchestrator: anthropic("claude-sonnet-4-20250514"),
} as const;

// Fallback: use the same model for everything if only one key is available
export function getModel(agent: keyof typeof AGENT_MODELS) {
  try {
    return AGENT_MODELS[agent];
  } catch {
    // If the preferred provider isn't configured, fall back to whatever is available
    try {
      return openai("gpt-4.1-mini");
    } catch {
      return anthropic("claude-sonnet-4-20250514");
    }
  }
}
