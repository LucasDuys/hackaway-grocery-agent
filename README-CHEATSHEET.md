# Picnic x Hackaway Cheatsheet

Welcome to the Picnic guide for Hackaway! This document will guide you to everything available to you during the hackathon. The API gives you direct access to Picnic Hackathon API to perform operations over Picnic products, shopping cart, orders, favorites, delivery slots, and recipes.

We **strongly** recommend you to read through this document before you start building.

---

## What's in This Repo

| File / Folder | What it is                                                                       |
|---|----------------------------------------------------------------------------------|
| [`README-CHEATSHEET.md`](./README-CHEATSHEET.md) | This document: your starting point for setup and usage                           |
| [`CHALLENGES.md`](./CHALLENGES.md) | Three sample challenge tracks with judging criteria.                             |
| [`picnic-api-skill/`](./picnic-api-skill/) | Agent skill package                                                              |
| [`picnic-api-skill/references/`](./picnic-api-skill/references/) | Detailed endpoint docs (shopping, recipes) the skill loads as needed |
| [`security.txt`](./security.txt) | Security vulnerability disclosure policy                                         |

> **Skill vs References:** The skill (`SKILL.md`) teaches your agent *how* to call the Picnic API (auth flow, endpoints, parameters). The reference files in `references/` provide deeper detail on specific domains (shopping, recipes, etc.) that the agent consults when needed. You don't need to read these yourself; the agent does.

> **Start here:** Read [CHALLENGES.md](./CHALLENGES.md) to get inspiration before diving into setup.

## Prerequisites

Before you can start using the API, make sure you have all of the following in place.

### 1. A Picnic Customer Account

The API requires an authenticated Picnic customer account.

> **Already a Picnic customer?** Use your own account

> **Want your own account?** Download the Picnic app ([App Store](https://apps.apple.com/nl/app/picnic-online-supermarkt/id1018175041) · [Google Play](https://play.google.com/store/apps/details?id=com.picnic.android)) and register. This is optional — pre-made accounts are available above.

If you don't have one, claim a fresh account from [this spreadsheet](https://docs.google.com/spreadsheets/d/1LyB42D3qTdZIphMH08G7cd2KLuLYSu7cRyEhDtisFsU/edit?usp=sharing). Write your name in the "Claimed By" column so nobody else takes it.

> **The spreadsheet is shared with edit access.** Only edit the "Claimed By" column for the row you're claiming.

### 2. An Agent Harness

Pick a harness that supports agent skills:

- [Claude Code](https://github.com/anthropics/claude-code)
- [Codex](https://openai.com/codex/)
- [Cursor](https://www.cursor.com/)
- [Windsurf](https://windsurf.com/)
- [OpenCode](https://opencode.ai/)

You will receive an API key from the hackathon organizers to use with your tool. Contact them if you haven't received yours yet.

## How the API Works

### How Authentication Works

Your agent handles authentication automatically. Just provide your Picnic account credentials when prompted. The skill contains the full auth flow, so you don't need to manage tokens or headers yourself.

If something goes wrong, the API returns descriptive error messages that your agent will surface to you.

## Using Your AI Agent

### Install the Picnic API Skill

A skill is a set of instructions you install into your AI tool that teaches it how to interact with the Picnic API (authentication, endpoints, parameters, and data formats). Once installed, your agent can call the API on your behalf when you ask it to.

Install the skill for your specific tool:

```bash
# Pick your platform:
sh ./picnic-api-skill/install.sh --platform claude-code
sh ./picnic-api-skill/install.sh --platform cursor
sh ./picnic-api-skill/install.sh --platform opencode
sh ./picnic-api-skill/install.sh --platform windsurf

# Or install for all detected tools at once:
sh ./picnic-api-skill/install.sh --all
```

> If you skip `--platform`, the installer auto-detects your tool, but it may guess wrong if you have multiple tools installed. Specifying `--platform` explicitly is safer.

The following features are available:

- **Search & browse products**: search by keyword, look up product details, list categories and subcategories
- **Manage your cart**: view, add, remove items, or clear the cart entirely
- **Manage favorites**: view, add, or remove favorite products
- **Orders & delivery**: view order history and details, check available delivery slots and your currently selected slot
- **Recipes**: search for recipes, retrieve recipe details, and get personalized recommendations

> **Checkout is not available via this API.** The API lets you manage carts and browse delivery slots, but does not include a checkout or place-order endpoint. You cannot place orders through the API.

### Verify Your Setup

After installing the skill, try these to confirm everything works:

1. "Search for 'melk' on Picnic" (tests product search) 
2. "Search for 'melk' on Picnic and add it to the cart" (tests search + cart operations)
3. "Find me a recipe with chicken" (tests recipe search)

---

Good luck, and have fun building! If you run into issues, do not hesitate to contact the Hackathon organizers :)