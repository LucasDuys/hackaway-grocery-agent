---
domain: grocery-orchestrator
status: approved
created: 2026-03-28
complexity: complex
linked_repos: []
---

# Grocery Orchestrator Spec

## Overview

Multi-agent grocery orchestration system for Picnic's automated weekly shop. User says one sentence ("Sort this week's shop, lasagna Wednesday, friends Saturday, keep it under 80 euro"), 5 specialized prompt configurations analyze order history, plan meals, optimize budget, pick delivery slots, and build a complete cart -- all with visible reasoning.

Architecture: "Fat Context" pattern. All Picnic API data is prefetched in parallel (pure code). Pattern analysis runs as pure TypeScript (no LLM). LLM steps receive pre-computed data as structured context and do reasoning only. No tool calling from LLMs.

Tech stack: Next.js + Vercel AI SDK (`generateObject`/`streamText`) + Tailwind + shadcn/ui. Custom DAG orchestration via `Promise.all` + conditionals. Deploy to Vercel.

Demo trigger: "Sort this week's shop, we're making lasagna Wednesday, having friends over Saturday, keep it under 80 euro"

## MoSCoW Requirements

### MUST HAVE

#### R001: Picnic API Prefetch Layer
Parallel prefetch of all needed data from Picnic API before any LLM call.
**Acceptance Criteria:**
- [ ] Authenticates with Picnic API using credentials from `.env`
- [ ] Fetches in parallel: order history (last 20 orders), favorites, current cart, delivery slots, product catalog for identified staples
- [ ] All fetches complete within 5 seconds (parallel execution)
- [ ] Results cached in memory for the session duration
- [ ] Handles auth token expiry gracefully (re-authenticate and retry)
- [ ] Empty `{}` response triggers re-authentication

#### R002: Order History Pattern Analysis
Pure TypeScript analysis of order history to identify shopping patterns.
**Acceptance Criteria:**
- [ ] Classifies items as staple (70%+ orders), regular (40-70%), occasional (15-40%), one-time (<15%)
- [ ] Calculates replenishment score per item (frequency + overdue + recency signals)
- [ ] Detects purchase cadence per item (weekly, bi-weekly, monthly, irregular)
- [ ] Estimates household size from spend patterns and quantities
- [ ] Computes average weekly spend and trend (increasing/stable/decreasing)
- [ ] Identifies co-purchase pairs (items frequently bought together, lift > 1.5)
- [ ] Works with as few as 2 orders (cold-start handling)
- [ ] Runs in <100ms client-side

#### R003: Agent Pipeline -- Order Analyst
LLM step that interprets pattern analysis results and generates a recommended base cart.
**Acceptance Criteria:**
- [ ] Receives pre-computed pattern analysis as structured context (no API calls)
- [ ] System prompt defines persona, edge cases with examples, output schema
- [ ] Returns structured JSON: list of recommended items with `itemId`, `name`, `quantity`, `reason`, `confidence`
- [ ] Reason field uses behavioral evidence ("bought 12 of last 15 weeks") not percentages
- [ ] Tags each item: `[repeat]`, `[overdue]`, `[co-purchase]`
- [ ] Uses `generateObject()` with Zod schema for guaranteed structure

#### R004: Agent Pipeline -- Meal Planner
LLM step that generates a meal plan incorporating user requests and available recipes.
**Acceptance Criteria:**
- [ ] Receives: user input (parsed intent), recipe search results, product catalog, dietary context
- [ ] Generates meal suggestions for mentioned days (Wednesday lasagna, Saturday dinner for guests)
- [ ] Extracts ingredient list with quantities per meal
- [ ] Cross-references with base cart to avoid duplicates ("already buying mozzarella weekly")
- [ ] Returns structured JSON: meals array with `day`, `meal`, `ingredients[]`, `estimatedCost`
- [ ] Handles "friends over" by adjusting portions (default: 4 extra guests)

