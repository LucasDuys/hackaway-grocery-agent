# Architecture -- Weekly Shop Agent

## System Overview

One sentence in, full grocery cart out. A multi-agent orchestration system that coordinates five specialized AI agents to automate a household's weekly Picnic grocery shop -- analyzing purchase history, planning meals, selecting delivery slots, enforcing budget constraints, and assembling the final cart, all with visible reasoning streamed to the user in real time.

## Why "Fat Context" (No Tool Calling)

LLMs in this system never call APIs. All external data -- order history, favorites, delivery slots, product catalog, recipe search results -- is prefetched in parallel via pure TypeScript before any LLM is invoked. The pre-computed data is packed into each agent's prompt as structured context.

This is a deliberate architectural choice over the conventional agent-with-tools pattern:

- **Faster**: No round-trip latency. A tool-calling agent might make 5-10 sequential API calls mid-reasoning, each adding 200-500ms. Fat context makes one LLM call per agent with everything it needs already present.
- **More reliable**: Tool calls can fail mid-reasoning (auth expiry, rate limits, network errors). A failed tool call corrupts the agent's chain of thought with no clean recovery path. With fat context, the LLM either gets all the data or none -- failure is caught before reasoning begins.
- **Cheaper**: One `generateObject()` call per agent instead of multiple tool-calling iterations. GPT-4.1-mini with a 4K-token structured context costs less than 3-5 tool-calling rounds on the same model.
- **More deterministic**: The LLM receives identical context every time for the same input data. Tool-calling agents can produce different results depending on which tools they decide to invoke and in what order.

The trade-off: context windows must be large enough to hold prefetched data. For grocery orders (typically 15-30 items per order, 20 orders), this fits comfortably within 8K tokens of structured context.

## Why 5 Agents (Not 1 Monolithic Prompt)

A single prompt that simultaneously analyzes order history, plans meals, picks delivery slots, enforces budget, and explains its reasoning produces mediocre output across all tasks. Splitting into specialized agents yields better results for three reasons:

1. **Specialized prompts produce higher-quality output**. Each agent has a focused system prompt with persona, edge cases, and few-shot examples tuned for one task. The Order Analyst prompt knows how to interpret "bought 12 of last 15 weeks" as a staple. The Budget Optimizer prompt knows substitution rules (max 3 swaps, never remove staples or recipe ingredients). A monolithic prompt cannot carry this depth for all five tasks without degrading.

2. **Parallel execution saves wall-clock time**. After the Order Analyst completes, the Meal Planner and Schedule Agent run concurrently via `Promise.all()`. This saves approximately 3 seconds per request compared to sequential execution.

3. **Conditional branching avoids unnecessary work**. The Budget Optimizer only runs when the cart exceeds the budget. In the common case (cart is within budget), this skips an entire LLM call. This demonstrates real multi-agent decision-making, not a fixed linear pipeline.

### Agent Responsibilities

```
Order Analyst        Reads 20 orders of purchase history. Identifies staples
                     (bought in 70%+ of orders), calculates replenishment scores,
                     detects co-purchase patterns. Outputs a recommended base cart
                     with behavioral evidence for each item. Respects dietary
                     restrictions -- filters out items that violate active filters.

Meal Planner         Takes the user's meal requests ("lasagna Wednesday, friends
                     Saturday") or goal-based requests ("high protein week") and
                     maps them to real Picnic recipes and products. Cross-references
                     with the base cart to avoid duplicates. Adjusts portions for
                     guest events. Supports free-form goal-based planning, not just
                     named dishes.

Schedule Agent       Analyzes historical delivery patterns (preferred day of week,
                     time window) and selects the optimal available delivery slot.
                     Falls back to earliest available if no pattern is detected.

Budget Optimizer     Only activated when merged cart exceeds stated budget.
                     Identifies the highest-cost non-essential items, finds cheaper
                     alternatives from the product catalog, and applies up to 3
                     substitutions or removals. Never touches staples or recipe
                     ingredients. This is the key demo moment -- visible negotiation
                     between agents.

Orchestrator         Coordinates the full pipeline. Parses user intent, triggers
                     prefetch, dispatches agents, merges outputs, resolves conflicts
                     (e.g., duplicate items from base cart and meal plan), runs the
                     deterministic budget guarantee loop, and streams the final
                     summary to the user.
```

