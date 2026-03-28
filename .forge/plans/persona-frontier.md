---
spec: persona
total_tasks: 3
estimated_tokens: 18000
depth: standard
---

# Dual Customer Personas Frontier

## Tier 1 (parallel -- no dependencies)
- [T001] Generate student mock order dataset | est: ~6k tokens
- [T003] Demo persona comparison slide + step renumbering | est: ~6k tokens

## Tier 2 (depends on Tier 1)
- [T002] Persona selector UI + data pipeline wiring | est: ~6k tokens | depends: T001

---

## Task Details

### T001 -- Generate student mock order dataset

Create `scripts/generate-student-orders.ts`:
- Read product catalog from `src/data/product-catalog.json` (499 real Picnic products)
- Generate 50 orders spanning 1 year with student profile characteristics:
  - 6-10 items per order (smaller baskets)
  - EUR 25-50 per order (budget-conscious)
  - Products: pasta, rijst, noodles, bier, goedkoop brood, yoghurt, kaas, chips, magnetron maaltijden, koffie, energy drinks
  - Irregular cadence: sometimes weekly, sometimes 10-day gaps
  - Delivery: mixed Wednesday/Friday evenings
  - No premium products (no Starbucks beans, no organic, no specialty items)
  - Staples: 5-8 recurring items, more variety in occasional purchases
- Output matches existing mock-orders.json format (delivery_id, delivery_time, status, items with selling_unit_id/name/quantity/price/image_url)
- Save to `src/data/mock-orders-student.json`
- Use real product IDs from the catalog

Run the script after creation to generate the data file.

Files to create:
- `scripts/generate-student-orders.ts`

Files to produce:
- `src/data/mock-orders-student.json`

### T002 -- Persona selector UI + data pipeline wiring

Create `src/components/persona-selector.tsx`:
- Two clickable profile cards side by side (above input bar or in empty state)
- Card 1: "Family Household" -- "100 orders, avg EUR 200/week, Monday deliveries"
- Card 2: "Student" -- "50 orders, avg EUR 35/week, Wed/Fri deliveries"
- Selected persona has Picnic red border (`var(--picnic-red)`)
- Default selection: Family

Update `src/app/page.tsx`:
- Add persona state: `useState<"family" | "student">("family")`
- Import and render `PersonaSelector` component
- Pass persona to orchestration call
- Update mock data import to be conditional on persona

Update `src/hooks/use-orchestration.ts`:
- Accept persona parameter in the `orchestrate()` function signature
- Pass persona to API request body: `{ input, dietaryRestrictions, persona }`

Update `src/app/api/orchestrate/route.ts`:
- Read `persona` from request body (default: `"family"`)
- Load mock orders based on persona:
  - `"family"` -> `src/data/mock-orders.json`
  - `"student"` -> `src/data/mock-orders-student.json`
- Pass loaded data through to `prefetchAll()` or override the mock data fallback

Update `src/lib/picnic/prefetch.ts`:
- Accept optional `persona` parameter
- Load correct mock orders file based on persona value

Files to create:
- `src/components/persona-selector.tsx`

Files to modify:
- `src/app/page.tsx`
- `src/hooks/use-orchestration.ts`
- `src/app/api/orchestrate/route.ts`
- `src/lib/picnic/prefetch.ts`

### T003 -- Demo persona comparison slide + step renumbering

Create `src/components/demo/step-persona-comparison.tsx`:
- Title: "Same prompt. Different customer. Different cart."
- Two side-by-side cards:
  - Left: "Family Household" -- top 5 recommended items (dairy, bread, vegetables, family portions)
  - Right: "Student" -- top 5 recommended items (pasta, rice, budget yoghurt, instant noodles)
- Same prompt below both: "Sort this week's shop, under 60 euro"
- Animation: left card appears first, then right card slides in after a short delay
- Style consistent with existing demo step components

Update `src/app/demo/page.tsx`:
- Import `StepPersonaComparison`
- Insert as step 2 (after customer profile at step 1, before input parse)
- Renumber all subsequent steps (+1)
- Update `TOTAL_STEPS` from 11 to 12

Files to create:
- `src/components/demo/step-persona-comparison.tsx`

Files to modify:
- `src/app/demo/page.tsx`

---

## Coverage
- PERSONA-1 -> T001
- PERSONA-2 -> T002
- PERSONA-3 -> T003
