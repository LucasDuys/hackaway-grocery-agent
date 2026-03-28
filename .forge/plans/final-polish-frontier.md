---
spec: final-polish
total_tasks: 12
estimated_time: ~4 hours
depth: standard
---

# Final Polish Frontier -- Hackaway Demo Day

## Tier 1 (parallel -- no dependencies)

- [FP001] Fix cart item price overlap on swapped items | est: ~20min
  Files: `src/components/cart-item.tsx`
  Problem: The `reasoning` field on substituted items contains "EUR X.XX" text that renders
  as a full paragraph below the item name. When long, it visually overlaps the price column.
  Fix:
  - Truncate `item.reasoning` for substituted items to show only a short label like
    "Swapped from [original name]" (strip pricing from reasoning text)
  - OR hide reasoning entirely for substituted items and rely on the "swap" ReasoningChip
  - Ensure the price `<span>` on the right always shows the NEW price only, no original
  - Remove the `bg-amber-50/30` salmon tint from substituted items; replace with a
    subtle `border-l-4 border-amber-400` left accent instead

- [FP002] Expand product categorization beyond keyword matching | est: ~30min
  Files: `src/components/cart-view.tsx`
  Problem: `categorizeItem()` uses ~30 hardcoded English keywords. Dutch product names
  (e.g. "Halfvolle melk", "Kipfilet", "Brood volkoren") fall through to "other".
  Fix:
  - Add comprehensive Dutch grocery keywords for each category:
    - produce: groente, fruit, sla, komkommer, paprika, aardappel, ui, wortel, peer, aardbei,
      druiven, courgette, broccoli, bloemkool, champignon, sperziebonen, etc.
    - dairy: melk, kaas, yoghurt, boter, room, ei, eieren, kwark, vla, etc.
    - proteins: kip, kipfilet, gehakt, worst, vis, zalm, garnalen, ham, spek, etc.
    - pantry: brood, rijst, pasta, meel, olie, saus, suiker, koffie, thee, chips,
      koek, muesli, havermout, pindakaas, jam, hagelslag, etc.
  - Add new categories: "drinks" (water, sap, bier, wijn, cola, frisdrank, limonade)
    and "frozen" (diepvries, ijs, pizza)
  - Add a "snacks" category (chips, noten, koek, chocolade, snoep)
  - Fallback: if still "other", try matching the first word against all category keywords

- [FP003] Fix meal planner dropping second meal request | est: ~30min
  Files: `src/lib/agents/intent-parser.ts`, `src/lib/prompts/meal-planner.ts`
  Problem: Input "lasagna Wednesday, friends Saturday, under 80 euro" produces only 1 meal.
  Root cause analysis:
  1. Intent parser may be putting "friends Saturday" only in `guestEvents` but not in `meals`.
     The meal planner only iterates `intent.meals` for planning -- it ignores `guestEvents`
     that don't have an explicit dish.
  2. The meal planner prompt says "For each meal the user requested (see user_intent.meals)"
     but guest events without a named dish never appear in meals[].
  Fix:
  - In the meal planner prompt, add explicit instruction: "Also plan a meal for each
    guestEvent that does not already have a matching meal. Choose an appropriate social
    meal for the occasion."
  - In `route.ts`, after intent parsing, synthesize a meal entry for each guestEvent
    that has no corresponding meal on the same day. E.g., if guestEvents has
    `{day: "Saturday", guestCount: 4}` but meals[] has no Saturday entry, add
    `{day: "Saturday", dish: "dinner for friends"}` to intent.meals.
  - Verify the mealPlannerSchema allows 2+ meals (it does -- z.array, no max).

- [FP004] Fix budget optimizer aggressiveness (9 swaps -> 2-3 max) | est: ~40min
  Files: `src/lib/prompts/budget-optimizer.ts`, `src/lib/agents/budget-optimizer.ts`
  Problem: The optimizer substitutes 9 items when only 2-3 swaps are needed to hit budget.
  The prompt encourages maximum substitution without a cap. The fallback/enforcement layers
  also aggressively substitute before removing.
  Fix:
  - Add to prompt instructions: "CRITICAL CONSTRAINT: Make at most 3 substitutions.
    If 3 swaps cannot bring the cart under budget, REMOVE low-priority items instead.
    Users hate having their entire cart changed -- minimal changes build trust."
  - Add to prompt: "NEVER swap items that are part of a meal plan (reasonTag: recipe).
    NEVER swap staple items. Only swap regular/occasional items."
  - In `budget-optimizer.ts`, add a hard cap: after receiving LLM result, if
    adjustments.length > 5, keep only the top 3 by savings and re-run enforcement
    for the remainder via removal.
  - Update the `enforceHardBudget` function: limit substitution pass to max 3 items,
    then go straight to removal for the rest.

