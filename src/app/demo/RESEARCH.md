# Demo Page Research + Architecture

Research document for the `/demo` route -- an interactive animated explainer of the multi-agent grocery system, designed for projector presentation to hackathon judges.

---

## 1. Animation Approach

### Options Evaluated

**A. `motion` (Framer Motion) -- Already installed (v12.38.0)**

Strengths:
- `AnimatePresence` handles enter/exit transitions declaratively -- perfect for step transitions where elements mount/unmount.
- `variants` allow coordinating staggered animations (e.g., tokens appearing one by one) with a single parent `transition.staggerChildren`.
- `layout` animations make position changes smooth (e.g., tokens sliding from sentence into structured boxes).
- `useAnimate` (imperative API) gives precise sequencing for complex multi-phase animations within a single step.
- React-native integration -- no manual DOM manipulation, state drives animation.
- Hardware-accelerated transforms by default.

Weaknesses:
- Bundle size already paid (installed). No additional cost.
- Complex SVG path animations require manual `pathLength` work.

**B. Pure CSS animations + transitions**

Strengths:
- Zero bundle cost. Works everywhere.
- Good for simple opacity/transform transitions.

Weaknesses:
- No declarative enter/exit. Requires manual class toggling.
- Staggered animations need inline `animation-delay` or CSS custom properties on each element.
- No layout animations -- position changes require absolute positioning math.
- Sequencing multiple phases within a step requires `@keyframes` chaining, which is brittle and hard to read.

**C. SVG animations (SMIL / CSS on SVG)**

Strengths:
- Perfect for the DAG step (Step 4) -- the codebase already uses SVG with `<animateMotion>` in `dag-visualization.tsx`.
- Path drawing effects via `stroke-dashoffset`.

Weaknesses:
- SMIL is deprecated in some browsers. CSS animations on SVG are limited.
- Cannot handle React component transitions (mount/unmount).

### Decision: `motion` (Framer Motion) as primary, SVG for DAG step

Use `motion` for all step transitions and within-step element animations. For Step 4 (Agent DAG), use inline SVG with `motion` wrapping individual SVG `<g>` elements (Framer Motion supports SVG elements via `motion.g`, `motion.rect`, `motion.path`). This mirrors the existing `dag-visualization.tsx` pattern but adds controlled animation sequencing.

No CSS `@keyframes` except for the pulse ring effect (already exists in the codebase as `.dag-pulse`). No SMIL.

---

## 2. Interaction Model

### Options Evaluated

**A. Click-through stepper (presenter clicks to advance)**

Strengths:
- Presenter controls pacing -- essential for narrating to judges.
- Works reliably on any projector setup (no scroll sensitivity issues).
- Arrow keys or spacebar as triggers -- natural presentation UX.
- Can pause on any step to answer judge questions.
- Step indicator (1/7) gives judges a sense of progress.

Weaknesses:
- Requires keyboard/clicker interaction.

**B. Scroll-triggered (audience scrolls)**

Strengths:
- Feels modern and cinematic on personal devices.

Weaknesses:
- Projector scroll sensitivity varies wildly -- one scroll tick might skip 3 steps.
- Trackpad vs. mouse wheel behaves differently.
- Cannot reliably pause at a specific step.
- Judges see a scrollbar, which looks unpolished.

**C. Auto-play with pause**

Strengths:
- Hands-free operation.

Weaknesses:
- Presenter loses control of pacing.
- Judges may want to discuss a step -- auto-play forces awkward pausing.
- Different judges process at different speeds.

### Decision: Click-through stepper

Keyboard controls: ArrowRight / Space / Enter to advance, ArrowLeft to go back. A visible step indicator at the bottom shows progress (dots or numbered pills). Each step transition uses `AnimatePresence` with `mode="wait"` so the exit animation completes before the next step enters.

The stepper state is a simple `useState<number>` (0-6). A `useEffect` registers the keyboard listener. No routing -- all 7 steps live in a single page component with conditional rendering.

---

## 3. The 7 Animation Steps

### Step 1: Input Parse

**What it shows**: The user's natural language sentence is parsed into structured intent data.

