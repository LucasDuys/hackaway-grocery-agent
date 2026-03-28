---
spec: final-round
total_tasks: 8
estimated_tokens: 52000
depth: standard
---

# Final Round Frontier

## Tier 1 (parallel -- no dependencies)

- [T001] Update intent parser for free-form meal detection | est: ~8k tokens
- [T002] Update ParsedIntent schema for goal-based meals | est: ~4k tokens
- [T003] Verify mock data quality and print stats | est: ~5k tokens
- [T004] Update ARCHITECTURE.md with final feature set | est: ~5k tokens

## Tier 2 (depends on Tier 1)

- [T005] Update orchestrate route: search queries + product search for free-form requests | est: ~9k tokens | depends: T001, T002
- [T006] Update meal planner prompt for goal-based meal planning | est: ~7k tokens | depends: T002

## Tier 3 (depends on Tier 2)

- [T007] End-to-end test: free-form meal request produces non-empty cart | est: ~6k tokens | depends: T005, T006
- [T008] Update demo presentation slides with final features | est: ~8k tokens | depends: T004

---

## Task Details

### T001 -- Update intent parser for free-form meal detection
**Files**: `src/lib/agents/intent-parser.ts`
**What**: Modify the intent parser system prompt to detect three new request categories:
1. **Nutritional goal requests** ("high protein", "low carb", "150g protein per day") -- synthesize daily meals for Mon-Sun with dish set to the goal description (e.g. dish="high protein meal")
2. **Category requests** ("chocolate snacks", "healthy breakfasts") -- add to `specialRequests` AND synthesize a meal entry if it implies cooking, or mark as product search if it implies packaged goods
3. **Full week planning** ("plan my meals for the week") -- synthesize 7 meals with dish="varied weeknight dinner" or similar generic placeholder
**Key rule**: When no specific dish names are found but the user clearly wants meal planning, the parser MUST still populate `intent.meals` with synthetic entries so the downstream meal planner activates.

### T002 -- Update ParsedIntent schema for goal-based meals
**Files**: `src/lib/agents/schemas.ts`, `src/types/index.ts`
**What**: Add an optional `goalBased` boolean to each meal entry in `parsedIntentSchema` and `ParsedIntent` type. This flag tells downstream agents the dish name is a goal/category rather than a named recipe. Also add an optional `productSearchQueries` string array to `ParsedIntent` for direct product search requests like "chocolate snacks" -> `["chocolade", "chocolate"]`.

### T003 -- Verify mock data quality and print stats
**Files**: `scripts/seed-orders.ts`, `src/data/mock-orders.json`
**What**: Write or update a verification script that:
- Checks all image hashes are 64 chars
- Checks product IDs exist in the catalog
- Validates weekly cadence over ~2 years (roughly 100 orders)
- Prints stats: unique products, avg items/order, avg spend/order
- Fix any issues found in the seed script or mock data

### T004 -- Update ARCHITECTURE.md with final feature set
**Files**: `ARCHITECTURE.md`
**What**: Read current ARCHITECTURE.md and update/add sections for: dietary restriction support, preference memory system, proactive notifications, live price search via Picnic API, pipeline timing instrumentation, free-form meal planning (the FIX-1 feature), and guest-specific dietary restrictions. Keep the document structure consistent with existing style.

### T005 -- Update orchestrate route: search queries + product search for free-form requests
**Files**: `src/app/api/orchestrate/route.ts`
**What**:
1. After intent parsing, check if `intent.productSearchQueries` has entries -- if so, add those to the `searchQueries` array for prefetch
2. When meals are goal-based, generate relevant Dutch search terms for the Picnic API: "high protein" -> `["kip", "ei", "tonijn", "kwark", "cottage cheese"]`, "chocolate snacks" -> `["chocolade", "koek", "reep"]`
3. For snack/product-only requests from `specialRequests`, search Picnic products directly and add matched products as "suggestion" items to the cart
4. Fix the `isAutoMode` check: currently `intent.meals.length === 0 && intent.guestEvents.length === 0` triggers auto mode, but with T001 synthetic meals this should no longer fire for free-form requests. Add a check for `specialRequests.length > 0` as well.

### T006 -- Update meal planner prompt for goal-based meal planning
**Files**: `src/lib/prompts/meal-planner.ts`
**What**: Add a conditional block in `buildMealPlannerPrompt` that activates when any meal has `goalBased: true`:
- Instead of "find a recipe matching this dish name", instruct the LLM to "build a custom meal from the product catalog that satisfies the goal"
- For nutritional goals: filter/prefer products by nutritional content (protein, carbs) using product data
- For category goals: use product names to infer category fit
- Add 2-3 prompt examples showing goal-based meal construction
- Instruct the LLM to suggest 3-7 meals depending on request scope (single day vs full week)

### T007 -- End-to-end test: free-form meal request produces non-empty cart
**Files**: New test file or manual verification
**What**: Verify the full pipeline works for the critical test case: "high protein meal week, 150g protein per day, budget 100 euros, some chocolate snacks". Confirm:
- Intent parser produces synthetic meals and product search queries
- Orchestrator does NOT enter auto mode
- Meal planner receives products and generates meals
- Cart contains both meal ingredients and chocolate snack products
- Budget constraint is respected

### T008 -- Update demo presentation slides with final features
**Files**: `src/components/demo/step-summary.tsx`, `src/components/demo/step-analysis.tsx`, `src/components/demo/step-budget-conflict.tsx`, and other `src/components/demo/*.tsx` as needed
**What**:
- Summary slide: add dietary awareness, preference learning, scale stats ("100 orders analyzed in <50ms")
- Analysis step: mention nutritional filtering capability
- Budget conflict step: mention max 3 swaps, protected items behavior
- Add scale/performance callout where appropriate

---

## Coverage

- FIX-1a (intent parser) -> T001, T002
- FIX-1b (orchestrate route) -> T005
- FIX-1c (meal planner prompt) -> T006
- FIX-1d (product search for snacks) -> T005
- FIX-1 (end-to-end verification) -> T007
- SCALE-1 (mock data quality) -> T003
- SCALE-2 (ARCHITECTURE.md) -> T004
- SCALE-3 (demo presentation) -> T008