#### R005: Agent Pipeline -- Budget Optimizer
LLM step that enforces budget constraints and triggers substitutions.
**Acceptance Criteria:**
- [ ] Receives: merged cart (base + meal plan items), budget target, product alternatives
- [ ] If total <= budget: approves cart, returns as-is with "within budget" status
- [ ] If total > budget: identifies highest-cost items, suggests cheaper alternatives
- [ ] Fetches alternatives for expensive items via pre-fetched `get-product-alternatives` data
- [ ] Returns structured JSON: `approved` boolean, `adjustments[]` with `original`, `replacement`, `savings`, `reasoning`
- [ ] The "rejection + substitution" flow is the key demo moment -- reasoning must be detailed

#### R006: Agent Pipeline -- Schedule Agent
LLM step that picks optimal delivery slot.
**Acceptance Criteria:**
- [ ] Receives: available delivery slots, historical delivery patterns
- [ ] Selects slot matching user's typical delivery day/time
- [ ] Returns structured JSON: `selectedSlot` with `id`, `date`, `timeWindow`, `reasoning`
- [ ] If no matching pattern, picks earliest available slot

#### R007: Agent Pipeline -- Orchestrator
Coordinates all agent outputs into a final plan with reasoning summary.
**Acceptance Criteria:**
- [ ] Merges outputs from Order Analyst, Meal Planner, Budget Optimizer, Schedule Agent
- [ ] Resolves conflicts (e.g., duplicate items from base cart + meal plan)
- [ ] Generates user-facing summary: total items, total cost, delivery slot, key decisions
- [ ] Uses `streamText()` for the final explanation (streams to UI)
- [ ] Produces the activity feed entries with per-agent reasoning

#### R008: Cart Assembly
Translates the final plan into actual Picnic API cart operations.
**Acceptance Criteria:**
- [ ] Clears current cart
- [ ] Adds all approved items via `add-to-cart` endpoint
- [ ] Sets delivery slot via `set_delivery_slot` endpoint
- [ ] Verifies cart contents match plan via `get-cart` after mutations
- [ ] Reports any items that failed to add (product unavailable)

#### R009: Split-Panel UI
Two-column layout: cart (left) + agent reasoning feed (right).
**Acceptance Criteria:**
- [ ] Left panel: clean grocery cart with item names, quantities, prices, category grouping
- [ ] Right panel: scrolling agent activity feed, color-coded per agent
- [ ] Each feed entry shows: timestamp, agent name, action type (SUGGEST/REJECT/APPROVE/QUERY), reasoning
- [ ] Feed entries animate in (slide or fade)
- [ ] Right panel toggleable (show/hide for "user mode" vs "transparency mode")
- [ ] Budget progress bar showing current total vs target
- [ ] Responsive at 1920x1080 (projector resolution)

#### R010: SSE Streaming Pipeline
Real-time streaming of agent activity to the frontend.
**Acceptance Criteria:**
- [ ] Single SSE endpoint streams all agent events to the frontend
- [ ] Events typed by agent name and action type
- [ ] Frontend accumulates events into the activity feed in real-time
- [ ] Parallel agent steps (Order Analyst + Meal Planner + Schedule Agent) stream concurrently
- [ ] Pipeline progress indicator shows current step

#### R011: System Prompts with Edge Cases
Each agent step has a comprehensive system prompt.
**Acceptance Criteria:**
- [ ] Each prompt uses XML-structured sections (identity, context, instructions, output_schema, edge_cases)
- [ ] Each prompt includes 2-3 few-shot examples of expected input/output
- [ ] Edge cases documented with examples: empty order history, single item in cart, budget exactly at limit, all alternatives more expensive, no delivery slots available
- [ ] Prompts stored as separate files in `lib/prompts/` for easy iteration

#### R012: Demo Video Recording
Pre-recorded 2-minute demo video with live narration capability.
**Acceptance Criteria:**
- [ ] Full pipeline execution recorded with the trigger: "Sort this week's shop, we're making lasagna Wednesday, having friends over Saturday, keep it under 80 euro"
- [ ] Video captures: user input -> agent activity feed populating -> cart building -> budget conflict -> substitution -> final cart
- [ ] The "budget disagreement" moment is clearly visible (Budget Optimizer rejects, Meal Planner substitutes)
- [ ] Video renders cleanly at 1920x1080
- [ ] 3 recordings made (pick the best one)

