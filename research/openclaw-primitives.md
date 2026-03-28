# OpenClaw Primitives Research

## What Is OpenClaw?

OpenClaw is a real, widely-adopted open-source AI agent framework (MIT-licensed, 196k+ GitHub stars as of Feb 2026). Created by Peter Steinberger. KiloClaw is a managed hosting platform for OpenClaw by Kilo (backed by GitLab co-founder).

## The Four Primitives (What Judges Want)

| Primitive | What It Is | Our Implementation |
|---|---|---|
| **Persistent Identity** | SOUL.md file defining who the agent is, how it behaves, what it values | System prompts for each agent step define persona, values, edge-case behavior |
| **Periodic Autonomy** | Agent wakes up and acts without being prompted (heartbeat) | "Sort this week's shop" trigger -- agent proactively prepares basket |
| **Accumulated Memory** | Agent remembers across sessions via local memory files | Preference files persist: brand preferences, substitution history, budget patterns |
| **Social Context** | Agents find and interact with other agents | 5 specialized agent configs coordinate, share state, resolve conflicts |

## How Skills Work

A skill is a directory containing a SKILL.md file with YAML frontmatter + markdown instructions. The Picnic API skill is already in this format. Skills are scoped system prompts that teach the agent how to interact with specific APIs.

Skill loading precedence: workspace > project `.agents/skills/` > personal `~/.agents/skills/` > bundled.

## How to Demonstrate Primitives in Our Project

1. **SOUL.md**: Create a SOUL.md for the orchestrator defining its persona: "I am a weekly grocery planning agent for Dutch households using Picnic. I prioritize routine reliability over novelty. I ask before spending money."

2. **Periodic Autonomy**: The system could have a scheduled trigger. For demo: show the agent proactively suggesting "it's time for your weekly shop."

3. **Accumulated Memory**: After each run, save learned preferences in memory files. Next run loads these into context. Show the agent getting smarter.

4. **Social Context**: The 5 sub-agents coordinating IS the social context primitive. Show visible agent-to-agent data passing.

## Key Insight

You do NOT need to run OpenClaw itself. You're using Claude Code/Codex as your agent harness. The primitives are architectural concepts you demonstrate, not a runtime dependency. The Picnic API skill is already OpenClaw-compatible.

## Install on Hackathon Day

```bash
sh ./picnic-api-skill/install.sh --platform claude-code
```
