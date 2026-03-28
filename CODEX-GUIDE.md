# Codex Guide -- Grocery Orchestrator

This file tells Codex (or any AI coding tool) how to contribute to this project.

## Project Overview

Multi-agent grocery orchestration system for Picnic. User says one sentence, 5 agents build a complete weekly grocery cart with visible reasoning.

**Tech stack**: Next.js 15 + Vercel AI SDK 6 + Tailwind + shadcn/ui + TypeScript

## Key Files to Read First

1. `.forge/specs/spec-grocery-orchestrator.md` -- Full MoSCoW spec with 26 requirements
2. `research/streaming-sse-patterns.md` -- API route architecture, SSE streaming, React hooks
3. `research/order-history-algorithms.md` -- Pure TS analysis algorithms (copy-paste ready)
4. `research/conversational-ux-patterns.md` -- UI/UX design decisions
5. `research/demo-strategy.md` -- 2-minute demo script
6. `research/openclaw-primitives.md` -- What judges want to see
7. `research/grocery-ai-landscape.md` -- Competitive context

## Architecture

```
"Sort this week's shop, lasagna Wed, friends Sat, under 80 euro"
    |
    v
[Prefetch Layer] -- Promise.all: orders, favorites, cart, slots, recipes
    |
    v
[Analysis Layer] -- Pure TypeScript (lib/analysis/)
    stapleDetection, replenishmentScoring, budgetAnalysis, coPurchaseRules
    |
    v
[Agent Pipeline] -- Vercel AI SDK generateObject() with Zod schemas
    Promise.all([orderAnalyst, mealPlanner, scheduleAgent])
    -> orchestratorMerge
    -> if (overBudget) budgetOptimizer  // THE key demo moment
    -> streamText() final explanation
    |
    v
[SSE Stream] --> Split-panel React UI
    Left: grocery cart    Right: agent reasoning feed
```

## What Codex Can Build Independently

### 1. Analysis Algorithms (lib/analysis/)
Pure TypeScript, zero app dependencies. See `research/order-history-algorithms.md` for complete implementations.
- `lib/analysis/staple-detection.ts`
- `lib/analysis/replenishment-predictor.ts`
- `lib/analysis/budget-analysis.ts`
- `lib/analysis/co-purchase.ts`
- `lib/analysis/household-estimation.ts`
- `lib/analysis/types.ts` -- shared types (see Interfaces below)

### 2. System Prompts (lib/prompts/)
XML-structured system prompts for each agent step. Each needs: persona, instructions, edge cases with examples, output schema.
- `lib/prompts/order-analyst.ts`
- `lib/prompts/meal-planner.ts`
- `lib/prompts/budget-optimizer.ts`
- `lib/prompts/schedule-agent.ts`
- `lib/prompts/orchestrator.ts`

### 3. UI Components (components/)
React components with shadcn/ui + Tailwind. Can be built against the type interfaces.
- `components/agent-activity-feed.tsx`
- `components/agent-status-panel.tsx`
- `components/cart-view.tsx`
- `components/budget-bar.tsx`
- `components/reasoning-chip.tsx`
- `components/split-panel-layout.tsx`

## Interfaces (Shared Contracts)

Both Claude Code and Codex should build against these types:

```typescript
// Types for Picnic API data
interface PicnicOrder {
  delivery_id: string;
  delivery_time: number; // epoch ms
  status: string;
  items: PicnicOrderItem[];
}

interface PicnicOrderItem {
  selling_unit_id: string; // prefixed with 's'
  name: string;
  quantity: number;
  price: number; // integer cents
  image_url?: string;
}

interface PicnicDeliverySlot {
  slot_id: string;
  window_start: string;
  window_end: string;
  is_available: boolean;
}

// Types for analysis layer output
interface ItemClassification {
  itemId: string;
  name: string;
  category: 'staple' | 'regular' | 'occasional' | 'one-time';
  frequencyRatio: number;
}

interface Recommendation {
  itemId: string;
  name: string;
  score: number;           // 0-100
  reason: string;
  reasonTag: 'repeat' | 'overdue' | 'co-purchase' | 'recipe' | 'suggestion';
  suggestedQuantity: number;
  lastBought: string;      // ISO date
  pricePerUnit: number;    // cents
}

interface BudgetAnalysis {
  avgWeeklySpend: number;  // cents
  spendTrend: 'increasing' | 'stable' | 'decreasing';
  trendSlope: number;
}

interface HouseholdEstimate {
  estimatedSize: 'single' | 'couple' | 'small-family' | 'large-family';
  avgSpendPerOrder: number;
}

// Types for agent pipeline output
interface OrderAnalystOutput {
  recommendedItems: Recommendation[];
  totalEstimatedCost: number; // cents
  householdInsight: string;
}

interface MealPlannerOutput {
  meals: Array<{
    day: string;
    mealName: string;
    ingredients: Array<{ itemId: string; name: string; quantity: number; price: number }>;
    estimatedCost: number; // cents
    portionSize: number;
  }>;
  additionalIngredients: Recommendation[];
}

interface BudgetOptimizerOutput {
  approved: boolean;
  originalTotal: number;   // cents
  optimizedTotal: number;  // cents
  adjustments: Array<{
    original: { itemId: string; name: string; price: number };
    replacement: { itemId: string; name: string; price: number };
    savings: number;       // cents
    reasoning: string;
  }>;
}

interface ScheduleAgentOutput {
  selectedSlot: {
    slotId: string;
    date: string;
    timeWindow: string;
    reasoning: string;
  };
}

// Types for SSE streaming
type AgentName = 'prefetch' | 'order-analyst' | 'meal-planner' | 'budget-optimizer' | 'schedule-agent' | 'orchestrator';
type AgentStatus = 'pending' | 'running' | 'complete' | 'error';
type ActionType = 'SUGGEST' | 'REJECT' | 'APPROVE' | 'QUERY' | 'SUBSTITUTE';
type ReasonTag = 'repeat' | 'substitution' | 'recipe' | 'suggestion' | 'overdue' | 'co-purchase';

interface AgentEvent {
  agent: AgentName;
  action: ActionType;
  message: string;
  timestamp: number;
  details?: Record<string, unknown>;
}

// Types for cart UI
interface CartItem {
  itemId: string;
  name: string;
  quantity: number;
  price: number;           // cents
  imageUrl?: string;
  reasonTag: ReasonTag;
  reasoning: string;
  agentSource: AgentName;
  diffStatus?: 'added' | 'removed' | 'substituted' | 'unchanged';
}

interface CartSummary {
  items: CartItem[];
  totalCost: number;       // cents
  budget: number;          // cents
  isOverBudget: boolean;
  savings: number;         // cents from optimizations
  substitutionCount: number;
  deliverySlot: ScheduleAgentOutput['selectedSlot'];
}
```

## Environment Variables

```
PICNIC_EMAIL=...
PICNIC_PASSWORD=...
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

## Picnic API Reference

See `picnic-api-skill/SKILL.md` for full API docs. Key endpoints:
- `hackathon-list-orders` (GET) -- order history
- `hackathon-search-products` (GET) -- product search
- `hackathon-add-to-cart` (POST) -- add items
- `hackathon-get-cart` (GET) -- current cart
- `hackathon-get-delivery-slots` (GET) -- available slots
- `hackathon-search-recipes` (GET) -- recipe search

Base URL: `https://storefront-prod.nl.picnicinternational.com/api/15/pages/`
Auth header: `x-picnic-auth: <token>`
