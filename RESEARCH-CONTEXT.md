# Hackaway Research Context -- Carried Forward

## What This Hackathon Is

**Event**: Hackaway.xyz, March 28, 2026, AI House Amsterdam
**Participants**: 80 hand-picked builders
**Duration**: 09:00 - 19:00 (10 hours)

### Tracks
1. **Agentic Systems** -- multi-agent orchestration, conditional branching, multi-agent workflows
2. **Voice & Adaptive Interfaces** -- replace the textbox, adapt to how users speak/think/make mistakes
3. **Personalization at Scale** -- emails/content/recommendations that feel individually crafted
4. **Picnic Grocery** -- 3 sub-tracks (dinner planner, lifestyle coach, automated weekly shop)

### Judging Criteria (100 total points)
- **Technical depth**: 30pt -- non-trivial engineering, meaningful use of OpenClaw primitives, beyond wrapping an API call
- **Impact + usefulness**: 25pt -- solves a real problem someone would actually use
- **Creativity + originality**: 20pt -- fresh take, surprising, novel approach
- **Demo + presentation**: 15pt -- clear, focused, compelling. Pre-recorded video + live narration explaining the WHY
- **Completeness**: 10pt -- polished, narrowly-scoped. Judges appreciate knowing what you cut and why

### Picnic-Specific Judging
- Would a real Picnic customer trust and use this?
- Quality of the agent loop: handles ambiguity, edge cases, multi-step reasoning
- Use of Picnic's intelligence: household routines, delivery rhythm, catalogue signals

### Prizes
- Every participant gets: 3mo Orq Pro, 1mo ElevenLabs Creator, 3mo KiloClaw, OpenAI + Google credits
- Best ElevenLabs project: 6 months Scale tier
- 1st/2nd/3rd across all tracks: Orq Pro + KiloClaw + API credits + VMs

## The Decision: Agentic Systems Track + Picnic API

Build a **multi-agent grocery orchestration system** for Picnic's Track 3 (Automated Weekly Shop) that also qualifies for the Agentic Systems track. The agent handles routine weekly shopping with minimal user input using multi-agent architecture.

## Picnic API (Available via Skill)

Installed at `C:/dev/hackaway/picnic-api-skill/`. Endpoints:

**Products**: search-products, search-suggestions, list-categories, get-subcategories, get-product, get-product-alternatives
**Cart**: get-cart, add-to-cart, remove-from-cart, clear-cart
**Favorites**: list-favorites, toggle-favorite
**Orders**: list-orders, get-order (order history!)
**Delivery**: get-delivery-slots, get-selected-delivery-slot, set_delivery_slot
**Recipes**: search-recipes, get-recipe, get-recipe-recommendations, save-user-defined-recipe

Auth: curl-based with token stored at /tmp/picnic-token. Pre-made hackathon accounts available.

**Key constraints**:
- No checkout/place-order endpoint
- Prices in integer cents (divide by 100 for EUR)
- Product IDs prefixed with 's' (e.g., s1132274)
- Empty {} response = bad auth token

## The Project Concept

"Sort this week's shop" -- user says one sentence, 5+ agents go to work:

1. **Order Analyst Agent**: Scans order history, identifies patterns (weekly staples, frequency, preferences)
2. **Meal Planner Agent**: Generates meal plan based on dietary preferences + catalogue + deals
3. **Budget Optimizer Agent**: Checks prices, finds alternatives, stays within budget
4. **Schedule Agent**: Picks optimal delivery slot based on history
5. **Orchestrator Agent**: Coordinates all agents, resolves conflicts, presents final plan with reasoning

Visible reasoning showing WHY each product was chosen. Conditional branching (if budget exceeded -> trigger optimizer). Agent memory of past orders and preferences.

## Relevant Research Already Completed

### Multi-Agent Architecture (from hackathon-erebus/research/)
- `01-llm-batching-latency.md`: 50 parallel async calls with asyncio.gather(), <3s ticks, structured JSON output, prompt caching (50% cheaper after first call)
- `02-persistent-memory.md`: Letta-style self-editing memory, rolling summary + recent buffer, temporal tagging, A-MEM and MAGMA papers (2026)
- `04-websocket-architecture.md`: FastAPI WebSocket broadcasting, Zustand state management, client interpolation

### Prompt Engineering (from Downloads/research/)
- `03-prompting-guides/system_prompt_best_practices.md`: XML-structured prompts, few-shot examples, no CoT for classification, conservative tool triggering
- `03-prompting-guides/tool_use_prompting_patterns.md`: Strict mode on all tools, consolidated tools by workflow, actionable error messages
- `02-agent-latency-and-performance/latency_tradeoffs.md`: Model routing (cheap for simple, expensive for complex), prompt caching, parallel execution
- `02-agent-latency-and-performance/parallel_tool_use.md`: Fan-out/fan-in patterns, asyncio.gather, API-level parallel tool calls

### Optimization Research (from Downloads/research/)
- `01-agent-context-and-scale/context_window_management.md`: Token budgets, compression, caching
- `04-evaluator-and-output-validation/guardrails_and_output_filtering.md`: Layered validation, short-circuit assessment

### Demo Strategy (from hackathon-erebus/research/)
- `07-demo-strategy.md`: First 15 seconds hook, one thing rule, hybrid pre-recorded + live, directed emergence

## User Profile
- Lucas Duys, 2nd year CSE at TU Eindhoven
- Strong in: React, Next.js, TypeScript, Tailwind, Node.js, Supabase, LLM/RAG
- Built: Pitchr.live (pitch coach), GraphBot (DAG execution engine), Forge (Claude Code plugin)
- Experience with multi-agent orchestration, DAG execution, voice AI (ElevenLabs)
