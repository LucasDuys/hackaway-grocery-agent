---
spec: fix-and-polish
total_tasks: 8
estimated_tokens: ~60k
depth: standard
created: 2026-03-28
---

# Task Frontier: Fix and Polish

## Critical Bugs

### F001: Budget Optimizer not actually reducing cart
- **Priority**: P0 -- core demo moment is broken
- **Root cause**: The budget optimizer LLM returns `optimizedTotal: 250.03` (same as original) because: (1) the alternatives map is likely empty (no product alternatives fetched), (2) the LLM is not being forced to remove items, only substitute -- but with EUR 170 overage, substitution alone cannot fix this. The optimizer needs to also REMOVE low-priority items to get under budget.
- **Fix**:
  1. When overage > 30% of budget, the optimizer should remove occasional/one-time items first (using analysis data), THEN substitute expensive items
  2. Add a hard constraint: if LLM returns optimizedTotal > budget, run the greedy fallback which actually enforces the budget by removing items
  3. Prefetch product alternatives via `hackathon-get-product-alternatives` for the top 10 most expensive cart items
  4. Pass the analysis classifications (staple/regular/occasional) to the budget optimizer so it knows what to cut vs keep
- **Files**: `src/lib/agents/budget-optimizer.ts`, `src/app/api/orchestrate/route.ts`, `src/lib/prompts/budget-optimizer.ts`
- **Acceptance**: Cart total never exceeds budget in final output. Items are removed/substituted with clear reasoning.

### F002: No delivery slots loaded
- **Root cause**: The hackathon account may not have delivery slots available, or the API returns them in a different format than expected
- **Fix**: Check the raw API response format for delivery slots, handle empty gracefully, generate mock slots as fallback
- **Files**: `src/lib/picnic/prefetch.ts`, `src/lib/agents/schedule-agent.ts`
- **Acceptance**: Schedule agent always has at least mock slots to choose from

### F003: Meal planner suggests same meal for both days
- **Root cause**: The system prompt doesn't explicitly tell the LLM to vary meals across days. "Friends Saturday" should trigger a different (larger) meal than Wednesday lasagna.
- **Fix**: Update meal planner prompt to emphasize variety and different meals per day. Saturday with friends = entertaining meal, not another lasagna.
- **Files**: `src/lib/prompts/meal-planner.ts`
- **Acceptance**: Different meals for different days. Guest events trigger entertaining-appropriate meals.

## UI Overhaul

### F004: Picnic mobile-first UI research + redesign
- **Priority**: P1 -- visual polish for judges
- **Research needed**: Deep dive into Picnic's actual mobile app design (colors, typography, card patterns, navigation, product display)
- **Implementation**:
  1. Mobile-first responsive layout (cart view as primary, agent pipeline as secondary "how it works" view)
  2. Product images from Picnic CDN (image_url hash -> full URL)
  3. Picnic's actual color scheme and visual language
  4. Swipeable/tabbed interface: "Your Cart" tab + "How It Works" tab
  5. Bottom sheet input instead of fixed bottom bar
- **Files**: All component files, globals.css, page.tsx
- **Acceptance**: Looks like it could be a Picnic feature, not a hackathon dashboard

### F005: Agent pipeline visualization overhaul
- **Priority**: P1 -- judges need to understand the architecture
- **Current problem**: DAG visualization is too small and static
- **Fix**:
  1. Full-page "How It Works" view with animated pipeline
  2. Each agent node expandable to show its reasoning
  3. Data flow arrows animate as data moves between agents
  4. Timeline view showing which agents ran when and for how long
  5. Clear labels explaining what each agent does
- **Files**: `src/components/dag-visualization.tsx`, new `src/components/pipeline-view.tsx`
- **Acceptance**: A non-technical person can understand the multi-agent architecture in 10 seconds

## Architecture Explainer

### F006: Interactive architecture diagram / HTML animation
- **Priority**: P2 -- for understanding and demo
- **Description**: Create a standalone page (`/how-it-works`) that explains the full data flow:
  1. User input parsing (show the sentence being broken into intent)
  2. Picnic API data fetching (show which endpoints are called)
  3. Pattern analysis (show the algorithms running on order history)
  4. Agent pipeline (show each agent's input -> processing -> output)
  5. Cart assembly (show items being added to Picnic cart via API)
- **Implementation**: Animated step-by-step walkthrough, no emojis, clean typography
- **Files**: New `src/app/how-it-works/page.tsx`, components
- **Acceptance**: Explains the full system without code knowledge

## Scale Testing

### F007: Full product catalog integration
- **Priority**: P2
- **Description**: Fetch the complete Picnic product catalog (all categories + subcategories + products) and cache it. Use real product data for all recommendations and alternatives.
- **Implementation**:
  1. Paginate through all categories and subcategories
  2. Search products across all categories
  3. Cache in `src/data/product-catalog.json` (already partially done with 499 products)
  4. Use catalog for budget optimizer alternatives lookup
- **Files**: `scripts/seed-orders.ts`, `src/lib/picnic/prefetch.ts`, `src/data/`
- **Acceptance**: Budget optimizer has real alternatives for any product in the cart

### F008: Orq tracing integration for test runs at scale
- **Priority**: P3
- **Description**: Integrate Orq for observability -- log all LLM calls with inputs/outputs, trace the full pipeline, measure latency per agent, store results for comparison
- **Implementation**:
  1. Wrap each `generateObject` call with Orq tracing
  2. Log pipeline runs with success/failure rates
  3. Dashboard showing: avg latency per agent, token usage, accuracy of budget optimizer
  4. Run 10-20 automated test scenarios and show results
- **Files**: `src/lib/ai/tracing.ts`, agent files
- **Acceptance**: Orq dashboard shows pipeline traces with per-agent metrics

## Execution Order

```
F001 (budget fix) ----\
F002 (delivery slots) --> F004 (mobile UI) --> F006 (explainer)
F003 (meal variety)  /                    \--> F005 (pipeline viz)
                                           \--> F008 (orq tracing)
F007 (product catalog) -- independent, start anytime
```

F001-F003 are bugs that block the demo. Fix those first.
F004-F005 are visual polish. Do after bugs.
F006-F008 are nice-to-haves if time permits.
