# Demo Strategy: 2-Minute Grocery Agent Demo

## Core Thesis (One Thing)
"Five AI agents that argue, negotiate, and compromise -- to save you money on groceries."

## Demo Script

### [0:00 - 0:12] THE HOOK
**Screen**: User types "Sort this week's shop, we're making lasagna Wednesday, having friends over Saturday, keep it under 80 euro"
**Narration**: "I spend 45 minutes every week on groceries. What if I could say one sentence and five AI agents handled the rest?"

### [0:12 - 0:30] THE ARCHITECTURE
**Screen**: DAG visualization animates in. Five agent nodes light up as named.
**Narration**: "Five specialists collaborate through a DAG. The key: the Budget Optimizer can REJECT the plan and send it back. That's not a pipeline -- that's negotiation."

### [0:30 - 0:55] THE DISAGREEMENT (Money Shot)
**Screen**: Split panel. Cart building (left) + reasoning feed (right).

Show the moment:
```
[Meal Planner] Suggested: Salmon with asparagus (EUR 14.50)
[Budget Optimizer] REJECTED: Over budget by EUR 6.20
[Meal Planner] Revised: Chicken thighs with green beans (EUR 7.20)
                "Protein swap, 51% cheaper per serving"
[Budget Optimizer] APPROVED: New total EUR 65.50
```

**Narration**: "Watch the right panel. Meal Planner suggested salmon -- Budget Optimizer rejected it, calculated the exact overage, and Meal Planner found chicken thighs at half the price. That's agent intelligence, not an API wrapper."

### [0:55 - 1:15] THE RESULT
**Screen**: Completed grocery order with budget bar, reasoning chips, category grouping.
**Narration**: "Complete week of meals, optimized list grouped by aisle, under budget, three smart substitutions saving over eleven euros."

### [1:15 - 1:35] THE WHY (Architecture Decisions)
**Screen**: DAG diagram with highlighted edges.
**Narration**: "Three decisions. Five agents not one -- specialized agents don't hallucinate prices. Feedback loop -- real shopping is iterative. Parallel execution -- 40% faster than sequential."

### [1:35 - 1:50] WHAT WE CUT
**Screen**: Crossed-out list.
**Narration**: "Voice input -- demos well, zero depth. Multi-store routing -- logistics, not intelligence. Dietary conflicts -- architecture supports it, ran out of time."

### [1:50 - 2:00] THE CLOSE
**Screen**: New constraint typed in, DAG re-activates, freeze frame.
**Narration**: "Change a constraint, agents re-negotiate. Five agents. One sentence. Your week, sorted."

## Pre-recorded vs Live

| Element | Pre-record? | Why |
|---------|------------|-----|
| User input + agent execution | YES | API calls slow, can fail |
| DAG animation | YES | Timing must be perfect |
| Reasoning trace / disagreement | YES | Cannot risk it being boring |
| All narration | LIVE | Format requires it |

**Everything on screen is pre-recorded. Everything spoken is live.**

## Risk Mitigation

1. Record 3 different runs (0, 1, 3 substitutions). Pick most dramatic.
2. Video on USB, cloud, and phone.
3. Rehearse narration 10+ times synced to video.
4. If behind: skip "what we cut" section. If ahead: slow on WHY section.

## What Differentiates "Agent Intelligence" from "API Wrapper"

- API wrapper: user says thing -> call APIs -> return result
- Agent intelligence: user says thing -> agents DISAGREE -> agents NEGOTIATE -> agents RESOLVE -> return result with reasoning

The 25-second disagreement sequence is the single most important moment.
