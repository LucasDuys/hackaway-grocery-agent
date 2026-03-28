---
spec: final-polish
total_tasks: 10
estimated_tokens: ~62k
depth: standard
---

# Final Polish Frontier (85 -> 92+ score)

## Tier 1 (parallel -- no dependencies)

- [POL-1] Cart item smooth expand + product detail from API | est: ~6k tokens
- [POL-3] Pipeline timing instrumentation | est: ~7k tokens
- [POL-5] ARCHITECTURE.md document | est: ~5k tokens

## Tier 2 (parallel -- no dependencies on Tier 1)

- [POL-2a] Dietary restrictions types + preferences storage + UI component | est: ~7k tokens
- [POL-4] Prefetch on page load with React context + "Data ready" indicator | est: ~7k tokens
- [POL-6] Recipe browser step in demo page | est: ~6k tokens

## Tier 3 (depends on Tier 2)

- [POL-2b] Dietary restrictions prompt injection (meal-planner + order-analyst) | est: ~6k tokens | depends: POL-2a
- [POL-2c] Dietary restrictions wiring in orchestrate route + accumulated memory | est: ~6k tokens | depends: POL-2a

## Tier 4 (depends on Tier 3)

- [POL-INT] Integration smoke test -- full pipeline with dietary + timing + prefetch | est: ~6k tokens | depends: POL-2b, POL-2c, POL-3, POL-4
- [POL-FIX] Build verification + lint fix pass | est: ~6k tokens | depends: POL-INT


---

## Task Details

### [POL-1] Cart item smooth expand + product detail from API

**Files:**
- `src/components/cart-item.tsx` (modify)
- `src/lib/picnic/product-detail.ts` (new)

**Work:**
1. Wrap the expandable detail section in `<AnimatePresence>` + `motion.div` with height auto-animation (the project already uses `motion/react`)
2. Create `src/lib/picnic/product-detail.ts` exporting `fetchProductDetail(sellingUnitId: string)` that calls the existing Picnic API endpoint `hackathon-get-product?selling_unit_id=X`
3. Add a module-level `Map<string, ProductDetail>` cache so each product is fetched at most once
4. In the expanded section of `CartItemRow`, trigger the fetch on first expand. Show a skeleton/spinner while loading. On success, render: large image, description, nutritional info (if present), brand, unit quantity
5. Handle fetch errors gracefully (fall back to existing static detail view)

**Acceptance:**
- Expanding/collapsing a cart item animates smoothly (no layout jump)
- Product detail is fetched from the API on first expand
- Subsequent expands use cached data (no network request)
- Build compiles with no errors

---

### [POL-3] Pipeline timing instrumentation

**Files:**
- `src/app/api/orchestrate/route.ts` (modify)
- `src/components/pipeline-view.tsx` (modify)
- `src/hooks/use-orchestration.ts` (modify)
- `src/types/index.ts` (modify -- extend AgentEvent or agent-status data)

**Work:**
1. In `route.ts`, wrap each pipeline step (prefetch, order-analyst, meal-planner, schedule-agent, budget-optimizer, orchestrator) with `Date.now()` before/after
2. Send `durationMs` in agent-status events: `{ agent, status: "complete", message, durationMs }`
3. In `use-orchestration.ts`, store `durationMs` on agent state when received
4. In `pipeline-view.tsx`, display duration next to each completed step title: e.g. "Order Analyst -- 2.3s"
5. After all steps complete, show total pipeline duration at the bottom of the timeline bar
6. Format: show milliseconds for <1s steps, seconds with 1 decimal for longer steps

**Acceptance:**
- Each pipeline step shows its wall-clock duration after completion
- Total pipeline duration is visible
- Duration data comes from actual server-side measurements
- Build compiles

---

### [POL-5] ARCHITECTURE.md document

**Files:**
- `ARCHITECTURE.md` (new, project root)

