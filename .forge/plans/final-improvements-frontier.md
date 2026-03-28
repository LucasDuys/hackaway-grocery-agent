---
spec: final-improvements
total_tasks: 12
estimated_tokens: ~82k
depth: standard
---

# Final Improvements Frontier

Target: Take hackaway grocery agent from ~66/100 to ~85-90/100 across five improvement areas. Estimated wall-clock time: 4-5 hours.

---

## Tier 1 (parallel -- no dependencies)

- [T001] SOUL.md + prompt injection (IMP-1a) | est: ~4k tokens
  Create `SOUL.md` in project root with orchestrator persona, values, and behavioral rules.
  Inject SOUL.md content into `src/lib/prompts/order-analyst.ts` and `src/lib/prompts/meal-planner.ts`
  system prompts via a shared `<soul>` block. Also inject into `src/lib/prompts/budget-optimizer.ts`
  and `src/lib/prompts/schedule-agent.ts` if they have system prompts.
  Files: `SOUL.md` (new), `src/lib/prompts/order-analyst.ts`, `src/lib/prompts/meal-planner.ts`,
  `src/lib/prompts/budget-optimizer.ts`, `src/lib/prompts/schedule-agent.ts`

- [T002] Preference memory module (IMP-1b + IMP-5) | est: ~8k tokens
  Create `src/lib/memory/preferences.ts` with functions:
  - `loadPreferences(): Preferences` -- read from `src/data/preferences.json`, return defaults if missing
  - `savePreferences(prefs: Preferences): void` -- write to `src/data/preferences.json`
  - `derivePreferences(cartSummary, intent, budgetResult): Preferences` -- extract learned preferences:
    brand preferences (accepted/rejected substitutions from budget optimizer adjustments),
    budget patterns (actual spend, stated budget), delivery slot preferences,
    items removed by user (diffStatus === "removed"), staple items confirmed
  - `formatPreferencesForPrompt(prefs: Preferences): string` -- render preferences as prompt context
  Define `Preferences` type in `src/types/index.ts` or co-located.
  Create initial empty `src/data/preferences.json` with default structure.
  Files: `src/lib/memory/preferences.ts` (new), `src/data/preferences.json` (new), `src/types/index.ts`