## Tier 2 (depends on Tier 1)

- [FP005] Integrate FP003 + FP004 into orchestrator route | est: ~30min
  Files: `src/app/api/orchestrate/route.ts`
  Depends: FP003, FP004
  Changes:
  - After `parseIntent()`, add guestEvent-to-meal synthesis logic (from FP003)
  - Pass `reasonTag` information through to budget optimizer so it can protect
    recipe items from being swapped
  - Update the `mergeCartItems` function to tag meal-planner items with their
    source meal name in the reasoning field (e.g., "For Lasagna (Wednesday)")
  - Update SSE event for meal planner to correctly report meal count including
    guest-event-derived meals
  - In the final budget check (Step 7), prefer removing non-recipe items first

- [FP006] Clean up pipeline step card styling | est: ~20min
  Files: `src/components/pipeline-view.tsx`
  Depends: FP001
  Changes:
  - The `StepCard` status colors use `bg-green-50`, `bg-blue-50`, `bg-red-50` which
    look like colored backgrounds on the cards. Change to:
    - All cards: `bg-white` with `border-[var(--border)]`
    - Status indicator: colored left border (4px) instead of background tint
    - Complete: `border-l-4 border-green-500`
    - Running: `border-l-4 border-blue-500`
    - Error: `border-l-4 border-red-500`
    - Pending: `border-l-4 border-gray-200`
  - Remove the `ring-1 ring-blue-200` on running cards
  - The status badge should remain as-is (small pill, good contrast)
  - Ensure expanded detail section has no colored background

## Tier 3 (depends on Tier 2)

- [FP007] Auto Cart mode (no-params replenishment) | est: ~45min
  Files: `src/app/api/orchestrate/route.ts`, `src/hooks/use-orchestration.ts`,
         `src/lib/agents/intent-parser.ts`
  Depends: FP005
  Changes:
  - Detect mode from parsed intent: if `meals.length === 0` AND `guestEvents.length === 0`
    AND `budget === null` AND `specialRequests.length === 0`, this is Auto Cart mode.
    Also trigger on phrases like "sort my shop", "weekly shop", "auto", "restock".
  - In Auto Cart mode:
    - Skip meal planner entirely (sendAgentStatus "meal-planner" -> "complete" with "Skipped")
    - Order analyst drives the full cart based on replenishment scores
    - Budget defaults to `analysis.budget.avgWeeklySpend` (already happens)
    - Schedule agent picks the usual delivery pattern
  - In Custom Cart mode (any meals, events, or budget specified):
    - Full pipeline as currently implemented (with FP003/FP004 fixes)
  - Add mode indicator to SSE events: `send({ type: "mode", data: { mode: "auto" | "custom" } })`
  - Update `use-orchestration.ts` to receive and expose `mode` state

- [FP008] Mode indicator in UI + input suggestions | est: ~25min
  Files: `src/app/page.tsx`, `src/components/input-bar.tsx`, `src/components/header.tsx`
  Depends: FP007
  Changes:
  - Show detected mode badge in header or above cart: "Auto Cart" or "Custom Cart"
  - In the empty state (no cart yet), show two example prompts as clickable chips:
    - "Sort my weekly shop" (auto mode)
    - "Lasagna Wednesday, friends Saturday, under EUR 80" (custom mode)
  - Clicking a chip fills the input bar and submits
  - Input bar placeholder: "What are your plans this week?" (already close to this)

## Tier 4 (depends on Tier 3)

- [FP009] Mobile responsiveness pass | est: ~30min
  Files: `src/components/split-panel-layout.tsx`, `src/components/input-bar.tsx`,
         `src/app/page.tsx`, `src/components/cart-view.tsx`
  Depends: FP001, FP006, FP008
  Changes:
  - `SplitPanelLayout`: on mobile (<768px), stack vertically -- cart on top,
    pipeline below (collapsible accordion)
  - `InputBar`: sticky at bottom of viewport on mobile (`fixed bottom-0 left-0 right-0`)
    with safe-area padding for iOS
  - `CartView`: add bottom padding equal to input bar height so last items aren't hidden
  - Cart items: ensure text doesn't overflow on narrow screens (already using truncate,
    verify with long Dutch product names)
  - Pipeline view on mobile: collapse to a simple progress bar + expandable accordion
  - Test: verify no horizontal scroll on 375px width

