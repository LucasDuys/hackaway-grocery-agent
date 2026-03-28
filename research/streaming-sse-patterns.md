# Technical Specification: Real-Time Agent Activity Streaming

## Architecture for Multi-Agent Grocery Orchestration with Next.js + Vercel AI SDK

---

## 1. API Route Architecture

Single API route orchestrates the entire pipeline and streams all agent activity through one connection.

**Why single route:** `createUIMessageStream` with `writer.write()` is purpose-built for streaming heterogeneous events through one channel. Splitting into 5 routes means 5 connections and complex client-side coordination.

```
app/
  api/
    orchestrate/
      route.ts          # Main pipeline endpoint - streams all agent activity
  lib/
    agents/
      prefetch.ts       # Agent logic (imported, not a route)
      order-analyst.ts
      meal-planner.ts
      budget-optimizer.ts
      schedule-agent.ts
      orchestrator.ts
  types/
    messages.ts         # Shared type definitions for data parts
```

### Route structure:

```typescript
// app/api/orchestrate/route.ts
import { createUIMessageStream, createUIMessageStreamResponse, streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';

export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages, userInput } = await req.json();

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      // Phase 1: Prefetch all Picnic data
      writer.write({
        type: 'data-agent-status',
        id: 'agent-prefetch',
        data: { agent: 'prefetch', status: 'running', message: 'Fetching Picnic data...' },
      });
      const prefetchResult = await runPrefetch();
      writer.write({
        type: 'data-agent-status',
        id: 'agent-prefetch',
        data: { agent: 'prefetch', status: 'complete', message: 'Data ready' },
      });

      // Phase 2: Analysis (pure TypeScript, no LLM)
      const analysis = runAnalysis(prefetchResult);

      // Phase 3: Parallel agent LLM calls
      const [orderResult, mealResult, scheduleResult] = await Promise.all([
        runAgent(writer, 'order-analyst', () => orderAnalyst(analysis)),
        runAgent(writer, 'meal-planner', () => mealPlanner(analysis, userInput)),
        runAgent(writer, 'schedule-agent', () => scheduleAgent(analysis)),
      ]);

      // Phase 4: Merge + conditional budget check
      const merged = orchestratorMerge(orderResult, mealResult, scheduleResult);

      if (merged.total > merged.budget) {
        writer.write({
          type: 'data-agent-event',
          id: `event-${Date.now()}`,
          data: { agent: 'budget-optimizer', action: 'REJECT', message: `Over budget by EUR ${((merged.total - merged.budget) / 100).toFixed(2)}` },
        });
        const optimized = await runAgent(writer, 'budget-optimizer', () => budgetOptimizer(merged));
        merged.items = optimized.items;
      }

      // Phase 5: Stream final explanation
      const formatResult = streamText({
        model: anthropic('claude-sonnet-4-20250514'),
        system: 'Synthesize the grocery plan into a clear summary.',
        prompt: buildSummaryPrompt(merged),
      });
      writer.merge(formatResult.toUIMessageStream());
    },
  });

  return createUIMessageStreamResponse({ stream });
}
```

---

## 2. SSE Implementation

AI SDK uses SSE natively. `createUIMessageStreamResponse` handles it.

### Why SSE (not WebSocket):
- One-way data flow (server -> client)
- Built into AI SDK (zero additional infra)
- Auto-reconnection via `EventSource`
- Vercel-compatible (no dedicated WebSocket infra)

### Raw SSE pattern (for non-AI-SDK endpoints):

```typescript
// app/api/events/route.ts
export const dynamic = 'force-dynamic';

export async function GET() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };
      send('agent-status', { agent: 'prefetch', status: 'running' });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
```

---

## 3. Type Definitions

```typescript
// types/messages.ts
export type AgentName = 'prefetch' | 'order-analyst' | 'meal-planner' | 'budget-optimizer' | 'schedule-agent' | 'orchestrator';
export type AgentStatus = 'pending' | 'running' | 'complete' | 'error';
export type ActionType = 'SUGGEST' | 'REJECT' | 'APPROVE' | 'QUERY' | 'SUBSTITUTE';

export type AgentStatusPart = {
  type: 'data-agent-status';
  id: string;
  data: {
    agent: AgentName;
    status: AgentStatus;
    message: string;
    error?: string;
  };
};

export type AgentEventPart = {
  type: 'data-agent-event';
  id: string;
  data: {
    agent: AgentName;
    action: ActionType;
    message: string;
    details?: Record<string, unknown>;
  };
};

export type AgentResultPart = {
  type: 'data-agent-result';
  id: string;
  data: {
    agent: AgentName;
    result: unknown;
    durationMs: number;
  };
};

export type GroceryDataPart = AgentStatusPart | AgentEventPart | AgentResultPart;
```

---

## 4. React Hook for Consuming Agent Streams