## Dietary Restriction Support

The system supports seven dietary categories: vegetarian, vegan, gluten-free, lactose-free, low-sugar, halal, and nut-free. Dietary filters are guest-specific and persistent across sessions.

**Data flow:**

1. **UI**: The `DietaryFilter` component renders toggle pills in the input bar. Users select restrictions before submitting their request.
2. **Request**: Selected restrictions are sent as `dietaryRestrictions: string[]` alongside the user input to the orchestrate API.
3. **Intent merge**: The orchestration route merges UI-selected restrictions into the parsed intent. If the intent parser also detects restrictions from natural language ("no gluten"), both sources are combined.
4. **Agent prompts**: Dietary restrictions are injected into each agent's system prompt context. The Order Analyst filters out items that violate active restrictions. The Meal Planner selects recipes compatible with the restrictions.
5. **Preference persistence**: Active restrictions are saved to `preferences.json` so they carry forward to future sessions without re-selection.

## Preference Memory (Accumulated Learning)

`src/data/preferences.json` persists learned preferences across sessions. After each pipeline run, the system derives and saves:

- **Brand preferences**: When the Budget Optimizer substitutes item A for item B and the user accepts, the system records this brand preference with a timestamp. Future runs inject these preferences into agent prompts so the system proactively uses preferred brands.
- **Budget patterns**: Running average of actual spend, last stated budget, and typical weekly spend. Used as the fallback budget when the user does not specify one.
- **Delivery preferences**: Preferred day of week and time window, learned from delivery slot selections.
- **Dietary restrictions**: Persisted from the most recent run so users do not need to re-select them.
- **Always-include and never-suggest lists**: Items the user explicitly wants every week or explicitly rejects.

Preferences are loaded at the start of each run via `loadPreferences()` and formatted into a `<preferences>` XML block via `formatPreferencesForPrompt()`. This block is injected into agent system prompts, giving each agent household-specific context. On the first run (`runCount === 0`), the preferences block is omitted entirely to avoid empty context.

## Proactive Notification (Periodic Autonomy)

The system tracks days since the last Picnic order. When 7 or more days have passed, a `ProactiveNotification` banner slides in at the top of the UI: "It has been N days since your last order. Ready to prepare your weekly shop?"

The user can either dismiss the notification or tap "Prepare now" to trigger an auto-mode run. In auto mode (no meals specified, no guest events), the agent builds a complete cart purely from purchase patterns -- it knows what you need before you say it.

This implements the OpenClaw **Periodic Autonomy** primitive: the agent initiates action based on temporal triggers rather than waiting for explicit user commands.

## Live Price Verification

LLMs hallucinate prices. The system uses a three-tier verification strategy to ensure every price shown to the user is real:

1. **Catalog lookup**: Each item is matched by `selling_unit_id` against the local product catalog. If found, the catalog price replaces whatever the LLM returned.
2. **Fuzzy name matching**: For items not found by ID (often meal ingredients the LLM invented), the system tokenizes the item name and searches the catalog for partial matches.
3. **Live Picnic API search**: Items still at the fallback price (EUR 2.99) trigger a real-time search against the Picnic API. The system authenticates, queries with the first two words of the item name, and uses the top result's actual price and product ID.

This guarantees that prices shown in the cart reflect real Picnic pricing, not LLM estimates.

## Pipeline Timing

Every agent step is timed with `Date.now()` timestamps. The orchestration route records:

- Intent parsing duration
- Prefetch duration (all 6 parallel API calls)
- Order Analyst duration
- Meal Planner duration (parallel with Schedule Agent)
- Schedule Agent duration
- Budget Optimizer duration (when triggered)
- Total pipeline duration (end-to-end)

Each agent's completion event includes a `durationMs` field. The pipeline view UI displays per-step timing next to each completed step card (e.g., "Parse Intent -- 1.2s"). A total pipeline duration is shown in the timeline header bar.

## Narrative Story Mode

The activity feed supports two display modes toggled by a button:

- **Story mode** (default): Agent events are transformed by `src/lib/narrative.ts` into plain-language explanations. Instead of "SUGGEST: Whole milk -- bought 14/15 orders, replenishment score 0.93", the user sees "Looking at your last 15 orders, you buy Whole milk every week (14 of 15 orders). Adding 1 to your cart." Narrative functions exist for each agent and action type: order analyst suggestions, budget rejections, substitutions, approvals, meal plans, schedule selections, and cart finalization.
- **Log mode**: Raw agent events with action badges (SUGGEST, REJECT, APPROVE, QUERY, SUBSTITUTE) and technical details.

