---
spec: grocery-orchestrator
total_tasks: 12
estimated_tokens: ~82k
depth: standard
created: 2026-03-28
time_budget: 9 hours
---

# Task Frontier: grocery-orchestrator

> Hackathon build plan. 12 tasks across 5 tiers. Tier 0 tasks are fully independent
> and can each run in a separate Codex session against committed interfaces in CODEX-GUIDE.md.

---

## Tier 0 (Foundation -- no dependencies, all parallelizable)

### T001: Picnic API prefetch layer
- **Requirements**: R001
- **Description**: Build `lib/picnic/client.ts` with login/auth (token from env), and `lib/picnic/prefetch.ts` that does Promise.all to fetch orders, favorites, cart, delivery slots, and product search results. Handle token expiry with retry. Export a single `prefetchAll()` function returning a typed `PicnicData` object. Use fetch with the x-picnic-auth header pattern from `picnic-api-skill/SKILL.md`.
- **Files**:
  - `lib/picnic/client.ts` (auth, base request helper)
  - `lib/picnic/prefetch.ts` (parallel fetch orchestration)
  - `lib/picnic/types.ts` (PicnicOrder, PicnicOrderItem, PicnicDeliverySlot, PicnicData)
- **References**: `picnic-api-skill/SKILL.md`, `CODEX-GUIDE.md` (Picnic API Reference section + interfaces)
- **Estimated tokens**: ~8k
- **Parallel session**: yes -- pure data layer, depends only on env vars and type contracts
- **Dependencies**: none
- **Acceptance**: `prefetchAll()` returns typed data from all 5 endpoints. Auth token is retrieved from env. Parallel execution completes in <5s on decent connection. Token expiry triggers re-auth.

### T002: Order history pattern analysis (pure TypeScript)
- **Requirements**: R002
- **Description**: Implement all 6 analysis algorithms in `lib/analysis/` as pure functions. Copy-paste the implementations from `research/order-history-algorithms.md` and adapt to match the interfaces in CODEX-GUIDE.md. Each module exports a single function. `index.ts` barrel exports a `runFullAnalysis()` that calls all 6 and returns a typed `AnalysisResult`.
- **Files**:
  - `lib/analysis/types.ts` (ItemClassification, Recommendation, BudgetAnalysis, HouseholdEstimate)
  - `lib/analysis/staple-detection.ts`
  - `lib/analysis/replenishment-predictor.ts`
  - `lib/analysis/budget-analysis.ts`
  - `lib/analysis/co-purchase.ts`
  - `lib/analysis/household-estimation.ts`
  - `lib/analysis/index.ts` (barrel + runFullAnalysis)
- **References**: `research/order-history-algorithms.md` (complete implementations), `CODEX-GUIDE.md` (interfaces)
- **Estimated tokens**: ~8k
- **Parallel session**: yes -- pure TypeScript with zero app dependencies, algorithms are pre-written
- **Dependencies**: none
- **Acceptance**: All functions accept PicnicOrder[] and return typed outputs matching CODEX-GUIDE interfaces. Works with 2+ orders. `runFullAnalysis()` completes in <100ms on reasonable data.

### T003: System prompts for all 5 agents
- **Requirements**: R011
- **Description**: Write XML-structured system prompts for each agent step. Each prompt file exports a function that takes context data and returns the complete system prompt string. Include: persona, task description, constraints, edge cases with few-shot examples, output schema description. Prompts must instruct the LLM to reason only (no tool calls) since all data is pre-injected.
- **Files**:
  - `lib/prompts/order-analyst.ts`
  - `lib/prompts/meal-planner.ts`
  - `lib/prompts/budget-optimizer.ts`
  - `lib/prompts/schedule-agent.ts`
  - `lib/prompts/orchestrator.ts`
  - `lib/prompts/index.ts`