```typescript
// hooks/useGroceryOrchestrator.ts
'use client';

import { useChat } from '@ai-sdk/react';
import { useState, useCallback } from 'react';
import type { AgentName, AgentStatus } from '@/types/messages';

type AgentState = Record<AgentName, {
  status: AgentStatus;
  message: string;
  startedAt?: number;
  completedAt?: number;
}>;

const initialAgentState: AgentState = {
  'prefetch':         { status: 'pending', message: 'Waiting...' },
  'order-analyst':    { status: 'pending', message: 'Waiting...' },
  'meal-planner':     { status: 'pending', message: 'Waiting...' },
  'budget-optimizer': { status: 'pending', message: 'Waiting...' },
  'schedule-agent':   { status: 'pending', message: 'Waiting...' },
  'orchestrator':     { status: 'pending', message: 'Waiting...' },
};

export function useGroceryOrchestrator() {
  const [agentStates, setAgentStates] = useState<AgentState>(initialAgentState);
  const [activityLog, setActivityLog] = useState<Array<{
    agent: AgentName;
    action?: string;
    message: string;
    timestamp: number;
  }>>([]);

  const { messages, sendMessage, status, error } = useChat({
    api: '/api/orchestrate',
    onData: (dataPart: any) => {
      if (dataPart.type === 'data-agent-status') {
        const { agent, status: agentStatus, message } = dataPart.data;
        setAgentStates(prev => ({
          ...prev,
          [agent]: {
            status: agentStatus,
            message,
            startedAt: agentStatus === 'running' ? Date.now() : prev[agent]?.startedAt,
            completedAt: agentStatus === 'complete' ? Date.now() : undefined,
          },
        }));
        setActivityLog(prev => [...prev, { agent, message, timestamp: Date.now() }]);
      }

      if (dataPart.type === 'data-agent-event') {
        const { agent, action, message } = dataPart.data;
        setActivityLog(prev => [...prev, { agent, action, message, timestamp: Date.now() }]);
      }
    },
    onError: (err) => {
      setAgentStates(prev => {
        const updated = { ...prev };
        for (const key of Object.keys(updated) as AgentName[]) {
          if (updated[key].status === 'running') {
            updated[key] = { status: 'error', message: 'Connection lost' };
          }
        }
        return updated;
      });
    },
  });

  const orchestrate = useCallback((input: string) => {
    setAgentStates(initialAgentState);
    setActivityLog([]);
    sendMessage({ text: input });
  }, [sendMessage]);

  return { messages, agentStates, activityLog, orchestrate, isRunning: status === 'streaming', error };
}
```

---

## 5. Multi-Model Configuration

```typescript
// lib/ai/models.ts
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';

export const AGENT_MODELS = {
  'order-analyst':    openai('gpt-4.1-mini'),    // Fast, cheap -- data interpretation
  'meal-planner':     openai('gpt-4.1-mini'),    // Fast -- recipe matching
  'schedule-agent':   openai('gpt-4.1-mini'),    // Simple -- slot selection
  'budget-optimizer': openai('gpt-4.1'),         // Needs better reasoning
  'orchestrator':     anthropic('claude-sonnet-4-20250514'), // Best for synthesis
} as const;

// Swap models for testing:
// export const AGENT_MODELS = {
//   'order-analyst':    anthropic('claude-haiku-4-5-20251001'),
//   ...
// };
```

Environment variables:
```
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

---

## 6. Error Handling Pattern

```typescript
// lib/agents/utils.ts
async function runAgent<T>(
  writer: { write: (part: any) => void },
  agentName: AgentName,
  fn: () => Promise<T>
): Promise<T | null> {
  const startTime = Date.now();
  writer.write({
    type: 'data-agent-status',
    id: `agent-${agentName}`,
    data: { agent: agentName, status: 'running', message: 'Starting...' },
  });

  try {
    const result = await fn();
    writer.write({
      type: 'data-agent-status',
      id: `agent-${agentName}`,
      data: { agent: agentName, status: 'complete', message: 'Done' },
    });
    writer.write({
      type: 'data-agent-result',
      id: `result-${agentName}`,
      data: { agent: agentName, result, durationMs: Date.now() - startTime },
    });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    writer.write({
      type: 'data-agent-status',
      id: `agent-${agentName}`,
      data: { agent: agentName, status: 'error', message, error: message },
    });
    return null;
  }
}
```

---

## 7. Key Version Notes

- **AI SDK 5+**: Uses `createUIMessageStream` / `createUIMessageStreamResponse`
- **AI SDK 6.0**: `streamObject` deprecated; use `streamText` with `output: Output.object()` instead
- **Data part reconciliation**: Writing with the same `id` updates the existing part on client (no duplicates)
- Writing with unique `id` per event accumulates entries (for activity feed)

## Sources

- AI SDK Core: streamText - ai-sdk.dev/docs/reference/ai-sdk-core/stream-text
- AI SDK UI: Streaming Custom Data - ai-sdk.dev/docs/ai-sdk-ui/streaming-data
- AI SDK UI: useChat - ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat
- AI SDK 5 announcement - vercel.com/blog/ai-sdk-5
- AI SDK 6 announcement - vercel.com/blog/ai-sdk-6
- Migration Guide 6.0 - ai-sdk.dev/docs/migration-guides/migration-guide-6-0
- How to build AI Agents with Vercel AI SDK - vercel.com/kb/guide/how-to-build-ai-agents-with-vercel-and-the-ai-sdk
