<div align="center">

<h1>Weekly Shop Agent</h1>

<p><strong>One sentence in. Full grocery cart out.</strong></p>

<p>A multi-agent system that automates a household's weekly Picnic shop — analyzes purchase history, plans meals, picks delivery slots, enforces a budget, and assembles the cart. Built at Hackaway 2026.</p>

<p>
  <img src="https://img.shields.io/badge/license-MIT-3C3836?style=flat-square&labelColor=3C3836&color=D65D0E" alt="license"/>
  <img src="https://img.shields.io/badge/Next.js-15-3C3836?style=flat-square&logo=nextdotjs&logoColor=FBF1C7" alt="nextjs"/>
  <img src="https://img.shields.io/badge/TypeScript-strict-3C3836?style=flat-square&logo=typescript&logoColor=FBF1C7" alt="typescript"/>
  <img src="https://img.shields.io/badge/Vercel_AI_SDK-6-3C3836?style=flat-square&logo=vercel&logoColor=FBF1C7" alt="vercel ai"/>
  <img src="https://img.shields.io/badge/agents-5-3C3836?style=flat-square&labelColor=3C3836&color=98971A" alt="agents"/>
</p>

</div>

---

## What it does

Type one line — *"sort this week's shop, lasagna Wednesday, friends Saturday, under 80 euro"* — and the system does the rest:

1. **Reads your last 20 Picnic orders** to find your staples (items bought in 70%+ of orders) and replenishment patterns.
2. **Maps your meal requests** to real Picnic recipes and ingredients, deduping against the staple cart.
3. **Picks a delivery slot** based on your historical day/time preferences.
4. **Enforces the budget.** If the cart goes over, the Budget Optimizer negotiates substitutions — never touching staples or recipe ingredients. A deterministic guard guarantees the cart never exceeds the stated budget.
5. **Streams agent reasoning** to a split-panel UI in real time so you can watch the negotiation happen.

It also runs in **auto mode** — after 7 days without an order, it builds a complete cart from your purchase patterns alone. No prompt needed.

## The five agents

```
Order Analyst        Reads 20 orders. Finds staples, replenishment scores,
                     co-purchase patterns. Outputs a base cart with evidence
                     for every item. Filters by active dietary restrictions.

Meal Planner         Maps "lasagna Wednesday" or "high protein week" to real
                     Picnic recipes and products. Adjusts portions for guests.
                     Runs in parallel with Schedule Agent.

Schedule Agent       Picks the optimal delivery slot from your historical
                     day/time preferences. Falls back to earliest available.

Budget Optimizer     Conditional. Only fires if the merged cart exceeds the
                     budget. Finds cheaper alternatives, applies up to 3 swaps,
                     never removes staples or recipe ingredients.

Orchestrator         Coordinates the pipeline, dedupes, runs the deterministic
                     budget guarantee loop, streams everything to the UI.
```

## Why "fat context" instead of tool calls

The agents never call APIs mid-reasoning. All Picnic data — order history, favorites, delivery slots, product catalog, recipe results — is prefetched in parallel via plain TypeScript before any LLM is invoked, then packed into each agent's prompt as structured context.

Trade-offs measured during the build:

- **Faster.** One `generateObject()` call per agent, no round-trip latency. Total prefetch: ~2s for six parallel API calls instead of ~12s sequential.
- **More reliable.** A failed tool call corrupts an agent's chain of thought with no clean recovery. Fat context fails up front or not at all.
- **Cheaper.** ~$0.001 per full pipeline run on GPT-4.1-mini vs 3-5x for a tool-calling equivalent.
- **Deterministic.** Same input → same context → same output. No reasoning drift from variable tool ordering.

The trade-off: prefetched data must fit in the context window. For 20 orders × ~25 items, this comfortably fits in 8K tokens of structured context. ([full architecture writeup](ARCHITECTURE.md))

## Pipeline

```
User: "Sort this week's shop, lasagna Wed, friends Sat, under 80 euro"
  |
  v
[Intent Parser]                                                       LLM
  |
  v
[Prefetch] -- 6 Picnic API calls in parallel                          ~2s
  |
  v
[Analysis] -- staples, replenishment, budget, co-purchase            <50ms
  |
  v
[Order Analyst] ----------------------------                        ~2-3s
  |
  v
[Meal Planner] || [Schedule Agent]   parallel                       ~2-3s
  |
  v
[Merge + Live Price Search]
  |
  v
[Budget Optimizer]   only if over budget                            ~2-3s
  |
  v
[Deterministic Budget Guard]  while (total > budget) drop non-staple
  |
  v
[Preference Learning]  brand prefs, delivery prefs, budget pattern
  |
  v
SSE stream -> split-panel React UI
```

End-to-end: **~10-14s** when under budget, **~14-20s** when the optimizer triggers.

## Memory across runs

`src/data/preferences.json` accumulates household-specific preferences after every run:

- **Brand preferences** learned from Budget Optimizer substitutions you accept
- **Budget patterns** — running average of actual spend, fallback when no budget is stated
- **Delivery preferences** — preferred day and time window
- **Dietary restrictions** persisted from the last run (vegetarian, vegan, gluten-free, lactose-free, low-sugar, halal, nut-free)
- **Always-include / never-suggest** lists

These are loaded at the start of each run and injected into agent prompts as a `<preferences>` block. The system gets more useful with use.

## Live price verification

LLMs hallucinate prices. The system uses three layers to guarantee every shown price is real:

1. **Catalog lookup** by `selling_unit_id`
2. **Fuzzy name match** for items the LLM invented
3. **Live Picnic API search** for any item still on the fallback price

Whatever is shown in the cart is what Picnic will actually charge.

## Quick start

```bash
git clone https://github.com/LucasDuys/hackaway-grocery-agent
cd hackaway-grocery-agent
npm install
echo "OPENAI_API_KEY=sk-..." > .env.local
echo "PICNIC_USERNAME=..." >> .env.local
echo "PICNIC_PASSWORD=..." >> .env.local
npm run dev
```

Open `http://localhost:3000` and type a request.

> Note: this uses the Picnic Hackaway API, which is restricted to hackathon accounts. The architecture is portable to any grocery API; expanding to other Dutch supermarkets is the current direction.

## Tech stack

Next.js 15 (App Router) · TypeScript strict · Vercel AI SDK 6 · Zod · Tailwind 4 · shadcn/ui · Motion · GPT-4.1-mini (agents) · GPT-4.1 (budget optimizer) · Picnic REST API

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — full system writeup (fat context, parallel agents, dietary support, narrative mode, OpenClaw primitives)
- [SOUL.md](SOUL.md) — agent persona, values, behavioral rules
- [CHALLENGES.md](CHALLENGES.md) — original Hackaway challenge tracks
- [README-CHEATSHEET.md](README-CHEATSHEET.md) — Picnic API setup guide from the organizers

## Roadmap

- Expand beyond Picnic to Albert Heijn, Jumbo, and Lidl via a unified product schema
- Recipe-from-pantry mode (use what you already have first)
- Per-meal nutritional targets
- WhatsApp interface for grocery requests on the go

## Credits

Built at **Hackaway 2026** by [Lucas Duys](https://lucasduys.com). Uses the Picnic Hackathon API courtesy of Picnic.

## License

[MIT](LICENSE)