- **References**: `CODEX-GUIDE.md` (agent output interfaces for schema descriptions), `research/demo-strategy.md` (what the demo should highlight)
- **Estimated tokens**: ~6k
- **Parallel session**: yes -- string templates with no code dependencies beyond types
- **Dependencies**: none
- **Acceptance**: Each prompt function returns a string containing XML-structured sections. Prompts reference the correct Zod output shape. Budget optimizer prompt specifically handles the "over budget disagreement" demo moment.

### T004: Split-panel UI shell + cart component + budget bar
- **Requirements**: R009, R013, R014, R015
- **Description**: Build the split-panel layout with shadcn/ui ResizablePanel. Left panel: cart view with category grouping, reasoning chips (colored tags per R013), diff highlighting (green/red/yellow per R014), product image placeholders (R015). Budget progress bar. Right panel placeholder. Header with pipeline status and mode toggle. All components consume the TypeScript interfaces from CODEX-GUIDE.md via props -- wire to mock data initially.
- **Files**:
  - `components/split-panel-layout.tsx`
  - `components/cart-view.tsx`
  - `components/cart-item.tsx`
  - `components/budget-bar.tsx`
  - `components/reasoning-chip.tsx`
  - `components/header.tsx`
  - `app/page.tsx` (main page with layout)
- **References**: `UI-SPECIFICATION.md` (layout, colors, typography, component tree), `CODEX-GUIDE.md` (CartItem, CartSummary interfaces)
- **Estimated tokens**: ~9k
- **Parallel session**: yes -- pure React components against type interfaces, no backend dependency
- **Dependencies**: none
- **Acceptance**: Split panel renders at 1920x1080 with 60/40 ratio. Right panel is collapsible. Cart items show reasoning chips with correct colors. Budget bar animates. Diff status renders green/red/yellow highlights.

---

## Tier 1 (depends on Tier 0)

### T005: Agent pipeline -- Order Analyst + Meal Planner + Schedule Agent
- **Requirements**: R003, R004, R006
- **Description**: Implement three agent modules that can run in parallel. Each uses Vercel AI SDK `generateObject()` with Zod schemas matching CODEX-GUIDE interfaces. Order Analyst takes analysis results (T002 output) + prefetched data (T001 output) and returns `OrderAnalystOutput`. Meal Planner takes user intent + recipe search results + products and returns `MealPlannerOutput`. Schedule Agent takes delivery slots + historical order patterns and returns `ScheduleAgentOutput`. Each imports its system prompt from T003.
- **Files**:
  - `lib/agents/order-analyst.ts`
  - `lib/agents/meal-planner.ts`
  - `lib/agents/schedule-agent.ts`
  - `lib/agents/schemas.ts` (Zod schemas for all agent outputs)
- **References**: `research/streaming-sse-patterns.md` (agent architecture), `CODEX-GUIDE.md` (all Output interfaces)
- **Estimated tokens**: ~8k
- **Parallel session**: no -- depends on T001/T002/T003 output types being finalized
- **Dependencies**: T001, T002, T003
- **Acceptance**: Each agent function takes typed input and returns typed output via generateObject(). Zod schemas validate against CODEX-GUIDE interfaces. Functions are importable by the orchestrator.

### T006: Agent activity feed + SSE client hook
- **Requirements**: R009 (right panel), R010 (client side)
- **Description**: Build the right-panel agent activity feed component and the React hook that consumes the SSE stream. Feed entries are color-coded by agent (per UI-SPECIFICATION.md agent color system), animate in from the bottom, and auto-scroll. Hook uses Vercel AI SDK's `useChat` with `onDataPart` handlers for typed agent events. Connect to the split-panel layout from T004.
- **Files**:
  - `components/agent-activity-feed.tsx`
  - `components/feed-entry.tsx`
  - `components/agent-status-panel.tsx`
  - `hooks/use-orchestration.ts` (SSE consumer hook)