### SHOULD HAVE

#### R013: Reasoning Chips Per Cart Item
Visual tags on each cart item showing why it's there.
**Acceptance Criteria:**
- [ ] Each item displays a colored chip: `[repeat]`, `[substitution]`, `[recipe]`, `[suggestion]`
- [ ] Chips are expandable to show full reasoning
- [ ] Color-coded to match the agent that added the item

#### R014: Diff View Against Last Order
Show changes compared to the user's most recent order.
**Acceptance Criteria:**
- [ ] Green highlight for new additions
- [ ] Red highlight for items removed (were in last order, not in this one)
- [ ] Yellow highlight for substitutions
- [ ] Summary line: "Added X, removed Y, substituted Z items vs last week"

#### R015: Product Images
Display Picnic product images in the cart.
**Acceptance Criteria:**
- [ ] Product images loaded from Picnic API response data
- [ ] Fallback placeholder for missing images
- [ ] Images display at consistent size in cart item rows

#### R016: DAG Visualization
Visual representation of the agent pipeline as a directed graph.
**Acceptance Criteria:**
- [ ] 5 nodes representing agents, laid out as a DAG
- [ ] Directed edges showing data flow
- [ ] Active node pulses/glows during execution
- [ ] Completed nodes show checkmark
- [ ] Feedback edge (Budget Optimizer -> Meal Planner) visually distinct (dashed, red)
- [ ] Feedback edge animates when budget rejection triggers

#### R017: Meal Plan Display
Visual calendar-style display of the meal plan.
**Acceptance Criteria:**
- [ ] Shows meals for mentioned days (Wednesday, Saturday)
- [ ] Each meal shows: name, ingredient count, estimated cost
- [ ] Clicking a meal highlights its ingredients in the cart

### COULD HAVE

#### R018: Product Substitution with Memory
Remember which substitutions the user accepted/rejected.
**Acceptance Criteria:**
- [ ] When an alternative is suggested, user can accept or reject
- [ ] Accepted/rejected preferences stored in memory file
- [ ] Future runs reference these preferences

#### R019: Cross-Meal Ingredient Deduplication
Optimize ingredient quantities across multiple meals.
**Acceptance Criteria:**
- [ ] Detect shared ingredients across meals (e.g., onions for both lasagna and Saturday dinner)
- [ ] Combine quantities instead of adding separately
- [ ] Show "shared across X meals" in reasoning

#### R020: OpenClaw SOUL.md
Persistent identity file for the orchestrator agent.
**Acceptance Criteria:**
- [ ] SOUL.md defines agent persona, values, behavioral rules
- [ ] Referenced in system prompts
- [ ] Demonstrates OpenClaw Persistent Identity primitive

#### R021: Accumulated Memory Files
Preference persistence across sessions.
**Acceptance Criteria:**
- [ ] After each run, save learned preferences (brand preferences, substitution history, budget patterns)
- [ ] Next run loads these preferences into context
- [ ] Demonstrates OpenClaw Accumulated Memory primitive

### WON'T HAVE (v1)

#### R022: Voice Input
Speech-to-text for the trigger command. Cut because: demos well but adds zero technical depth.

#### R023: Multi-Household Support
Supporting multiple household profiles. Cut because: scope creep, single household is sufficient for demo.

#### R024: Real-Time Inventory Checking
Live stock availability checking. Cut because: API rate limits in hackathon, and it's logistics not agent intelligence.

#### R025: Pantry Tracking
Tracking what's still at home. Cut because: no data source for current pantry state, would require manual input.

#### R026: Dietary Restriction Conflict Resolution
Handling conflicting dietary needs across household members. Cut because: architecture supports it, but edge case handling takes too long to polish.

## Architecture

