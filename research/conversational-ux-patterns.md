# Conversational UX Patterns for Grocery Agent

## Three-Tier Autonomy Model

### Tier 1 -- Silent (agent acts, logs it)
- Reorder identical items from last week
- Apply loyalty/coupon codes
- Select same delivery window as usual
- Round quantities to nearest pack size

### Tier 2 -- Inform (agent acts, surfaces summary card)
- Substitutions when product unavailable
- Price changes >15% since last purchase
- Seasonal swaps with high confidence
- Removing items not bought in 3 of last 4 weeks

### Tier 3 -- Ask (agent blocks until user responds)
- Adding entirely new items (recipe ingredients)
- Total cart exceeding budget
- First-time category purchases
- Dietary/allergy implications

### Confidence Routing
```
confidence_score = frequency_score * recency_weight * price_similarity
if confidence_score > 0.85: silent (Tier 1)
elif confidence_score > 0.60: inform (Tier 2)
else: ask (Tier 3)
```

## Communication Style: Inverted Pyramid

- **Headline**: "Your weekly shop is ready -- 23 items, EUR 87.40"
- **Summary**: 3-4 bullet points of notable decisions
- **Detail**: Expandable per-item reasoning on demand

### Tone Rules
- Confident but not presumptuous: "Added whole milk" not "I think you probably want whole milk"
- Evidence-based, not probabilistic: "Bought 12 of last 15 weeks" not "95% confident"
- Action-oriented: every message has a clear next action

## Reasoning Chips (Per-Item Tags)

Each cart item gets a small, expandable tag:
- `[repeat]` -- bought regularly
- `[substitution]` -- replaces unavailable item
- `[recipe]` -- from a recipe the user mentioned
- `[suggestion]` -- agent-initiated recommendation
- `[manual]` -- user explicitly added

## Error Recovery: Undo-First Principle

Every action undoable until checkout:
- "Not this week" (removes but remembers for next week)
- "Never again" (permanent exclusion)
- "Swap" (opens alternatives)
- "Change quantity"

## Progressive Disclosure (3 Layers)

### Layer 1 -- The Result (default view)
Clean cart summary: "23 items, EUR 87.40, ready for Wednesday delivery"

### Layer 2 -- Activity Feed (one click deeper)
Reverse-chronological agent actions:
```
12:04 -- Budget Agent: Cart is EUR 2.40 under target
12:03 -- Substitution Agent: Swapped high-pulp OJ for low-pulp
12:02 -- Recipe Agent: Added 4 items for Wednesday lasagna
12:01 -- Repeat Agent: Added 18 items from weekly list
12:00 -- Orchestrator: Started weekly shop
```

### Layer 3 -- Reasoning Panel (for each action)
Expanded view with alternatives considered, confidence basis, price comparison.

## The Split-Panel Layout (Key Hackathon Strategy)

- **Left panel**: Clean user-facing cart (proves usefulness -- 25pt Impact)
- **Right panel**: Live agent activity feed with reasoning (proves depth -- 30pt Technical)
- Toggle right panel for "user mode" vs "transparency mode"
- Left = what ships to customers. Right = what judges need to see.

## Diff View Against Last Week

Show cart as a diff:
- Green: new additions
- Red: items removed vs last order
- Yellow: substitutions
- Immediately intuitive, shows agent's contribution visually