- **References**: `UI-SPECIFICATION.md` (agent colors, animation specs), `research/streaming-sse-patterns.md` (React hook patterns), `CODEX-GUIDE.md` (AgentEvent, AgentName, AgentStatus types)
- **Estimated tokens**: ~7k
- **Parallel session**: no -- integrates with T004 layout
- **Dependencies**: T004
- **Acceptance**: Feed entries render with correct agent colors. New entries animate in. Auto-scroll works. Hook parses SSE data parts into typed AgentEvent objects. Panel integrates into split-panel layout.

---

## Tier 2 (depends on Tier 1)

### T007: Budget Optimizer agent
- **Requirements**: R005
- **Description**: Implement the budget optimizer agent -- THE key demo moment. Takes merged cart from Order Analyst + Meal Planner, the user's budget constraint, and alternative products from Picnic search. Uses generateObject() with Zod to return `BudgetOptimizerOutput`. Must handle: over-budget scenario with substitution suggestions and detailed per-item reasoning. This runs conditionally -- only when merged cart exceeds budget.
- **Files**:
  - `lib/agents/budget-optimizer.ts`
- **References**: `CODEX-GUIDE.md` (BudgetOptimizerOutput interface), `research/demo-strategy.md`
- **Estimated tokens**: ~6k
- **Parallel session**: no -- depends on T005 agent outputs for input shape
- **Dependencies**: T005
- **Acceptance**: Given a cart over budget, returns substitution suggestions with savings calculations. Each adjustment has original/replacement/savings/reasoning. `approved` field is false when over budget with suggestions, true when within budget.

### T008: SSE streaming endpoint + orchestration pipeline
- **Requirements**: R007, R010
- **Description**: Build the single SSE API route that orchestrates the entire pipeline. Uses `createUIMessageStream` from Vercel AI SDK. Pipeline: (1) prefetch in parallel, (2) run analysis, (3) Promise.all order-analyst + meal-planner + schedule-agent, (4) merge outputs, (5) if over budget -> budget-optimizer, (6) streamText() final orchestrator explanation. Each step emits typed agent status events via writer.write(). This is the core DAG execution.
- **Files**:
  - `app/api/orchestrate/route.ts`
  - `lib/agents/orchestrator.ts` (merge logic + final streamText)
  - `lib/agents/types.ts` (shared agent types if not already in CODEX-GUIDE)
- **References**: `research/streaming-sse-patterns.md` (complete route architecture with code), `CODEX-GUIDE.md` (all interfaces)
- **Estimated tokens**: ~9k
- **Parallel session**: no -- integrates all agent modules from T005 + T007
- **Dependencies**: T005, T007
- **Acceptance**: POST to /api/orchestrate streams agent events through one SSE connection. All 5+ agent steps emit status updates. Parallel steps (order-analyst, meal-planner, schedule-agent) run concurrently via Promise.all. Budget optimizer fires conditionally. Final orchestrator merges and streams explanation.

---

## Tier 3 (depends on Tier 2)

### T009: Cart assembly (Picnic API mutations)
- **Requirements**: R008
- **Description**: Translate the final orchestrator output into Picnic API cart mutations. Sequence: clear existing cart, add all items with correct quantities, set the selected delivery slot, verify cart contents match plan. Handle API errors gracefully. Export a `assembleCart()` function called at end of orchestration pipeline.
- **Files**:
  - `lib/picnic/cart-assembly.ts`
- **References**: `picnic-api-skill/SKILL.md` (add-to-cart, get-cart endpoints), `CODEX-GUIDE.md` (CartItem interface)
- **Estimated tokens**: ~5k
- **Parallel session**: no -- needs final pipeline output shape from T008
- **Dependencies**: T008
- **Acceptance**: Cart is cleared, items added, slot set. Verification step confirms cart matches plan. Errors are caught and reported through SSE stream.