```
User Input: "Sort this week's shop, lasagna Wed, friends Sat, under 80 euro"
                |
                v
    [Intent Parser] -- extract: meals, guests, budget, special requests
                |
                v
    [Prefetch Layer] -- Promise.all([
        fetchOrderHistory(),
        fetchFavorites(),
        fetchCart(),
        fetchDeliverySlots(),
        searchProducts("lasagna ingredients"),
        searchRecipes("lasagna"),
    ])
                |
                v
    [Analysis Layer] -- pure TypeScript, no LLM
        stapleDetection()
        replenishmentScoring()
        budgetAnalysis()
        coPurchaseRules()
        householdEstimation()
                |
                v
    [Agent Pipeline] -- Vercel AI SDK generateObject()
        |
        +-- Promise.all([
        |       orderAnalyst(analysisResults),
        |       mealPlanner(recipes, products, userIntent),
        |       scheduleAgent(slots, patterns),
        |   ])
        |
        +-- orchestratorMerge(results)
        |
        +-- if (total > budget) {
        |       budgetOptimizer(cart, alternatives)
        |       // This is the "disagreement" moment
        |   }
        |
        +-- cartAssembly(finalPlan)  // Picnic API mutations
        |
        +-- streamText() -> final explanation to user
                |
                v
    [SSE Stream] --> React Frontend (split-panel)
```

## Build Plan (9 hours)

| Hour | Task | Parallelizable? |
|------|------|-----------------|
| 0-1 | Project scaffold (Next.js + AI SDK + shadcn), Picnic API auth, env setup | No (foundation) |
| 1-2 | Prefetch layer (all Picnic API calls in parallel) | Session 2: Analysis algorithms |
| 2-3 | Analysis algorithms (staple detection, replenishment, budget) | Session 2: System prompts |
| 3-4 | Agent pipeline (Order Analyst + Meal Planner + Schedule Agent) | Session 2: UI layout scaffolding |
| 4-5 | Orchestrator + Budget Optimizer + conditional branching | Session 2: Agent activity feed component |
| 5-6 | SSE streaming + frontend integration | Session 2: Cart UI + reasoning chips |
| 6-7 | Cart assembly (Picnic API mutations) + end-to-end testing | Session 2: Polish + animations |
| 7-8 | Full pipeline testing, bug fixes, edge cases | Session 2: DAG visualization (if time) |
| 8-9 | Demo recording (3 takes), final polish | Together: review + select best recording |

## Demo Script (2 minutes)

| Time | Screen | Narration |
|------|--------|-----------|
| 0:00-0:12 | User types trigger sentence | "I spend 45 minutes every week on groceries. What if I could say one sentence and five AI agents handled the rest?" |
| 0:12-0:30 | DAG lights up, agents activate in parallel | "Five specialists collaborate through a DAG. The key: the Budget Optimizer can REJECT the plan and send it back. That's not a pipeline -- that's negotiation." |
| 0:30-0:55 | Split panel: cart building (left) + reasoning feed (right). Budget rejection moment. | "Watch the right panel. Meal Planner suggested salmon -- Budget Optimizer rejected it, calculated the exact overage, and Meal Planner autonomously found chicken thighs at half the price. That's agent intelligence, not an API wrapper." |
| 0:55-1:15 | Final cart with budget bar, reasoning chips, category grouping | "Complete weekly shop: 24 items, EUR 78.40, under budget, with three smart substitutions saving EUR 11." |
| 1:15-1:35 | Architecture diagram with highlighted edges | "Three decisions: five agents not one (specialized agents don't hallucinate prices). Feedback loop (real shopping is iterative). Parallel execution (40% faster than sequential)." |
| 1:35-1:50 | Scope cuts list | "What we cut: voice input (demos well, zero depth), multi-store routing (logistics, not intelligence), dietary conflicts (architecture supports it, ran out of time)." |
| 1:50-2:00 | New constraint typed in, DAG re-activates, freeze frame | "Change a constraint, agents re-negotiate. Five agents. One sentence. Your week, sorted." |

## Future Considerations (Post-Hackathon)
- Consumption rate learning (predict when items run out)
- Waste reduction intelligence (track unused items)
- Multi-household profiles
- Integration with calendar for automatic guest detection
- Weekly learning loop that improves with each order
