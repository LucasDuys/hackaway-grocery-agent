# Next Steps -- Research + Implementation Prompt

## Context for New Conversation

You are helping Lucas build a multi-agent grocery orchestration system for the Hackaway hackathon (March 28, 2026, Amsterdam). The project targets BOTH the Agentic Systems track AND Picnic's Track 3 (Automated Weekly Shop).

**Read these files first:**
1. `C:/dev/hackaway/RESEARCH-CONTEXT.md` -- full hackathon context, tracks, judging criteria, API details, concept
2. `C:/dev/hackaway/CHALLENGES.md` -- Picnic's full challenge descriptions and evaluation criteria
3. `C:/dev/hackaway/picnic-api-skill/SKILL.md` -- complete API reference with all endpoints
4. `C:/dev/hackaway/picnic-api-skill/references/shopping.md` -- shopping endpoint schemas
5. `C:/dev/hackaway/picnic-api-skill/references/recipes.md` -- recipe endpoint schemas

**Existing research to reference:**
- `C:/Users/20243455/hackathon-erebus/research/01-llm-batching-latency.md` -- parallel LLM calls, async patterns, rate limits
- `C:/Users/20243455/hackathon-erebus/research/02-persistent-memory.md` -- agent memory systems (2026 state of art)
- `C:/Users/20243455/hackathon-erebus/research/07-demo-strategy.md` -- demo optimization and presentation
- `C:/Users/20243455/Downloads/research (1)/research/` -- prompt engineering, latency optimization, tool use patterns, guardrails

## Research Still Needed

Launch research agents (use authoritative sources only -- Anthropic, OpenAI, recent papers from 2025-2026) for each of these:

### 1. OpenClaw Skill Architecture
- How do OpenClaw skills work technically?
- How to build a custom skill that orchestrates multiple sub-agents?
- What are "OpenClaw primitives" the judges want to see used meaningfully?
- How does the picnic-api-skill work under the hood (read install.sh)?
- What agent harnesses support multi-agent orchestration natively?
- Search: "OpenClaw skill development 2026", "OpenClaw multi-agent", "OpenClaw primitives architecture"

### 2. Grocery AI State of the Art
- What existing AI grocery assistants exist? (Instacart AI, Amazon Fresh, Walmart)
- What's been tried and failed in AI grocery shopping?
- What makes grocery shopping uniquely hard for AI? (substitutions, quantities, freshness, household patterns)
- Academic papers on AI-assisted grocery shopping or meal planning
- Search: "AI grocery shopping assistant 2025 2026", "automated meal planning AI", "grocery recommendation system"

### 3. Multi-Agent Orchestration Frameworks (2026)
- What's the best framework for multi-agent orchestration in TypeScript/Python?
- LangGraph vs CrewAI vs OpenAI Swarm vs AutoGen vs custom?
- How to implement conditional branching (if budget exceeded -> trigger optimizer agent)?
- How to implement fan-out/fan-in (5 agents run in parallel, results merge)?
- DAG-based task execution for agent workflows
- Search: "multi-agent orchestration framework 2026", "LangGraph vs CrewAI 2026", "agent workflow DAG execution"

### 4. Order History Analysis Patterns
- How to extract meaningful patterns from order history (frequency, staples, seasonal)
- Collaborative filtering for grocery (what do similar households buy?)
- Time-series patterns in grocery shopping
- How Picnic's API exposes order history (read the endpoint docs)
- Search: "grocery order history pattern analysis", "recurring purchase prediction AI"

### 5. Conversational Agent UX for Grocery
- How should the agent communicate its reasoning? (verbose vs concise)
- When should it ask for permission vs just do it?
- How to handle ambiguity ("get some fruit" -> which fruit? how much?)
- The "annoying vs helpful" threshold for proactive agents
- Trust-building patterns for agents that spend your money
- Search: "conversational AI grocery UX", "agent autonomy trust threshold", "proactive agent design patterns"

### 6. Demo Optimization for This Specific Project
- What does a compelling 2-minute grocery agent demo look like?
- Should we show the multi-agent reasoning (visible orchestration) or just the result?
- Pre-recorded vs live for a grocery shopping demo?
- How to demonstrate "agent intelligence" vs "API wrapper" in the demo
- The judges specifically want to see the WHY, not just the WHAT

## Architecture to Design

After research, design:
1. **Agent topology**: Which agents, what each does, how they communicate
2. **Data flow**: Order history -> analysis -> meal plan -> cart -> delivery slot
3. **Conditional branching**: What triggers which agent, under what conditions
4. **Memory system**: How agents remember preferences across the session
5. **Prompt design**: System prompts for each agent (XML-structured, few-shot examples, strict JSON output)
6. **Tech stack**: Framework choice, state management, API integration pattern
7. **Build plan**: Hour-by-hour for ~9 hours of building
8. **Demo script**: 2-minute presentation hitting all 5 judging criteria

## Key Constraint
No code can be pre-written. All implementation happens during the hackathon. Only research, architecture docs, and planning are allowed beforehand. The Picnic API skill needs to be installed on the day (via their install.sh script).

## What to Optimize For (by point value)
1. Technical depth (30pt) -- real multi-agent orchestration with DAG execution, not a chatbot
2. Impact + usefulness (25pt) -- would a real Picnic customer use this weekly?
3. Creativity (20pt) -- the visible reasoning / agent orchestration dashboard is the differentiator
4. Demo (15pt) -- show the WHY, pre-recorded + live narration
5. Completeness (10pt) -- narrow scope, polished. Cut features explicitly.