### T010: Full integration wiring + end-to-end flow
- **Requirements**: R007 (orchestrator merge), R009 (UI wiring)
- **Description**: Wire the SSE hook (T006) to the orchestration endpoint (T008). Connect cart state updates from SSE events to the cart-view component. Connect agent feed events to the activity feed. Wire the budget bar to live totals. Add the user input form (single sentence) that triggers the pipeline. This is the glue that makes everything work together.
- **Files**:
  - `app/page.tsx` (update with real hook + state management)
  - `hooks/use-orchestration.ts` (update to connect to real endpoint)
  - `components/input-bar.tsx` (user prompt input)
- **References**: `research/streaming-sse-patterns.md` (client integration), `UI-SPECIFICATION.md`
- **Estimated tokens**: ~6k
- **Parallel session**: no -- integration task touching multiple layers
- **Dependencies**: T006, T008
- **Acceptance**: User types a sentence, pipeline executes, cart populates live, agent feed shows real-time reasoning, budget bar updates. Full end-to-end flow works.

---

## Tier 4 (depends on Tier 3 -- polish and demo)

### T011: DAG visualization + meal plan display
- **Requirements**: R016, R017
- **Description**: Add React Flow DAG visualization showing the 5 agent nodes with animated edges. Nodes light up as agents run, edges animate data flow. Compact layout (180px tall) in the right panel above the feed. Add meal plan summary cards in the left panel (calendar-style per R017). Both are SHOULD-HAVE features that make the demo visually impressive.
- **Files**:
  - `components/dag-visualization.tsx`
  - `components/meal-plan-summary.tsx`
- **References**: `UI-SPECIFICATION.md` (DAG visualization section, agent colors)
- **Estimated tokens**: ~7k
- **Parallel session**: no -- needs live agent status data from the SSE stream
- **Dependencies**: T010
- **Acceptance**: DAG shows 5 nodes with correct agent colors. Active node pulses. Edges animate when data flows between agents. Meal plan cards show day/meal/ingredients/cost.

### T012: Demo script dry-run + recording prep
- **Requirements**: R012
- **Description**: Prepare the 2-minute demo recording. Write the exact demo script (input sentence, expected flow, key moments to highlight including budget disagreement). Verify the full pipeline works end-to-end with the scripted input. Fix any visual glitches at 1920x1080. Ensure the budget optimizer triggers and shows substitutions visibly. Document the recording steps.
- **Files**:
  - `DEMO-SCRIPT.md` (step-by-step recording script)
  - Any bug fixes discovered during dry run
- **References**: `research/demo-strategy.md`
- **Estimated tokens**: ~3k
- **Parallel session**: no -- requires full working system
- **Dependencies**: T010, T011
- **Acceptance**: Full pipeline executes with scripted input in <30s. Budget disagreement moment is clearly visible. All UI elements render correctly at 1920x1080. Demo script covers the 2-minute recording.

---

## Parallel Execution Strategy

**Session A (Claude Code -- main)**: T001, then T005 -> T007 -> T008 -> T009 -> T010 -> T012
**Session B (Codex)**: T002 (analysis algorithms)
**Session C (Codex)**: T003 (system prompts)
**Session D (Codex)**: T004 -> T006 -> T011 (UI track)

Sessions B, C, D can start immediately. Session A starts T001 immediately.
After Tier 0 completes, only Session A and D continue (merged when integration begins at T010).

---

## Coverage

- R001 -> T001
- R002 -> T002
- R003 -> T005
- R004 -> T005
- R005 -> T007
- R006 -> T005
- R007 -> T008, T010
- R008 -> T009
- R009 -> T004, T006, T010
- R010 -> T006, T008
- R011 -> T003
- R012 -> T012
- R013 -> T004
- R014 -> T004
- R015 -> T004
- R016 -> T011
- R017 -> T011
- R018 -> not planned (COULD HAVE, cut for time)
- R019 -> not planned (COULD HAVE, cut for time)
- R020 -> not planned (COULD HAVE, cut for time)
- R021 -> not planned (COULD HAVE, cut for time)