The narrative system dispatches on `(agent, action)` pairs. Each handler extracts structured context (item name, price, quantity, reason) and formats it into a human-readable sentence. If the narrative function throws or context is missing, it falls back to the raw message.

## Agent Data Handoffs (Social Context)

Agents do not share state implicitly. Each handoff is a structured summary emitted as an SSE event with a `from` agent, `to` agent, and summary string:

- **Order Analyst -> Orchestrator**: "14 items, EUR 52.30 estimated"
- **Meal Planner -> Budget Optimizer**: "3 meals, 12 ingredients, EUR 28.50"
- **Schedule Agent -> Orchestrator**: "Delivery: Thursday 18:00-20:00"
- **Budget Optimizer -> Orchestrator**: "No changes, EUR 72.80 within budget" or "3 swaps, saved EUR 8.40"

These handoffs are rendered in the pipeline view as connector arrows between step cards, making agent-to-agent communication transparent. Each handoff includes a plain-language summary so judges can follow the flow of data through the system without reading code.

## Image Integration

Product and recipe images come from two sources:

- **Product images**: Picnic CDN URLs constructed from 64-character SHA-256 image hashes. The `getPicnicImageUrl()` helper in `src/lib/picnic/image.ts` builds URLs in the format `https://storefront-prod.nl.picnicinternational.com/static/images/{hash}/{size}.png`. Sizes are small (100px), medium (200px), and large (400px). Hashes shorter than 60 characters are rejected (truncated hashes return 403 from the CDN). Product images are resolved from the catalog first, then from order history as a fallback.
- **Recipe images**: Retrieved from the Picnic recipe API during prefetch. Matched to meal plan entries by recipe name (exact match first, then fuzzy word matching). Displayed in meal plan summary cards.

## Free-Form Meal Planning

The Meal Planner supports two input styles:

1. **Named dishes**: "lasagna Wednesday, stir fry Thursday" -- the agent maps these to specific Picnic recipes and products.
2. **Goal-based requests**: "high protein week", "healthy lunches", "budget-friendly dinners" -- the intent parser marks these as `goalBased: true`, and the Meal Planner selects appropriate recipes that satisfy the nutritional or budgetary goal rather than matching a specific dish name.

Both styles flow through the same pipeline. Guest events without a matching meal are automatically synthesized ("dinner for 6 guests (birthday party)") and added to the meal list.

## Data Flow

```
User: "Sort this week's shop, lasagna Wed, friends Sat, under 80 euro"
  |
  v
[Intent Parser] -------- LLM call: extract meals, guests, budget,
  |                      dietary restrictions, goal-based requests
  |
  v
[Load Preferences] ----- Read preferences.json from disk               <1ms
  |                      Inject <preferences> block into agent prompts
  |
  v
[Prefetch Layer] ------- Promise.all([
  |                        fetchOrderHistory(20),
  |                        fetchFavorites(),
  |                        fetchCart(),
  |                        fetchDeliverySlots(),
  |                        searchProducts("lasagna"),
  |                        searchRecipes("lasagna"),
  |                      ])                                          ~2s
  |
  v
[Analysis Layer] ------- Pure TypeScript, no LLM                    <50ms
  |                        stapleDetection()
  |                        replenishmentScoring()
  |                        budgetAnalysis()
  |                        coPurchaseRules()
  |                        householdEstimation()
  |
  v
[Order Analyst] -------- generateObject() with Zod schema          ~2-3s
  |                        (dietary restrictions filter applied)
  |
  |--- handoff: recommended items + estimated cost
  |
  v
[Meal Planner] --.------ generateObject() with Zod schema          ~2-3s
[Schedule Agent] '       (run in parallel via Promise.all)
  |       |
  |       '--- handoff: selected delivery slot
  |
  '--- handoff: meals + ingredients + cost
  |
  v
[Orchestrator Merge] --- Deduplicate items, correct prices          <10ms
  |                      from product catalog, calculate total
  |
  v
[Live Price Search] ---- For items without catalog prices:          ~1-2s
  |                      search Picnic API for real prices
  |                      (only for fallback items, not all)
  |
  v
[Budget Check] --------- if (total > budget) {
  |                        [Budget Optimizer] --- generateObject()  ~2-3s
  |                          max 3 substitutions/removals
  |                          never removes staples or recipe items
  |                      }
  |
  v
[Final Budget Guard] --- while (total > budget) {                  <1ms
  |                        remove last non-staple item
  |                      }
  |                      Deterministic guarantee: never exceeds budget.
  |
  v
[Preference Learning] -- Derive and persist preferences             <10ms
  |                      (brand choices, budget patterns,
  |                       delivery preferences, dietary restrictions,
  |                       always-include items)
  |
  v
[SSE Stream] ----------> Split-panel React UI
                          Left: grocery cart with prices, images,
                                + reasoning chips
                          Right: agent activity feed (story/log toggle,
                                 color-coded, animated) or pipeline view
                                 (step cards with timing + handoff arrows)
```