**Work:**
1. Write a clear, concise architecture document covering:
   - System overview: grocery agent with 5 specialized LLM agents
   - "Fat context" pattern: why LLMs never call tools, all data pre-injected into prompts
   - Agent decomposition: why 5 agents (order-analyst, meal-planner, budget-optimizer, schedule-agent, orchestrator) instead of one monolithic prompt
   - Conditional branching: budget-optimizer only runs when estimated cost exceeds stated budget
   - Parallel execution: order-analyst, meal-planner, and schedule-agent run concurrently
   - Data flow diagram (text/ASCII): user input -> intent parsing -> prefetch -> parallel agents -> budget check -> cart assembly
   - OpenClaw primitive mapping (if applicable)
   - Performance characteristics: order analysis <50ms (pure computation), LLM calls ~2-3s each, total pipeline ~15s, 100 orders analyzed in-memory
   - Accumulated memory: preference learning across sessions
   - Trade-offs: latency vs. accuracy, fat context vs. tool-calling, cost of parallel LLM calls
2. Keep it under 200 lines. No emojis. Professional tone.

**Acceptance:**
- File exists at project root
- All listed topics are covered
- Text-based data flow diagram is included
- No emojis

---

### [POL-2a] Dietary restrictions types + preferences storage + UI component

**Files:**
- `src/types/index.ts` (modify -- add dietary fields to ParsedIntent and Preferences)
- `src/components/dietary-filter.tsx` (new)
- `src/lib/memory/preferences.ts` (modify -- add dietary to Preferences defaults and persistence)
- `src/app/page.tsx` (modify -- render DietaryFilter and wire state)

**Work:**
1. Add `dietaryRestrictions` field to `ParsedIntent`: `dietaryRestrictions: DietaryRestriction[]` where `DietaryRestriction = "vegetarian" | "vegan" | "gluten-free" | "lactose-free" | "low-sugar" | "halal"`
2. Add `dietaryRestrictions: DietaryRestriction[]` to `Preferences` interface and default it to `[]` in `getDefaultPreferences()`
3. Create `DietaryFilter` component: a row of toggleable chips/checkboxes for each dietary option. Clean, minimal design matching existing UI. Placed below the input bar or as a collapsible settings row
4. In `page.tsx`, manage dietary state, persist to preferences on change, pass to orchestrate call

**Acceptance:**
- Dietary restriction type is defined
- UI shows selectable dietary options
- Selections persist across page reloads (via preferences file)
- Build compiles

---

### [POL-4] Prefetch on page load with React context + "Data ready" indicator

**Files:**
- `src/app/page.tsx` (modify)
- `src/lib/picnic/prefetch.ts` (modify -- expose a client-callable prefetch trigger)
- New: `src/app/api/prefetch/route.ts` (API route to trigger server-side prefetch)

**Work:**
1. Create a lightweight `/api/prefetch` GET endpoint that calls `prefetchAll()` and returns `{ ok: true, cachedAt: timestamp }`. This warms the server-side cache
2. On page mount (`useEffect`), fire a `fetch('/api/prefetch')` call in the background
3. Track prefetch status in state: `"loading" | "ready" | "error"`
4. Show a subtle indicator near the input bar: small dot or text "Data ready" that fades in when prefetch completes
5. When orchestrate runs, the server-side `prefetchAll()` hits the warm cache (no extra latency)
6. Handle errors silently (prefetch is best-effort; orchestration still works without it)

**Acceptance:**
- Opening the page triggers background data prefetch
- "Data ready" indicator appears after prefetch completes
- Orchestration is faster when prefetch has completed first
- No visible loading state blocks the UI
- Build compiles

---

### [POL-6] Recipe browser step in demo page

**Files:**
- `src/components/demo/step-recipes.tsx` (new)
- `src/app/demo/page.tsx` (modify -- add recipe step between analysis and agent DAG)

**Work:**
1. Create `StepRecipes` component showing 5-6 recipe cards in a grid/carousel layout
2. Each card: recipe image (from `PicnicRecipe.imageUrl`), name, portion size, dietary tags (if available), ingredient count
3. Highlight cards that match the demo user's request (visual indicator like a border or badge)
4. Use mock/static recipe data consistent with what the Picnic API returns (reference `src/types/index.ts` PicnicRecipe)
5. Add the step to `demo/page.tsx` in the correct position (between the analysis step and the agent DAG step)
6. Match existing demo page styling conventions (look at sibling step components for patterns)

**Acceptance:**
- Demo page shows a recipe browser step
- Recipe cards display image, name, portions, and dietary info
- Step integrates cleanly with existing demo page flow
- Build compiles

---