- [FP010] Wire orq.ai tracing into agent calls | est: ~30min
  Files: `src/lib/ai/tracing.ts`, `src/lib/agents/intent-parser.ts`,
         `src/lib/agents/order-analyst.ts`, `src/lib/agents/meal-planner.ts`,
         `src/lib/agents/budget-optimizer.ts`, `src/lib/agents/schedule-agent.ts`,
         `src/app/api/orchestrate/route.ts`
  Depends: FP005
  Changes:
  - The tracing module (`tracing.ts`) is already built but not wired in. Each agent
    currently uses `generateObject()` from Vercel AI SDK directly.
  - Option A (minimal, recommended for demo day): Add a wrapper that logs trace data
    alongside the existing `generateObject` calls -- call `traceAgentCall` in parallel
    with the real call just for observability, or log after the fact.
  - Option B (full): Replace `generateObject` calls with `traceAgentCallJSON` for each
    agent. This requires mapping schemas to raw JSON parsing.
  - For demo day, Option A is safer. Add a `createSessionId()` call at the top of the
    POST handler, pass it through to each agent, and log traces if `ORQ_API_KEY` is set.
  - Gracefully skip tracing if env var is missing (already has `ORQ_API_KEY` check pattern).

## Tier 5 (final -- depends on everything)

- [FP011] End-to-end smoke test + demo script | est: ~30min
  Files: new file `scripts/demo-test.sh` or manual checklist
  Depends: FP001-FP010
  Changes:
  - Run the app with demo mode ON
  - Test Auto Cart mode: "sort my weekly shop"
    - Verify: no meal planning step, reasonable cart, under average budget
  - Test Custom Cart mode: "lasagna Wednesday, friends Saturday, under 80 euro"
    - Verify: 2 meals planned (lasagna + social meal), budget enforced, max 3 swaps
  - Test edge cases:
    - Very tight budget: "weekly shop, under 30 euro"
    - No budget: "just my usual stuff"
  - Verify: no items in "OTHER" category (or max 2-3)
  - Verify: cart item prices display cleanly, no red overlap
  - Verify: pipeline cards use clean white styling
  - Verify: mobile viewport (375px) looks usable
  - Write a 2-minute demo script for live narration

- [FP012] Pre-record demo video | est: ~30min
  Depends: FP011
  Changes:
  - Screen record the best test run at 1080p
  - Record both Auto Cart and Custom Cart scenarios
  - Capture the pipeline panel showing agent reasoning (this is the creativity differentiator)
  - Keep under 3 minutes total
  - Export as MP4 for backup during presentation


## Time Budget

| Tier | Tasks | Estimated Time | Parallel? |
|------|-------|---------------|-----------|
| 1 | FP001, FP002, FP003, FP004 | ~40min (parallel) | Yes |
| 2 | FP005, FP006 | ~30min (parallel) | Yes |
| 3 | FP007, FP008 | ~45min (sequential) | Partially |
| 4 | FP009, FP010 | ~30min (parallel) | Yes |
| 5 | FP011, FP012 | ~60min (sequential) | No |
| **Total** | **12 tasks** | **~3.5 hours** | |

Buffer: ~30min for unexpected issues = **4 hours total**


## Priority Triage (if running out of time)

**Must ship (blocks demo):** FP001, FP003, FP004, FP005, FP011
- These fix the visible bugs: price overlap, missing meal, aggressive optimizer

**Should ship (improves score):** FP002, FP006, FP007, FP008
- Categories, clean UI, two-mode feature (judges will notice)

**Nice to have (bonus points):** FP009, FP010, FP012
- Mobile polish, tracing, pre-recorded video


## Coverage

- FIX-1 (price display) -> FP001
- FIX-2 (budget optimizer) -> FP004, FP005
- FIX-3 (categorization) -> FP002
- FIX-4 (meal planner 1 meal) -> FP003, FP005
- MODE-1 (auto cart) -> FP007, FP008
- MODE-2 (custom cart) -> FP003, FP005, FP007 (custom is the current flow, fixed)
- UI-1 (cart item rendering) -> FP001
- UI-2 (pipeline cards) -> FP006
- UI-3 (mobile) -> FP009
- TRACE-1 (tracing) -> FP010
- Demo prep -> FP011, FP012