**Visual sequence**:
1. A text input field fades in at center-screen with a blinking cursor effect.
2. The sentence "Make me lasagna on Wednesday, keep it under 80 euro" types out character by character (typewriter effect, ~40ms per character).
3. After a brief pause (400ms), the sentence splits into individual words. Each word becomes a `motion.span`.
4. Three words highlight with colored backgrounds:
   - "lasagna" -- `var(--agent-meal-planner)` (#8b5cf6, purple)
   - "Wednesday" -- `var(--agent-schedule)` (#0ea5e9, blue)
   - "80 euro" -- `var(--agent-budget)` (#f59e0b, amber)
5. Three structured boxes slide up from below with `layout` animation:
   - `meals[]` box containing "lasagna"
   - `guestEvents[]` box (empty, dimmed)
   - `budget` box containing "EUR 80.00"
6. The colored tokens animate from the sentence into their respective boxes using `layoutId` shared layout animations.

**Key motion APIs**: `motion.span` with `layoutId`, `AnimatePresence`, `variants` with `staggerChildren: 0.05` for the typewriter, `layout` prop on the boxes.

**Props interface**:
```typescript
interface StepInputParseProps {
  onComplete?: () => void;
}
```

**Complexity**: Medium. The `layoutId` animations from sentence to boxes require careful positioning. The typewriter effect is straightforward with `staggerChildren`.

---

### Step 2: Data Fetch

**What it shows**: The app fetches real data from Picnic's API in parallel.

**Visual sequence**:
1. A simplified app icon (or the text "hackaway") sits at the left side of the screen.
2. The Picnic logo/wordmark appears on the right side.
3. Three animated arrows (SVG paths) draw from left to right, one at a time with stagger:
   - Arrow 1: labeled "GET /orders"
   - Arrow 2: labeled "GET /products"
   - Arrow 3: labeled "GET /delivery-slots"
4. As each arrow completes, a data card flies in from the right:
   - Card 1: "100 past orders" with a small order icon (CSS-drawn receipt shape)
   - Card 2: "499 products searched" with a small grid icon
   - Card 3: "6 delivery slots" with a small clock icon
5. Below the cards, a small label fades in: "Parallel fetch -- all 3 in < 2 seconds"

**Key motion APIs**: SVG `motion.path` with `pathLength` for arrow drawing. `motion.div` with `initial={{ x: 100, opacity: 0 }}` and `animate={{ x: 0, opacity: 1 }}` for cards. `staggerChildren` on the parent.

**Props interface**:
```typescript
interface StepDataFetchProps {
  onComplete?: () => void;
}
```

**Complexity**: Low-medium. SVG path drawing is well-documented in Framer Motion. The data cards are simple translate + opacity.

---

### Step 3: Analysis

**What it shows**: Pure TypeScript analysis of order history -- no LLM needed for this phase.

**Visual sequence**:
1. A "terminal" styled container appears (dark background, monospace font) showing a brief code snippet: `classifyItems(orders)` with a blinking cursor.
2. The terminal shrinks to a corner as three analysis cards animate in with stagger:
   - Card A: "45 staple items identified" -- with a small horizontal bar showing the breakdown: staple (green), regular (blue), occasional (amber), one-time (gray). Bars grow from zero to their values.
   - Card B: "Average spend: EUR 78/week" -- with a mini sparkline (SVG polyline) showing spend over the last 10 orders.
   - Card C: "Top 5 co-purchases detected" -- a small list: "eggs + butter (92%)", "pasta + sauce (88%)", etc.
3. A badge fades in at the bottom: "Pure TypeScript -- no LLM needed" in a green-outlined chip (similar to the existing `reasoning-chip.tsx` style).

**Key motion APIs**: `motion.div` variants for the cards with `staggerChildren`. SVG `motion.rect` for bar chart animation (animate `width` from 0). SVG `motion.polyline` with `pathLength` for the sparkline.

**Props interface**:
```typescript
interface StepAnalysisProps {
  onComplete?: () => void;
}
```

**Complexity**: Medium. The bar chart and sparkline require SVG coordinate math, but they are static (hardcoded demo data, not real API data).

---

### Step 4: Agent DAG

**What it shows**: The 5-agent DAG executing with data flowing between nodes.

**Visual sequence**:
1. The DAG appears with all nodes in "pending" state (gray, low opacity) -- reuse the layout constants from `dag-visualization.tsx` (NODE_W=130, NODE_H=54, same column positions).
2. Node activation sequence (each with a 600ms delay):
   - Phase A: "Intent Parser" (prefetch) lights up in `var(--agent-prefetch)`. A pulse ring appears.
   - Phase B: Three nodes light up simultaneously: "Order Analyst" (`--agent-order-analyst`), "Meal Planner" (`--agent-meal-planner`), "Schedule Agent" (`--agent-schedule`). A bracket `{` and label "parallel" appear.
   - Phase C: "Orchestrator" (`--agent-orchestrator`) lights up. Edges from the three parallel agents animate with flowing dots (reuse the `<animateMotion>` pattern from the existing DAG component).
   - Phase D: "Budget Optimizer" (`--agent-budget`) lights up. The feedback loop edge (dashed, amber) draws with a dot flowing back to Meal Planner.
3. A caption below: "Fat context: each agent receives ALL data, not just its slice"
4. A small JSON snippet fades in showing the prompt structure: `{ orders: [...], products: [...], budget: 8000, meals: [...] }`

**Key motion APIs**: `motion.g` wrapping SVG groups. `animate` prop toggling fill/opacity. `transition.delay` for sequencing phases. CSS `@keyframes` only for the pulse ring (already exists as `.dag-pulse`).

**Design note**: This step is the most visually complex. Reuse as much as possible from the existing `dag-visualization.tsx`. The same node positions, colors, and edge paths can be used -- the only difference is that activation is scripted (timed sequence) rather than driven by real agent state.

**Props interface**:
```typescript
interface StepAgentDAGProps {
  onComplete?: () => void;
}
```

**Complexity**: High. The most complex step. However, the existing `dag-visualization.tsx` provides the exact SVG layout, node positions, edge paths, and styling. The task is to wrap those elements with `motion` and add sequenced activation. Estimated 150-200 lines.

---

### Step 5: Budget Conflict

**What it shows**: The budget optimizer detects an over-budget cart and resolves it.

**Visual sequence**:
1. A "cart total" appears large and centered: "EUR 95.40" in dark text.
2. Below it, a budget line renders: a horizontal bar at 100% width labeled "Budget: EUR 80.00".
3. The total bar fills to ~119% (overshooting the budget bar). The overshoot area is red (`var(--budget-red)`).
4. A red flash effect -- the entire background briefly flashes `var(--picnic-red-light)` (#fef2f1) for 200ms.
5. A label appears: "Over budget by EUR 15.40" in red text.
6. Two substitution cards slide in from the right:
   - "Brand-name olive oil EUR 8.99 -> Store brand EUR 4.49" with a savings chip: "- EUR 4.50"
   - "Premium pasta EUR 3.89 -> Regular pasta EUR 1.29" with a savings chip: "- EUR 2.60"
7. A removal card slides in:
   - "Fancy crackers EUR 6.49" with a strikethrough and "removed (occasional item)" chip
8. The total counter animates down: EUR 95.40 -> EUR 78.20 (number tween).
9. The bar shrinks to ~98%, turning green (`var(--budget-green)`).
10. A green checkmark fades in next to the total.

**Key motion APIs**: `motion.div` with `animate={{ width }}` for the bar. Number animation using `useMotionValue` + `useTransform` for the counter tween. `AnimatePresence` for the substitution cards entering. `motion.div` with `initial={{ x: 50, opacity: 0 }}` for card entries.

**Props interface**:
```typescript
interface StepBudgetConflictProps {
  onComplete?: () => void;
}
```

**Complexity**: Medium-high. The number tween requires `useMotionValue` and `useTransform` with `motion.span`. The bar animation and card entries are straightforward. The red flash is a simple background-color animation.

---

### Step 6: Cart Assembly

**What it shows**: The final cart with items, reasoning, and budget status.

**Visual sequence**:
1. An empty cart grid (3 columns, placeholder outlines) fades in.
2. Items slide into the grid one by one with stagger (staggerChildren: 0.08):
   - Each item card contains: product name, quantity, price, and a small colored reasoning chip (matching the existing `reasoning-chip.tsx` styles: "repeat" in stone, "recipe" in sky, "swap" in amber, etc.).
   - Example items: "Whole milk 1L" (repeat), "Pasta 500g" (recipe), "Store-brand olive oil" (swap), "Eggs 10-pack" (repeat), "Tomato sauce" (recipe), "Onions 1kg" (repeat).
3. After all items are placed, the budget bar from `budget-bar.tsx` slides in at the bottom, showing EUR 78.20 / EUR 80.00 (98% filled, green).
4. A subtle glow effect on the entire cart container to signal "complete".

**Key motion APIs**: `variants` with `staggerChildren` on the grid container. Each item is a `motion.div` with `initial={{ y: 20, opacity: 0 }}` and `animate={{ y: 0, opacity: 1 }}`. The budget bar uses `motion.div` with `animate={{ width: "98%" }}`.

**Props interface**:
```typescript
interface StepCartAssemblyProps {
  onComplete?: () => void;
}
```

**Complexity**: Low-medium. The grid layout and staggered entries are Framer Motion basics. The reasoning chips reuse existing styling from `reasoning-chip.tsx`.

---

### Step 7: Delivery

**What it shows**: The cart is submitted to Picnic and a delivery slot is confirmed.

**Visual sequence**:
1. Two API call visualizations appear as "terminal" styled rows:
   - `POST /cart/add-products` with a spinning indicator, then a green checkmark.
   - `POST /delivery-slot/set` with a spinning indicator, then a green checkmark.
2. Each row animates sequentially (second starts after first completes).
3. After both complete, a large confirmation card slides up from the bottom:
   - "Your groceries arrive Monday 18:00 - 21:00"
   - A small delivery truck icon (CSS/SVG) drives across the card from left to right.
   - Below: "12 items | EUR 78.20 | 3 meals planned"
4. Confetti-like effect: small colored dots (Picnic red, orange, green) scatter briefly from the center. Implemented with 15-20 `motion.div` elements with random `animate` targets for `x`, `y`, `opacity`, and `scale`.

**Key motion APIs**: `motion.div` for the API rows with sequential `transition.delay`. The truck animation uses `motion.svg` with `animate={{ x: [0, 300] }}`. Confetti uses array of `motion.div` with random physics-like trajectories.

**Props interface**:
```typescript
interface StepCheckoutProps {
  onComplete?: () => void;
}
```

**Complexity**: Low. The API call rows are simple opacity + icon swap. The truck is a basic x-translation. The confetti is a fun touch but uses only basic motion properties with randomized values.

---

## 4. Visual Design

### Color Palette (from existing `globals.css`)

| Token | Value | Usage |
|-------|-------|-------|
| `--background` | #FEFCFA | Page background |
| `--surface` | #FFFFFF | Card backgrounds |
| `--surface-muted` | #FAF7F4 | Secondary surfaces |
| `--text-primary` | #2D2319 | Headings, body text |
| `--text-secondary` | #6B5E52 | Captions, labels |
| `--text-muted` | #A89C90 | Disabled text, hints |
| `--picnic-red` | #E1423D | Primary accent, alerts |
| `--picnic-orange` | #E8590C | Secondary accent |
| `--picnic-red-light` | #FEF2F1 | Error backgrounds |
| `--border` | #EDE8E3 | Card borders |
| `--budget-green` | #2E9E5A | Under-budget states |
| `--budget-red` | #D93B3B | Over-budget states |
| `--agent-order-analyst` | #6366F1 | Order Analyst node |
| `--agent-meal-planner` | #8B5CF6 | Meal Planner node |
| `--agent-schedule` | #0EA5E9 | Schedule Agent node |
| `--agent-budget` | #F59E0B | Budget Optimizer node |
| `--agent-orchestrator` | #10B981 | Orchestrator node |
| `--agent-prefetch` | #94A3B8 | Intent Parser node |

All colors are already defined in the codebase. No new CSS custom properties needed.

### Typography

Follow the existing `globals.css` body font stack:
```
font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
```

| Element | Size | Weight | Color |
|---------|------|--------|-------|
| Step title | text-2xl (24px) | font-bold (700) | `--text-primary` |
| Step subtitle | text-base (16px) | font-normal (400) | `--text-secondary` |
| Data values | text-4xl (36px) | font-bold (700) | `--text-primary` |
| Labels | text-xs (12px) | font-semibold (600) uppercase tracking-wider | `--text-muted` |
| Code/terminal | text-sm (14px) monospace | font-normal (400) | #E2E8F0 on #1E293B bg |
| Chips/badges | text-xs (12px) | font-medium (500) | Varies by chip type |

### Card Styling

Match the existing component pattern (from `budget-bar.tsx`):
```
rounded-2xl bg-[var(--surface)] p-4 shadow-[0_1px_4px_rgba(0,0,0,0.05)]
```

### Layout

- Full viewport height per step (`h-screen`), centered content.
- Max content width: `max-w-4xl` (896px) -- wide enough for the DAG but not stretched on ultrawide projectors.
- Step indicator fixed at the bottom center: row of 7 dots, active dot is `var(--picnic-red)`, inactive dots are `var(--border)`.
- Step title at top-left of each step for context.

### Projector Considerations

- Dark-on-light color scheme (light backgrounds project well -- dark backgrounds wash out on most projectors).
- Minimum font size: 14px for any readable text. Labels can be 12px since they are supplementary.
- High contrast: `--text-primary` (#2D2319) on `--background` (#FEFCFA) gives a contrast ratio of ~14:1.
- No thin/hairline fonts -- minimum font-weight 400.
- Animations should be smooth but not too fast -- minimum 300ms for any transition, 600ms for major state changes.

---

## 5. Component Tree

```
src/app/demo/
  page.tsx                        -- Page shell: stepper state, keyboard listener, step indicator
  RESEARCH.md                     -- This document

src/components/demo/
  step-input-parse.tsx            -- Step 1: typewriter + token highlighting + structured boxes
  step-data-fetch.tsx             -- Step 2: API arrows + data cards
  step-analysis.tsx               -- Step 3: terminal + analysis cards + sparkline
  step-agent-dag.tsx              -- Step 4: DAG with sequenced node activation
  step-budget-conflict.tsx        -- Step 5: over-budget detection + substitutions + number tween
  step-cart-assembly.tsx           -- Step 6: item grid + reasoning chips + budget bar
  step-checkout.tsx               -- Step 7: API calls + confirmation + delivery truck
  step-indicator.tsx              -- Bottom navigation dots (shared across all steps)
```

### Props Interfaces

```typescript
// Shared step props -- every step component receives these
interface StepProps {
  isActive: boolean;       // Whether this step is currently visible
  onComplete?: () => void; // Optional callback when step animation finishes
}

// page.tsx state
interface DemoPageState {
  currentStep: number;     // 0-6
}
```

Each step component is self-contained: it manages its own animation timeline internally. The page shell only controls which step is mounted via `AnimatePresence`.

### page.tsx Structure (Pseudocode)

```typescript
"use client";

import { useState, useEffect } from "react";
import { AnimatePresence } from "motion/react";
// ... step imports

const STEPS = [
  StepInputParse,
  StepDataFetch,
  StepAnalysis,
  StepAgentDAG,
  StepBudgetConflict,
  StepCartAssembly,
  StepCheckout,
];

export default function DemoPage() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") {
        setStep((s) => Math.min(s + 1, 6));
      }
      if (e.key === "ArrowLeft") {
        setStep((s) => Math.max(s - 1, 0));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const CurrentStep = STEPS[step];

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[var(--background)]">
      <AnimatePresence mode="wait">
        <CurrentStep key={step} isActive={true} />
      </AnimatePresence>
      <StepIndicator current={step} total={7} />
    </div>
  );
}
```

### Import Style

Following the codebase convention: named exports from components, `"use client"` directive at top of every component, Tailwind for styling, CSS custom properties for colors.

---

## 6. Implementation Complexity Estimates

| Step | Component | Complexity | Estimated Lines | Notes |
|------|-----------|------------|-----------------|-------|
| 1 | step-input-parse.tsx | Medium | 120-150 | `layoutId` animations require careful element keys |
| 2 | step-data-fetch.tsx | Low-Medium | 80-100 | SVG path drawing is well-supported in motion |
| 3 | step-analysis.tsx | Medium | 100-130 | SVG bar chart and sparkline need coordinate math |
| 4 | step-agent-dag.tsx | High | 150-200 | Most complex; reuse `dag-visualization.tsx` layout |
| 5 | step-budget-conflict.tsx | Medium-High | 130-160 | Number tween with `useMotionValue` + substitution cards |
| 6 | step-cart-assembly.tsx | Low-Medium | 80-110 | Staggered grid is basic Framer Motion |
| 7 | step-checkout.tsx | Low | 70-90 | Sequential API rows + confirmation card |
| -- | page.tsx | Low | 50-70 | Stepper state + keyboard listener |
| -- | step-indicator.tsx | Low | 30-40 | Row of dots with active state |

**Total estimated**: 810-1050 lines across 9 files.

**Recommended implementation order**: page.tsx + step-indicator.tsx first (shell), then steps 1-7 in order. Step 4 is the hardest and should be tackled when the pattern is established from steps 1-3.

---

## 7. Packages Required

**None.** Everything needed is already installed:

- `motion` (v12.38.0) -- Framer Motion for React. Provides `motion/*`, `AnimatePresence`, `useMotionValue`, `useTransform`, `useAnimate`, `variants`.
- `react` (v19.2.4) -- `useState`, `useEffect`, `useCallback`.
- `tailwindcss` (v4.2.2) -- All layout and styling.
- SVG is native to React/JSX -- no library needed for the DAG or charts.

**Import path for motion v12**: `import { motion, AnimatePresence } from "motion/react"` (not `"framer-motion"` -- the package was renamed to `motion` in v11+).

---

## 8. Risks and Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `layoutId` animations jank on step transitions | Medium | Use `AnimatePresence mode="wait"` so exit completes before enter. Keep `layoutId` scoped within a single step -- do not share across steps. |
| Projector frame rate drops on complex SVG | Low | The DAG has only 6 nodes and 7 edges. CSS `will-change: transform` on animated elements. Avoid animating `filter` or `box-shadow`. |
| Keyboard events not firing (focus issue) | Medium | Add `tabIndex={0}` to the root container and auto-focus on mount. Prevent default on Space to avoid page scroll. |
| Step 4 DAG too complex to implement in time | Medium | Fall back to a simplified version: show nodes appearing in sequence without edge animation. Edge dots are a polish item. |
| Typewriter effect in Step 1 feels slow | Low | Make character delay configurable (default 40ms). Allow clicking to skip to completed state. |

---

## 9. Demo Flow Script (for presenter)

Suggested narration points for each step (for the presenter to follow):

1. **Input Parse**: "The user types one sentence. Our intent parser -- pure TypeScript, no LLM -- extracts meals, dates, and budget constraints."
2. **Data Fetch**: "We hit Picnic's real API. In under 2 seconds, we pull 100 past orders, search 499 products, and check delivery slots -- all in parallel."
3. **Analysis**: "Before any LLM touches the data, we run statistical analysis. We identify 45 staple items, calculate average spend, and find co-purchase patterns. No tokens burned."
4. **Agent DAG**: "Now the agents kick in. Five specialized agents run in a DAG -- three in parallel. Each gets the full context: orders, products, budget, meals. We call this 'fat context' prompting."
5. **Budget Conflict**: "The first cart comes in at 95 euros -- over budget. The budget optimizer swaps brand-name items for store brands and removes an occasional item. Total drops to 78.20."
6. **Cart Assembly**: "Here is the final cart. Every item has a reasoning chip explaining why it was chosen: repeat purchase, recipe ingredient, or budget substitution."
7. **Delivery**: "We push the cart to Picnic's API and lock in a delivery slot. Monday evening, groceries arrive. One sentence in, groceries at your door."