- [T003] Demo page research + architecture (IMP-2 research) | est: ~8k tokens
  RESEARCH PHASE -- no implementation yet. Produce a research document at
  `src/app/demo/RESEARCH.md` covering:
  1. Evaluate animation approach: Framer Motion (already installed as `motion`) vs GSAP vs CSS-only.
    Decision criteria: bundle size, scroll-trigger support, SVG animation, projector readability.
    Strong recommendation: use `motion` since it is already a dependency.
  2. Decide interaction model: scroll-triggered (ScrollTrigger / useScroll) vs click-through stepper.
    For a hackathon demo on a projector, click-through is more reliable (no scroll jank, presenter control).
  3. Define the 7 animation steps with exact component names, data flow, and visual description:
    Step 1: InputParse -- sentence breaks into tokens
    Step 2: DataFetch -- arrows to Picnic API, data cards fly in
    Step 3: Analysis -- patterns emerge, frequency charts
    Step 4: AgentDAG -- nodes light up in sequence
    Step 5: BudgetConflict -- red flash, items swapped
    Step 6: CartAssembly -- items slide into place
    Step 7: Checkout -- API calls visualized
  4. Define color palette (Picnic red #E8590C, warm whites, clean typography).
  5. Sketch component tree: `src/app/demo/page.tsx` as shell, `src/components/demo/` for steps.
  Output: `src/app/demo/RESEARCH.md` with decisions and component plan.
  Files: `src/app/demo/RESEARCH.md` (new)

- [T004] Narrative message templates (IMP-3 partial) | est: ~6k tokens
  Create `src/lib/narrative.ts` with functions that transform raw agent events into
  narrative-style messages. Each function takes the raw data and returns a story string:
  - `narrateOrderAnalystSuggest(item, analysis)` -- e.g. "Looking at your last 100 orders...
    you buy Melkunie Breaker vanille every week (98 of 100 orders). Adding 3 to your cart."
  - `narrateBudgetReject(totalCost, budget)` -- e.g. "Your cart is EUR 15.40 over budget.
    I can save EUR 6.20 by swapping Starbucks beans for a cheaper blend..."
  - `narrateBudgetSubstitute(original, replacement, savings)` -- human-friendly swap explanation
  - `narrateScheduleSlot(slot, reasoning)` -- natural delivery slot explanation
  - `narrateMealPlan(meal)` -- story about why this meal was chosen
  Export a `narrateEvent(event, context)` dispatcher that routes by agent+action.
  Files: `src/lib/narrative.ts` (new)

---

## Tier 2 (depends on Tier 1)

- [T005] Wire preferences into orchestrate pipeline (IMP-1b + IMP-5) | est: ~8k tokens | depends: T002
  Update `src/app/api/orchestrate/route.ts`:
  1. At pipeline start: call `loadPreferences()` and inject formatted preferences into agent prompts
     via `formatPreferencesForPrompt()`. Pass into `buildOrderAnalystPrompt()` and
     `buildMealPlannerPrompt()` (add a `preferencesContext` parameter to both prompt builders).
  2. At pipeline end (after cart-summary is sent, before sendDone): call `derivePreferences()`
     with the completed cart data, then `savePreferences()`.
  3. Send a new SSE event `{ type: "learning-insights", data: { insights: string[] } }` listing
     what was learned this run (e.g. "Learned: you prefer store-brand milk over premium").
  4. Add "learning insights" rendering in `src/components/pipeline-view.tsx` -- show a small
     card at the bottom of the pipeline when insights are available.
  Update prompt builders to accept and render the preferences context.
  Files: `src/app/api/orchestrate/route.ts`, `src/lib/prompts/order-analyst.ts`,
  `src/lib/prompts/meal-planner.ts`, `src/hooks/use-orchestration.ts`, `src/types/index.ts`,
  `src/components/pipeline-view.tsx`

- [T006] Wire narrative messages into route + story toggle (IMP-3) | est: ~7k tokens | depends: T004
  Update `src/app/api/orchestrate/route.ts`:
  1. Import narrative functions from `src/lib/narrative.ts`.
  2. Replace raw `sendAgentEvent` message strings with narrative versions throughout the pipeline.
     Keep the raw message as a `rawMessage` field in the SSE event data.
  3. Send both `message` (narrative) and `rawMessage` (original) in every agent-event.
  Update `src/components/agent-activity-feed.tsx` and `src/components/feed-entry.tsx`:
  1. Add a "Story Mode" toggle at the top of the activity feed (default: on).
  2. When story mode is on, render `event.message` (narrative). When off, render `event.rawMessage`.
  3. Style narrative messages with slightly larger text, italic for behavioral evidence quotes.
  Update `src/hooks/use-orchestration.ts` to parse the new `rawMessage` field from SSE events.
  Files: `src/app/api/orchestrate/route.ts`, `src/components/agent-activity-feed.tsx`,
  `src/components/feed-entry.tsx`, `src/hooks/use-orchestration.ts`, `src/types/index.ts`

- [T007] Proactive notification bar (IMP-1c) | est: ~5k tokens | depends: T002
  Create `src/components/proactive-notification.tsx`:
  1. Calculate days since last order from `src/data/mock-orders.json` (read the first order's
     delivery_time and diff against current date).
  2. If >= 7 days, show a subtle notification bar at the top of the page:
     "It has been N days since your last order. Ready to prepare your weekly shop?"
  3. Style: Picnic red left border, warm white background, dismiss button.
  4. Use `motion` (framer-motion) for slide-down entrance animation.
  Update `src/app/page.tsx`:
  1. Import and render `<ProactiveNotification />` above the Header.
  2. Pass an `onDismiss` callback to hide it, and an `onAction` callback that triggers
     orchestrate with the default prompt.
  Files: `src/components/proactive-notification.tsx` (new), `src/app/page.tsx`

- [T008] Agent data handoff indicators (IMP-1d) | est: ~6k tokens | depends: T004
  Enhance the pipeline view to show "social context" -- what data each agent sent/received.
  Update `src/app/api/orchestrate/route.ts`:
  1. After each agent completes, send a new SSE event type `agent-handoff`:
     `{ type: "agent-handoff", data: { from: AgentName, to: AgentName, summary: string } }`
     Examples:
     - After order analyst: `{ from: "order-analyst", to: "orchestrator", summary: "15 items, EUR 42.50 estimated" }`
     - After meal planner: `{ from: "meal-planner", to: "orchestrator", summary: "2 meals, 12 ingredients, EUR 18.90" }`
     - After budget optimizer: `{ from: "budget-optimizer", to: "orchestrator", summary: "3 swaps, EUR 12.40 saved" }`
  2. Update `src/hooks/use-orchestration.ts` to collect handoff events into state.
  Update `src/components/pipeline-view.tsx`:
  1. Between StepCards, render handoff arrows showing the data summary.
  2. Style as a small connector with an arrow icon and the summary text.
  3. Use `motion` for a fade-in animation when the handoff appears.
  Files: `src/app/api/orchestrate/route.ts`, `src/hooks/use-orchestration.ts`,
  `src/components/pipeline-view.tsx`, `src/types/index.ts`

- [T009] Verify Picnic recipe integration end-to-end (IMP-4) | est: ~6k tokens | depends: T001
  Audit and fix the recipe-to-cart pipeline:
  1. Read `src/lib/picnic/prefetch.ts` fully -- verify that `prefetchAll()` searches for recipes
     matching the meal queries (check the `searchQueries` usage and recipe fetching logic).
  2. Trace the flow: prefetch recipes -> pass to `buildMealPlannerPrompt()` -> LLM uses real
     selling_unit_ids -> merge into cart -> price correction from catalog.
  3. Verify recipe images flow through: `data.recipes[].imageUrl` -> `recipeImageMap` ->
     meal-plan SSE event -> `MealPlanSummary` component renders images.
  4. Fix any broken links in the chain. Common issues:
     - Recipe search might not match user's meal query text
     - Recipe ingredients might lack selling_unit_id
     - Image URLs might be relative (need full URL)
  5. If recipes are not being searched, add recipe search queries to `prefetchAll()` call
     in `route.ts` (the searchQueries array already includes meal dishes).
  6. Add a test prompt that exercises a known recipe and verify cart contains real IDs.
  Files: `src/lib/picnic/prefetch.ts`, `src/app/api/orchestrate/route.ts`,
  `src/lib/agents/meal-planner.ts`, `src/components/meal-plan-summary.tsx`

---

## Tier 3 (depends on Tier 2)

- [T010] Demo page shell + step components (IMP-2 implementation part 1) | est: ~12k tokens | depends: T003
  Implement the interactive demo page based on the research from T003.
  Create `src/app/demo/page.tsx`:
  1. Click-through stepper with 7 steps. Current step tracked in state.
  2. Navigation: left/right arrow keys, on-screen prev/next buttons.
  3. Progress indicator (step dots or fraction like "3 / 7").
  4. Full-screen layout optimized for 1920x1080 projector.
  5. Picnic color scheme: #E8590C red, #FFF8F5 warm white background, #1A1A1A text.
  Create `src/components/demo/` directory with step components:
  - `step-input-parse.tsx` -- sentence splits into colored tokens (meals, budget, events)
  - `step-data-fetch.tsx` -- animated arrows to API, data cards fly in with counts
  - `step-analysis.tsx` -- pattern cards appear (staple items glow, frequency bars)
  - `step-agent-dag.tsx` -- DAG nodes light up in sequence with data flow lines
  - `step-budget-conflict.tsx` -- red flash, items swap animation, total drops
  - `step-cart-assembly.tsx` -- items slide into grid with product images and prices
  - `step-checkout.tsx` -- API call visualization, confirmation animation
  Each step uses `motion` (framer-motion) for entrance/exit animations.
  No external libraries beyond what is already installed.
  No emojis. Clean typography, CSS shapes, SVG icons.
  Files: `src/app/demo/page.tsx` (new), `src/components/demo/*.tsx` (7 new files)

- [T011] Demo page polish + transitions (IMP-2 implementation part 2) | est: ~8k tokens | depends: T010
  Polish the demo page for presentation quality:
  1. Add smooth cross-fade transitions between steps using `AnimatePresence` from `motion`.
  2. Add a title slide (step 0): project name, team name, "Picnic x OpenClaw" tagline.
  3. Add keyboard shortcuts: spacebar to advance, 'r' to restart.
  4. Add a final summary slide (step 8): recap of all OpenClaw primitives demonstrated.
  5. Ensure all text is readable at projector distance (minimum 24px body, 48px headings).
  6. Test at 1920x1080 viewport -- no horizontal scroll, no clipped content.
  7. Add link to `/demo` in the main page header for easy navigation.
  Files: `src/app/demo/page.tsx`, `src/components/demo/*.tsx`, `src/components/header.tsx`

---

## Tier 4 (depends on Tier 3)

- [T012] Build verification + final smoke test | est: ~4k tokens | depends: T005, T006, T007, T008, T009, T010, T011
  Run `npm run build` and fix any TypeScript or build errors introduced by all tasks.
  Verify:
  1. Main page loads without errors, input bar works, pipeline runs end-to-end.
  2. `/demo` page loads, all 7 steps render, navigation works.
  3. Proactive notification shows on main page.
  4. Story mode toggle works in activity feed.
  5. Agent handoff indicators appear in pipeline view.
  6. Preferences file gets written after a run.
  7. SOUL.md content visible in agent prompts (check via activity feed narrative).
  8. No emojis anywhere in the UI.
  Fix any issues found. This is the final commit before the hackathon presentation.
  Files: any files with build errors

---

## Coverage

- IMP-1a (SOUL.md) -> T001
- IMP-1b (Accumulated Memory) -> T002, T005
- IMP-1c (Periodic Autonomy) -> T007
- IMP-1d (Social Context) -> T008
- IMP-2 (Demo Animation Page) -> T003, T010, T011
- IMP-3 (Agent Reasoning Narrative) -> T004, T006
- IMP-4 (Picnic Recipe Integration) -> T009
- IMP-5 (Household Learning) -> T002, T005 (merged with IMP-1b as specified)

## Execution Notes

### Parallelism
- Tier 1 (T001, T002, T003, T004): all 4 tasks can run simultaneously -- zero dependencies.
- Tier 2 (T005-T009): 5 tasks, most can run in parallel once their specific Tier 1 dependency completes.
  T005 waits on T002, T006 waits on T004, T007 waits on T002, T008 waits on T004, T009 waits on T001.
- Tier 3 (T010, T011): sequential -- T011 polishes T010.
- Tier 4 (T012): final gate, depends on everything.

### Critical Path
T003 -> T010 -> T011 -> T012 is the longest chain (demo page research -> implementation -> polish -> verify).
Start T003 first and prioritize its completion to unblock the demo page work.

### Commit Strategy
Each task gets its own commit. Suggested commit message prefixes:
- T001: "feat: add SOUL.md and inject into agent prompts"
- T002: "feat: add preference memory module"
- T003: "docs: demo page research and architecture decisions"
- T004: "feat: add narrative message templates"
- T005: "feat: wire preferences into orchestrate pipeline"
- T006: "feat: add story mode toggle for narrative agent messages"
- T007: "feat: add proactive reorder notification"
- T008: "feat: add agent data handoff indicators"
- T009: "fix: verify and fix Picnic recipe integration"
- T010: "feat: implement interactive demo page with 7 steps"
- T011: "feat: polish demo page transitions and projector readability"
- T012: "fix: build verification and smoke test fixes"
