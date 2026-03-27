# Hackathon Topics

## The Challenge

Groceries are one of the most personal, recurring, and operationally complex AI problems out there - especially in a model like Picnic, where families shop in weekly household rhythms rather than one-off transactions.

It sounds simple: help someone buy food. But in practice, that means understanding what a household is trying to get done that week — dinners, lunchboxes, breakfast basics, staple refills — alongside who will eat, dietary constraints, what is likely still at home, the right pack sizes, and the best delivery moment. Then you need to turn all of that into a coherent basket, with the right quantities, sensible substitutions, and enough confidence to actually place the order.

That is a genuinely hard problem. And for the first time, the tools exist to build something that can meaningfully solve it.

Unlike generic ecommerce, Picnic is built around recurring household missions: feeding a family through the week, remembering routines, fitting delivery into life, and getting the basket mostly right every time. The strongest entries will treat Picnic not as a generic search API, but as a recurring household planning platform.

---

## Challenge Tracks

### Challenge 1 — The Family Dinner Planner
* **Problem:** Families cook multiple dinners a week for people with different preferences, ages, and dietary needs. Deciding what to make each night, avoiding repetition, using what is already at home, and buying the right quantities without waste is a deceptively hard planning problem that most households solve imperfectly.
* **Goal:** Build an agent that plans a week of dinners for a family, then turns that dinner plan into a Picnic order. The agent should handle real constraints — a dairy-free partner, kids who will not touch aubergine, a preference for keeping dinner spending under control, limited time on weekdays, or a desire to reuse ingredients across multiple meals. Strong solutions should go beyond recipe selection: they should reason about variety across the week, overlap in ingredients, realistic quantities, and how dinner choices affect the final basket.
    * *Bonus: Handle edge cases well. What happens when the user changes their mind about Thursday’s dinner halfway through the week?*
* **Why it’s interesting:** Dinner planning sits in the middle of preference reasoning, meal composition, quantity estimation, and basket building. The challenge is not just choosing good recipes, but building a coherent dinner plan for a specific household across multiple nights.

### Challenge 2 — The Lifestyle Coach
* **Problem:** People have genuine health goals — more protein, less sugar, plant-based two days a week, cooking for a partner with IBS — but translating those goals into a specific weekly shop is hard. Generic "healthy eating" advice doesn't help you choose between two brands of yoghurt or figure out which ready meal actually fits your macros.
* **Goal:** Build an agent that understands a user’s lifestyle goals and turns them into a concrete, personalised Picnic basket that still fits real-life constraints like budget, convenience, taste, and repeatability. Not a list of generic healthy foods — a real, opinionated recommendation grounded in what is actually in the Picnic catalogue, with substitutions for things the user already said they do not like. The agent should be able to explain its choices and adjust them in conversation. Strong entries will show how abstract goals become actual weekly shopping decisions, not just healthy-sounding recommendations.
* **Why it's interesting:** Unlike the dinner planner, this challenge is about an individual's health habits. Not a one-off meal plan, but a coach that learns from your preferences and adjusts over time. The agent needs to reason across nutritional signals, dietary filters, and real product data — bridging the gap between “I want to eat less meat” and a basket that actually achieves that without being boring. The quality of the agent’s reasoning is especially visible here: can it make opinionated, realistic tradeoffs between nutrition, taste, convenience, and what someone will actually keep buying week after week?

### Challenge 3 — The Automated Weekly Shop
* **Problem:** Most households have a recurring weekly pattern, but that pattern is never perfectly static. The overhead of manually building a basket each time is repetitive, and the occasional missed item — no coffee on Monday morning — is disproportionately annoying. The promise of agentic commerce is that this kind of routine task should eventually just happen: the right things arrive before you realise you needed them, while still adapting when the week looks different.
* **Goal:** Build an agent that handles the routine weekly shop with minimal user input. It should use order history to understand what someone usually buys, predict what they are likely to need this week, pick a delivery slot that fits their pattern, and surface only the exceptions that genuinely need a human — not every item. The goal is a working demo where the user says “sort this week’s shop” and the agent handles 80% of the work while only asking for the decisions that matter.
* **Why it's interesting:** This is the most automation-forward challenge. The tension between “do it for me” and “do not get it wrong” is real, and handling it gracefully — knowing when to act, when to check, and how to explain a choice — is what separates a useful agent from an annoying one. It makes heavy use of order history, delivery rhythm, basket logic, and exception handling. The most interesting solutions will not just predict rebuys, but handle unusual weeks well: guests, skipped dinners, holidays, changed delivery moments, or running out earlier than usual.

---

## What We're Looking For

> **Tip 💡:** Create your own history of products first if you don't have one yet.

Each sub-challenge is judged separately, with a winner per track. Judges will be looking for the same three things across all tracks:

* **Usefulness:** Would a real person actually want this? Does it save meaningful time or effort? Generic demos score low; something a Picnic customer would genuinely trust and use in their weekly routine scores high.
* **Quality of the agent loop:** How well does the agent handle ambiguity, edge cases, and multi-step reasoning? Does it ask the right questions, or does it barrel ahead and get it wrong?
* **Use of Picnic's intelligence:** Did you use order history, household routines, substitutions, delivery rhythm, basket logic, and richer catalogue signals, or did you mostly treat Picnic as a plain search API? We are especially interested in entries that lean into what makes recurring grocery missions different from general retail.

*Bonus points for anything that surfaces a genuine insight — about how customers delegate grocery decisions, where they still want control, where our API breaks down, or what a truly great conversational grocery experience should feel like.*