## Conditional Branching

The Budget Optimizer is not a fixed pipeline stage. It activates only when the merged cart total exceeds the user's stated budget (or the average weekly spend if no budget is specified).

```
if (totalCost <= budget) {
    // Skip optimizer entirely -- save an LLM call
    sendEvent("APPROVE", "Cart within budget, no optimization needed");
} else {
    // Run budget optimizer -- the "disagreement" demo moment
    sendEvent("REJECT", "Cart exceeds budget by EUR X.XX");
    optimizedCart = await runBudgetOptimizer(cart, alternatives);
    // Apply substitutions and removals
}
```

This conditional branching demonstrates real multi-agent decision-making. The system adapts its behavior based on intermediate results rather than executing every agent regardless of necessity. When budget optimization does trigger, the REJECT/SUBSTITUTE/APPROVE event sequence creates a visible "negotiation" in the agent activity feed -- the key moment that distinguishes this from a simple API wrapper.

After the LLM-based optimizer, a deterministic `while` loop provides an absolute guarantee that the final cart never exceeds the budget. This loop removes non-staple items one at a time until the total is under budget. The LLM handles the intelligent part (finding good substitutions with reasoning); the loop handles the safety guarantee.

## Parallel Execution

The agent pipeline exploits two parallelism opportunities:

**Prefetch parallelism**: All six Picnic API calls run concurrently via `Promise.all()`. Order history, favorites, cart state, delivery slots, product search, and recipe search execute in parallel rather than sequentially. This reduces prefetch time from approximately 12 seconds (6 x 2s) to approximately 2 seconds.

**Agent parallelism**: After the Order Analyst completes (its output feeds into the Meal Planner), the Meal Planner and Schedule Agent run concurrently:

```typescript
[mealResult, scheduleResult] = await Promise.all([
    runMealPlanner(intent, data, orderResult),
    runScheduleAgent(data, analysis),
]);
```

The Schedule Agent does not depend on meal plan output, so running it in parallel with the Meal Planner saves one full LLM call of wall-clock time (approximately 2-3 seconds).

The Order Analyst runs first because the Meal Planner needs its base cart to avoid duplicate items. This is a deliberate correctness trade-off: full parallelism of all three agents would be faster but would produce carts with redundant items.

## OpenClaw Primitives

This system demonstrates all four OpenClaw architectural primitives:

**Persistent Identity** -- `SOUL.md` defines the agent's persona, values, and behavioral rules. The agent prioritizes routine reliability over novelty, never exceeds stated budgets, protects staple items from removal, and communicates in plain language with behavioral evidence. Each sub-agent's system prompt inherits these values.

**Accumulated Memory** -- `data/preferences.json` persists learned preferences across sessions. After each run, the system derives and saves: brand preferences (from substitution acceptance/rejection), delivery day and time preferences, budget patterns, dietary restrictions, always-include items, and never-suggest items. Subsequent runs load these preferences into agent prompts, so the system improves with use.

**Periodic Autonomy** -- The proactive notification system tracks days since the last order. After 7+ days, a banner prompts the user to reorder. In auto mode (no specific meals or guests), the agent builds a cart from purchase patterns alone -- it knows what you need before you say it.