### [POL-2b] Dietary restrictions prompt injection (meal-planner + order-analyst)

**Files:**
- `src/lib/prompts/meal-planner.ts` (modify)
- `src/lib/prompts/order-analyst.ts` (modify)

**Work:**
1. Accept `dietaryRestrictions: DietaryRestriction[]` parameter in both prompt builder functions
2. When non-empty, inject a dietary constraints section into the system prompt:
   - Meal planner: "The user has the following dietary restrictions: [list]. Only suggest meals that comply. Filter Picnic recipes by dietary tags. If a recipe conflicts, exclude it."
   - Order analyst: "The user has the following dietary restrictions: [list]. Do not recommend items that conflict with these restrictions. Flag any current cart items that may conflict."
3. When empty, omit the section entirely (no "no restrictions" noise)

**Acceptance:**
- Meal planner prompt includes dietary constraints when present
- Order analyst prompt includes dietary constraints when present
- Prompts are clean and uncluttered when no restrictions are set
- Build compiles

---

### [POL-2c] Dietary restrictions wiring in orchestrate route + accumulated memory

**Files:**
- `src/app/api/orchestrate/route.ts` (modify)
- `src/lib/memory/preferences.ts` (modify if needed)

**Work:**
1. Accept `dietaryRestrictions` in the orchestrate request body
2. Pass dietary restrictions to the meal-planner and order-analyst agent calls
3. On each orchestration run, merge incoming dietary restrictions into the saved preferences (accumulated memory). If user adds "vegan", it stays for future runs. If user explicitly removes it, update accordingly
4. Load saved dietary restrictions from preferences when none are passed in the request

**Acceptance:**
- Dietary restrictions flow from frontend through API to agent prompts
- Restrictions are persisted across sessions
- Previously saved restrictions are used when not explicitly provided
- Build compiles

---

### [POL-INT] Integration smoke test -- full pipeline with dietary + timing + prefetch

**Files:**
- All modified files (read-only verification)

**Work:**
1. Verify the project builds cleanly: `npm run build` (or equivalent)
2. Fix any TypeScript errors, missing imports, or type mismatches introduced by the above tasks
3. Verify the SSE event format is consistent (timing data does not break existing event parsing in `use-orchestration.ts`)
4. Verify dietary filter state flows correctly: UI -> API -> prompts
5. Verify prefetch endpoint returns successfully
6. Check that the demo page renders the new recipe step without errors

**Acceptance:**
- `npm run build` succeeds with zero errors
- No TypeScript type errors
- All new components render without runtime crashes

---

### [POL-FIX] Build verification + lint fix pass

**Files:**
- Any files with lint/build issues

**Work:**
1. Run the full build and lint suite
2. Fix any remaining lint warnings or errors
3. Ensure all imports are correct and no unused variables remain
4. Final commit with clean build output

**Acceptance:**
- Clean build with zero errors and zero warnings
- All tasks committed separately as required


---

## Dependency Graph

```
Tier 1:  POL-1    POL-3    POL-5
         (cart)   (timing) (docs)

Tier 2:  POL-2a   POL-4    POL-6
         (diet    (prefetch)(recipes)
          types)

Tier 3:  POL-2b   POL-2c
         (prompts)(route)
            \       /
             \     /
Tier 4:     POL-INT
               |
            POL-FIX
```

## Coverage

- POL-1 -> POL-1 (smooth animation, product detail API, caching)
- POL-2 -> POL-2a (types, UI, preferences), POL-2b (prompt injection), POL-2c (route wiring, memory)
- POL-3 -> POL-3 (timing instrumentation, display)
- POL-4 -> POL-4 (prefetch on load, cache, indicator)
- POL-5 -> POL-5 (architecture document)
- POL-6 -> POL-6 (recipe browser demo step)

## Execution Notes

- Tier 1 tasks are fully independent and can run in parallel (3 tasks)
- Tier 2 tasks are independent of each other but POL-2a must complete before POL-2b/POL-2c
- POL-4 and POL-6 have no dependency on POL-2a, so they can run in parallel with it
- POL-2b and POL-2c can run in parallel with each other (both depend only on POL-2a)
- POL-INT validates everything works together before the final fix pass
- Estimated wall-clock time with parallelism: ~2.5 hours (vs ~3 hours sequential)