**Social Context** -- The five agents coordinate through structured data handoffs. Each handoff is a typed summary emitted as an SSE event: Order Analyst passes recommended items and estimated cost to the Orchestrator, Meal Planner passes meals and ingredients to the Budget Optimizer, Schedule Agent passes the selected slot. These handoffs are visible in the pipeline view with connector arrows and plain-language summaries, making agent-to-agent communication transparent to the user and judges.

## Performance Characteristics

| Layer                        | Latency        | Notes                                         |
|------------------------------|----------------|-----------------------------------------------|
| Prefetch (6 API calls)       | ~2s            | Parallel via `Promise.all()`                  |
| Analysis (pure TS)           | <50ms          | Runs on 20 orders, no LLM involved            |
| Order Analyst                | ~2-3s          | Single `generateObject()` via GPT-4.1-mini    |
| Meal Planner                 | ~2-3s          | Parallel with Schedule Agent                  |
| Schedule Agent               | ~2-3s          | Parallel with Meal Planner                    |
| Live Price Search            | ~1-2s          | Only for items without catalog prices          |
| Budget Optimizer             | ~2-3s          | Conditional -- only runs when over budget     |
| Merge + budget guard         | <10ms          | Pure TypeScript, deterministic                |
| Preference learning          | <10ms          | Derive and write to disk                      |
| **Total (with budget opt)**  | **~14-20s**    | End-to-end, user input to final cart           |
| **Total (under budget)**     | **~10-14s**    | Skips budget optimizer entirely               |

Per-step timing is visible in the pipeline view UI. Each completed step card shows its duration (e.g., "Agent Pipeline -- 3.2s"), and the timeline header displays the total pipeline duration.

Budget enforcement is a deterministic guarantee. The `while` loop in the final budget guard removes items until the cart is under budget. The LLM-based optimizer makes intelligent substitutions; the loop provides the safety net. The cart will never exceed the stated budget.

## Trade-offs and Alternatives Considered

**LangGraph** -- Full-featured DAG orchestration framework. Rejected because it adds significant complexity for a 9-hour hackathon build. The learning curve for LangGraph's state management, channels, and conditional edges exceeds the benefit when the DAG has only 5 nodes. Plain `Promise.all()` + conditionals achieves the same execution pattern in 50 lines of TypeScript.

**CrewAI** -- Multi-agent framework with role-based agents. Rejected because it is Python-only (this project uses Next.js/TypeScript) and lacks native DAG support. Sequential agent execution would be the default, losing the parallelism advantage.

**Tool-calling agents** -- The standard pattern where LLMs invoke tools (APIs, databases) during reasoning. Rejected for this use case because it is slower (round-trip latency per tool call), less reliable (tool failures corrupt reasoning chains), and more expensive (multiple LLM iterations per agent instead of one). See "Why Fat Context" above.

**Single monolithic prompt** -- One large prompt that handles all tasks. Rejected because prompt quality degrades when a single prompt must handle pattern analysis, meal planning, budget optimization, and scheduling simultaneously. Specialized agents with focused prompts produce measurably better output. A monolithic prompt also cannot exploit parallelism or conditional branching.

**Mastra** -- TypeScript-native AI agent framework. Considered as the closest fit for the tech stack. Rejected because the fat-context pattern eliminates the need for tool orchestration, which is Mastra's primary value proposition. The framework overhead (agent definitions, workflow configs, middleware) adds complexity without corresponding benefit when each agent is a single `generateObject()` call.

## Technology Stack

| Component          | Technology                          | Role                                    |
|--------------------|-------------------------------------|-----------------------------------------|
| Framework          | Next.js 15 (App Router)             | Full-stack React framework              |
| AI SDK             | Vercel AI SDK 6                     | `generateObject()`, `streamText()`, SSE |
| Styling            | Tailwind CSS 4                      | Utility-first CSS                       |
| Language           | TypeScript (strict mode)            | Type safety across the full stack       |
| LLM (agents)       | GPT-4.1-mini via OpenAI / OpenRouter| Fast, cheap structured output           |
| LLM (synthesis)    | GPT-4.1 for budget optimization     | Better reasoning for cost trade-offs    |
| Grocery API        | Picnic API (REST, curl-based)       | Order history, products, cart, slots    |
| Animation          | Motion (Framer Motion)              | Agent activity feed entry animations    |
| Schema validation  | Zod                                 | Typed LLM output via `generateObject()` |
| Components         | shadcn/ui                           | Accessible UI primitives                |
