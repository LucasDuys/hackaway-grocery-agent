# Multi-Agent Grocery Orchestration Dashboard -- UI Specification

> Comprehensive design reference for the split-panel grocery orchestration demo.
> Stack: Next.js 14+ (App Router) + Tailwind CSS + shadcn/ui + Motion (Framer Motion) + React Flow

---

## Table of Contents

1. [Layout Architecture](#1-layout-architecture)
2. [Color System](#2-color-system)
3. [Typography](#3-typography)
4. [Component Tree](#4-component-tree)
5. [Component Specifications](#5-component-specifications)
6. [DAG Visualization](#6-dag-visualization)
7. [Animation Specifications](#7-animation-specifications)
8. [Loading & Progress States](#8-loading--progress-states)
9. [shadcn/ui Component Mapping](#9-shadcnui-component-mapping)
10. [Responsive & Projector Considerations](#10-responsive--projector-considerations)
11. [Implementation Priority](#11-implementation-priority)

---

## 1. Layout Architecture

### Split-Panel Layout

```
+----------------------------------------------------------+
| Header Bar (56px)  [Logo] [Pipeline Status] [Mode Toggle] |
+---------------------------+------------------------------+
|                           |                              |
|   LEFT PANEL (60%)        |   RIGHT PANEL (40%)          |
|   Customer-Facing View    |   Agent Reasoning Feed       |
|                           |                              |
|   +---------------------+ |   +------------------------+ |
|   | Meal Plan Summary   | |   | DAG Visualization      | |
|   +---------------------+ |   | (compact, 180px tall)  | |
|   | Budget Progress Bar | |   +------------------------+ |
|   +---------------------+ |   | Agent Activity Feed    | |
|   |                     | |   | (scrollable, live)     | |
|   | Grocery Cart        | |   |                        | |
|   | (scrollable list)   | |   | [Agent Entry]          | |
|   |                     | |   | [Agent Entry]          | |
|   |                     | |   | [Agent Entry]          | |
|   |                     | |   | ...                    | |
|   +---------------------+ |   +------------------------+ |
+---------------------------+------------------------------+
```

### Panel Behavior

- **Default ratio**: 60% left / 40% right (optimized for projector readability)
- **Resizable**: Use shadcn/ui `<ResizablePanel>` (built on `react-resizable-panels`)
- **Collapsible right panel**: Toggle button in header switches between "Transparency Mode" (both panels) and "User Mode" (left only, right collapses to 0%)
- **Minimum widths**: Left 400px, Right 350px
- **Target resolution**: 1920x1080 (hackathon projector)
- **Panel collapse animation**: 300ms ease-out

### Implementation

```tsx
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"

<ResizablePanelGroup direction="horizontal" className="h-screen">
  <ResizablePanel defaultSize={60} minSize={30}>
    <CustomerPanel />
  </ResizablePanel>
  <ResizableHandle withHandle />
  <ResizablePanel defaultSize={40} minSize={0} collapsible>
    <AgentPanel />
  </ResizablePanel>
</ResizablePanelGroup>
```

---

## 2. Color System

### Base Palette

| Token                | Hex       | Usage                                    |
|----------------------|-----------|------------------------------------------|
| `--background`       | `#FAFAF9` | Page background (warm off-white)         |
| `--surface`          | `#FFFFFF` | Card surfaces                            |
| `--surface-muted`    | `#F5F5F4` | Muted backgrounds, skeleton fills        |
| `--border`           | `#E7E5E4` | Card borders, dividers                   |
| `--text-primary`     | `#1C1917` | Primary text (stone-950)                 |
| `--text-secondary`   | `#78716C` | Secondary text (stone-500)               |
| `--text-muted`       | `#A8A29E` | Timestamps, hints (stone-400)            |

### Picnic-Inspired Accent

Picnic's brand centers on an orange-red with a clean, friendly grocery aesthetic. We adapt this:

| Token                | Hex       | Usage                                    |
|----------------------|-----------|------------------------------------------|
| `--picnic-orange`    | `#E8590C` | Primary CTA, brand accent                |
| `--picnic-orange-light` | `#FFF4ED` | Orange tint backgrounds               |
| `--budget-green`     | `#16A34A` | Under budget, savings, additions         |
| `--budget-red`       | `#DC2626` | Over budget, removals, rejections        |
| `--budget-yellow`    | `#CA8A04` | Substitutions, warnings                  |

### Agent Color System (5 Agents)

Each agent gets a distinct, harmonious color. These are used for feed entries, DAG nodes, and badges.

| Agent              | Primary   | Light BG    | Border      | Tailwind Class     |
|--------------------|-----------|-------------|-------------|--------------------|
| Prefetch Agent     | `#6366F1` | `#EEF2FF`   | `#C7D2FE`   | `indigo-500`       |
| Analysis Agent     | `#8B5CF6` | `#F5F3FF`   | `#DDD6FE`   | `violet-500`       |
| Meal Planner       | `#0EA5E9` | `#F0F9FF`   | `#BAE6FD`   | `sky-500`          |
| Budget Optimizer   | `#F59E0B` | `#FFFBEB`   | `#FDE68A`   | `amber-500`        |
| Cart Builder       | `#10B981` | `#ECFDF5`   | `#A7F3D0`   | `emerald-500`      |

These colors were chosen to:
- Be distinguishable at projector distance
- Work on both light and dark backgrounds
- Follow a cool-to-warm spectrum (indigo -> violet -> sky -> amber -> emerald)
- Avoid red/green ambiguity for colorblind users (amber instead of pure red)

### Dark Mode Variant (Optional)

For dimmer hackathon venues:

| Token                | Hex       |
|----------------------|-----------|
| `--background`       | `#0C0A09` |
| `--surface`          | `#1C1917` |
| `--surface-muted`    | `#292524` |
| `--border`           | `#44403C` |
| `--text-primary`     | `#FAFAF9` |
| `--text-secondary`   | `#A8A29E` |

---

## 3. Typography

### Font Stack

```css
--font-sans: "Inter", system-ui, -apple-system, sans-serif;
--font-mono: "JetBrains Mono", "Fira Code", monospace;
```

### Scale (Optimized for Projector at 3-5m Distance)

| Element              | Size     | Weight | Line Height | Usage                        |
|----------------------|----------|--------|-------------|------------------------------|
| Page title           | 24px     | 700    | 1.2         | "Weekly Grocery Cart"        |
| Section heading      | 18px     | 600    | 1.3         | "Produce", "Dairy"           |
| Body / Cart items    | 15px     | 400    | 1.5         | Product names, descriptions  |
| Price / Numbers      | 16px     | 600    | 1.2         | Prices, totals (mono font)   |
| Badge text           | 12px     | 500    | 1.0         | Tags, status labels          |
| Agent feed text      | 14px     | 400    | 1.5         | Reasoning text               |
| Agent name           | 14px     | 600    | 1.2         | Agent identification         |
| Timestamp            | 12px     | 400    | 1.2         | Feed timestamps              |

---

## 4. Component Tree

```
<App>
  <Header>
    <Logo />
    <PipelineStatus steps={5} currentStep={number} />
    <ModeToggle />           {/* Transparency vs User mode */}
  </Header>

  <ResizablePanelGroup>
    {/* LEFT PANEL */}
    <CustomerPanel>
      <MealPlanSummary meals={Meal[]} />
      <BudgetProgressBar current={number} limit={number} />
      <GroceryCart>
        <CartCategoryGroup category={string}>
          <CartItem
            product={Product}
            diff={"added" | "removed" | "substituted" | "unchanged"}
            reasonTag={"repeat" | "substitution" | "recipe" | "suggestion"}
          />
        </CartCategoryGroup>
      </GroceryCart>
    </CustomerPanel>

    <ResizableHandle />

    {/* RIGHT PANEL */}
    <AgentPanel>
      <DAGVisualization
        agents={Agent[]}
        activeAgent={string}
        edges={Edge[]}
        feedbackLoop={boolean}
      />
      <AgentActivityFeed>
        <FeedEntry
          agent={Agent}
          action={string}
          reasoning={string}
          status={"thinking" | "done" | "rejected"}
          timestamp={Date}
          expandable={boolean}
        />
      </AgentActivityFeed>
    </AgentPanel>
  </ResizablePanelGroup>
</App>
```

---

## 5. Component Specifications

### 5.1 Header

**shadcn/ui base**: None (custom flex container)
**Height**: 56px
**Background**: `--surface` with bottom `--border`

```tsx
interface HeaderProps {
  pipelineStep: number        // 0-4 (which agent is active)
  isTransparencyMode: boolean // show/hide right panel
  onToggleMode: () => void
}
```

**Animation**: Mode toggle uses `motion.div` with `layout` prop for smooth icon transition.
**Est. time**: 30 min

---

### 5.2 PipelineStatus

**shadcn/ui base**: Custom (horizontal stepper)
**Purpose**: Shows 5-step pipeline with active/complete/pending states

```tsx
interface PipelineStatusProps {
  steps: { name: string; agent: AgentType; status: "pending" | "active" | "complete" | "error" }[]
}
```

Visual: Horizontal row of circles connected by lines. Each circle uses the agent's color. Active step pulses. Completed steps show a checkmark icon.

```
  [*]----[*]----[*]----[ ]----[ ]
 Prefetch Analyze Plan  Optimize Build
```

**Animation**:
- Active step: CSS pulse animation (scale 1.0 -> 1.15, 1.5s infinite)
- Completion: Checkmark draws in with SVG path animation (300ms)
- Connecting line fills with agent color left-to-right (200ms)

**Est. time**: 1 hour

---

### 5.3 MealPlanSummary

**shadcn/ui base**: `Card`, `Badge`
**Purpose**: Shows 7 meals for the week in a compact grid

```tsx
interface MealPlanSummaryProps {
  meals: {
    day: string        // "Mon", "Tue", ...
    name: string       // "Pasta Carbonara"
    tags: string[]     // ["quick", "Italian", "budget"]
  }[]
}
```

Visual: Horizontal scrollable row of small meal cards (or 7-column grid). Each card shows the day, meal name, and 1-2 tag badges.

**Animation**: Cards stagger in from left (50ms delay per card, slide-up + fade).
**Est. time**: 45 min

---

### 5.4 BudgetProgressBar

**shadcn/ui base**: `Progress`
**Purpose**: Shows current cart total vs weekly budget

```tsx
interface BudgetProgressBarProps {
  currentTotal: number    // e.g. 67.50
  budgetLimit: number     // e.g. 85.00
  previousTotal?: number  // last week, for comparison
  currency?: string       // "EUR"
}
```

Visual layout:
```
Budget  [================>        ]  EUR 67.50 / EUR 85.00
        ^-- green fill              ^-- number animates up
        ^-- turns amber at 80%, red at 95%
```

**Animation**:
- Fill width animates with `motion.div` spring transition (stiffness: 100, damping: 20)
- Price number uses spring counter animation (see Section 7.5)
- Color transitions smoothly between green/amber/red using CSS transitions

**Est. time**: 1 hour

---

### 5.5 GroceryCart

**shadcn/ui base**: `ScrollArea`, `Card`
**Purpose**: Main grocery list grouped by category

```tsx
interface GroceryCartProps {
  categories: {
    name: string         // "Produce", "Dairy", "Proteins", "Pantry", "Bakery", "Frozen"
    icon: string         // emoji or Lucide icon name
    items: CartItemData[]
  }[]
  isLoading: boolean
}
```

**Est. time**: 30 min (container only)

---

### 5.6 CartItem

**shadcn/ui base**: `Card` (compact variant), `Badge`
**Purpose**: Single product line in the cart

```tsx
interface CartItemProps {
  product: {
    name: string         // "Organic Bananas"
    image?: string       // product thumbnail URL
    price: number        // 1.49
    quantity: number     // 6
    unit: string         // "pcs" | "kg" | "L"
  }
  diff: "added" | "removed" | "substituted" | "unchanged"
  reasonTag?: "repeat" | "substitution" | "recipe" | "suggestion"
  substituteFor?: string  // if substitution, what it replaced
}
```

Visual layout:
```
+---+  Organic Bananas           [repeat]    6x   EUR 1.49
|img|  Substitution for: Regular Bananas
+---+  ^^^ shown only for substitutions
```

**Diff styling**:
- `added`: Left green border (3px), light green background (`#ECFDF5`)
- `removed`: Left red border, light red background, strikethrough text, 60% opacity
- `substituted`: Left yellow border, light yellow background, shows "Substitution for: X"
- `unchanged`: No special styling

**Reason tag badges** (using shadcn `Badge` variant="outline"):
- `[repeat]` -- grey outline badge
- `[substitution]` -- yellow badge
- `[recipe]` -- sky/blue badge
- `[suggestion]` -- violet badge

**Animation**:
- New items slide in from left (x: -20 -> 0) with fade (opacity: 0 -> 1), 200ms, ease-out
- Removed items fade out + slide right (x: 0 -> 20, opacity: 1 -> 0), 200ms
- Uses `AnimatePresence` for enter/exit
- Stagger: 40ms between siblings

**Est. time**: 1.5 hours

---

### 5.7 DAGVisualization

**shadcn/ui base**: None (React Flow)
**Purpose**: Shows the 5-agent pipeline as an interactive DAG with feedback loop

```tsx
interface DAGVisualizationProps {
  agents: AgentType[]
  activeAgent: AgentType | null
  completedAgents: AgentType[]
  feedbackLoop: {
    active: boolean        // is a rejection happening right now?
    from: AgentType        // Budget Optimizer
    to: AgentType          // Meal Planner
    reason?: string        // "Over budget by EUR 12.50"
  } | null
}
```

See Section 6 for full DAG specification.
**Est. time**: 3-4 hours

---

### 5.8 AgentActivityFeed

**shadcn/ui base**: `ScrollArea`
**Purpose**: Real-time scrolling feed of agent actions and reasoning

```tsx
interface AgentActivityFeedProps {
  entries: FeedEntryData[]
  autoScroll: boolean       // scroll to bottom on new entries
  filter?: AgentType        // optional: show only one agent
}
```

**Scroll behavior**: Auto-scrolls to newest entry. If user scrolls up, auto-scroll pauses. A "Jump to latest" button appears at the bottom.

**Est. time**: 1 hour

---

### 5.9 FeedEntry

**shadcn/ui base**: `Card` (compact), `Collapsible`, `Badge`
**Purpose**: Single entry in the agent activity feed

```tsx
interface FeedEntryProps {
  agent: {
    name: string          // "Budget Optimizer"
    type: AgentType
    color: string         // hex color
  }
  action: string           // "Rejected meal plan: over budget by EUR 12.50"
  reasoning?: string       // Expandable detailed reasoning
  status: "thinking" | "done" | "rejected" | "warning"
  timestamp: Date
  items?: string[]         // Optional: list of affected items
}
```

Visual layout:
```
+--------------------------------------------------------------+
| [colored dot] Budget Optimizer          12:34:05   [thinking] |
| Rejected meal plan: over budget by EUR 12.50                  |
| [v Expand reasoning]                                          |
|   "The total of EUR 97.50 exceeds the EUR 85.00 weekly       |
|    budget. Suggesting removal of premium steak (EUR 14.99)    |
|    and substitution with chicken thighs (EUR 6.49)."          |
+--------------------------------------------------------------+
```

**Status indicators**:
- `thinking`: Animated spinner (Lucide `Loader2` with `animate-spin`)
- `done`: Green checkmark (Lucide `Check`)
- `rejected`: Red X (Lucide `X`) with red-tinted background
- `warning`: Amber triangle (Lucide `AlertTriangle`)

**Animation**:
- Entry slides in from top (y: -10 -> 0) with fade, 200ms
- Collapsible reasoning expands with `motion.div` height animation (auto height)
- Rejected entries briefly flash their background color (red pulse, 500ms)

**Est. time**: 1.5 hours

---

### 5.10 CartCategoryGroup

**shadcn/ui base**: `Collapsible`
**Purpose**: Groups cart items by food category

```tsx
interface CartCategoryGroupProps {
  name: string            // "Produce"
  icon: ReactNode         // Lucide icon or emoji
  itemCount: number
  totalPrice: number
  children: ReactNode     // CartItem components
  defaultOpen?: boolean
}
```

Visual: Collapsible section with category header showing item count and subtotal.

**Animation**: Collapse/expand with `motion.div` layout animation (300ms spring).
**Est. time**: 30 min

---

## 6. DAG Visualization

### Recommended Approach: React Flow with Custom Nodes

React Flow is the clear winner for this use case:
- 17K+ weekly downloads, actively maintained (xyflow/xyflow)
- Custom nodes are just React components (easy to style with Tailwind)
- Built-in edge animations (AnimatedSvgEdge)
- Supports dagre layout engine for automatic DAG positioning
- Lightweight enough for a 5-node graph

### DAG Structure

```
[Prefetch] --> [Analyzer] --> [Meal Planner] --> [Budget Optimizer] --> [Cart Builder]
                                    ^                    |
                                    |                    |
                                    +--- FEEDBACK LOOP --+
                                    (rejection + reason)
```

### Node Layout (using dagre)

```tsx
// dagre layout config
const dagreGraph = new dagre.graphlib.Graph()
dagreGraph.setGraph({ rankdir: "LR", ranksep: 80, nodesep: 40 })
```

### Custom Agent Node Component

```tsx
function AgentNode({ data }: NodeProps) {
  const { agent, status } = data
  const colors = AGENT_COLORS[agent.type]

  return (
    <motion.div
      className={cn(
        "px-3 py-2 rounded-lg border-2 shadow-sm min-w-[120px] text-center",
        status === "active" && "shadow-lg",
      )}
      style={{
        backgroundColor: status === "active" ? colors.lightBg : "#fff",
        borderColor: status === "active" ? colors.primary : colors.border,
      }}
      animate={status === "active" ? {
        boxShadow: [
          `0 0 0 0px ${colors.primary}40`,
          `0 0 0 8px ${colors.primary}00`,
        ],
      } : {}}
      transition={status === "active" ? {
        duration: 1.5,
        repeat: Infinity,
        ease: "easeOut",
      } : {}}
    >
      <div className="text-xs font-medium" style={{ color: colors.primary }}>
        {agent.name}
      </div>
      {status === "active" && (
        <Loader2 className="w-3 h-3 animate-spin mx-auto mt-1" style={{ color: colors.primary }} />
      )}
      {status === "complete" && (
        <Check className="w-3 h-3 mx-auto mt-1 text-emerald-500" />
      )}
    </motion.div>
  )
}
```

### Edge Animations

**Normal flow edges**: Animated dashed line (CSS `stroke-dashoffset` animation), moving left-to-right to show data flow direction.

```css
@keyframes dash-flow {
  to { stroke-dashoffset: -20; }
}
.react-flow__edge-path.active {
  stroke-dasharray: 5 5;
  animation: dash-flow 0.5s linear infinite;
}
```

**Feedback loop edge**: This is the dramatic moment. When Budget Optimizer rejects:

1. The feedback edge appears with a red color (`#DC2626`)
2. An animated circle travels along the edge from Budget Optimizer back to Meal Planner (use React Flow's `AnimatedSvgEdge`)
3. The edge pulses red 3 times (300ms each)
4. Both the Budget Optimizer and Meal Planner nodes briefly flash
5. A floating label on the edge shows the rejection reason

```tsx
// Feedback edge with animated marker
const feedbackEdge = {
  id: "feedback",
  source: "budget-optimizer",
  target: "meal-planner",
  type: "animatedSvg",
  style: { stroke: "#DC2626", strokeWidth: 2 },
  animated: true,
  label: "Over budget! -EUR 12.50",
  labelStyle: { fill: "#DC2626", fontWeight: 600, fontSize: 11 },
}
```

### Compact Layout

The DAG should be compact (full width, ~180px tall) to leave room for the activity feed below. Use `fitView` with padding.

```tsx
<ReactFlow
  nodes={nodes}
  edges={edges}
  nodeTypes={nodeTypes}
  edgeTypes={edgeTypes}
  fitView
  fitViewOptions={{ padding: 0.3 }}
  panOnDrag={false}
  zoomOnScroll={false}
  zoomOnPinch={false}
  preventScrolling={false}
  className="h-[180px]"
>
  <Background variant="dots" gap={16} size={1} color="#E7E5E4" />
</ReactFlow>
```

### Dependencies

```bash
npm install @xyflow/react dagre @types/dagre
```

---

## 7. Animation Specifications

### 7.1 Motion Tokens (Global)

```tsx
// lib/motion-tokens.ts
export const MOTION = {
  duration: {
    instant: 0.1,      // micro-feedback
    fast: 0.2,         // state changes, badge appear
    normal: 0.3,       // panel transitions, collapse/expand
    slow: 0.5,         // dramatic moments (rejection flash)
    stagger: 0.04,     // delay between sibling items
  },
  ease: {
    default: [0.25, 0.1, 0.25, 1.0],           // CSS ease
    out: [0, 0, 0.2, 1],                        // decelerate
    spring: { type: "spring", stiffness: 300, damping: 25 },
    bounce: { type: "spring", stiffness: 400, damping: 15 },
    gentle: { type: "spring", stiffness: 100, damping: 20 },
  },
} as const
```

### 7.2 Feed Entry Animation

```tsx
// New feed entries slide down from top
const feedEntryVariants = {
  initial: { opacity: 0, y: -10, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -5, scale: 0.98 },
}

<AnimatePresence mode="popLayout">
  {entries.map((entry, i) => (
    <motion.div
      key={entry.id}
      variants={feedEntryVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
      layout
    >
      <FeedEntry {...entry} />
    </motion.div>
  ))}
</AnimatePresence>
```

### 7.3 Cart Item Stagger

```tsx
const cartContainerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.1,
    },
  },
}

const cartItemVariants = {
  hidden: { opacity: 0, x: -20 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.2, ease: [0, 0, 0.2, 1] },
  },
}

<motion.div variants={cartContainerVariants} initial="hidden" animate="show">
  {items.map(item => (
    <motion.div key={item.id} variants={cartItemVariants}>
      <CartItem {...item} />
    </motion.div>
  ))}
</motion.div>
```

### 7.4 Budget Bar Fill

```tsx
<motion.div
  className="h-full rounded-full"
  style={{ backgroundColor: barColor }}
  initial={{ width: "0%" }}
  animate={{ width: `${percentage}%` }}
  transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.3 }}
/>
```

### 7.5 Animated Price Counter

```tsx
import { useSpring, useTransform, motion } from "motion/react"

function AnimatedPrice({ value }: { value: number }) {
  const spring = useSpring(0, { stiffness: 100, damping: 20 })
  const display = useTransform(spring, (v) =>
    new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(v)
  )

  useEffect(() => { spring.set(value) }, [value, spring])

  return <motion.span className="font-mono font-semibold tabular-nums">{display}</motion.span>
}
```

### 7.6 Rejection Flash (Dramatic Moment)

When the Budget Optimizer rejects a plan, this is the highlight of the demo. The sequence:

1. **Feed entry appears** with red background flash (0 -> 500ms)
2. **DAG feedback edge** animates into view (200ms -> 800ms)
3. **Animated dot** travels along feedback edge (300ms -> 1200ms)
4. **Meal Planner node** pulses to indicate it received the rejection (1000ms -> 1500ms)
5. **Cart items** that will change get highlighted with yellow border (1200ms -> 2000ms)
6. **New plan** entries start appearing in feed (2000ms+)

```tsx
// Rejection flash on feed entry background
const rejectionVariants = {
  initial: { backgroundColor: "rgba(220, 38, 38, 0)" },
  flash: {
    backgroundColor: [
      "rgba(220, 38, 38, 0.15)",
      "rgba(220, 38, 38, 0.05)",
      "rgba(220, 38, 38, 0.15)",
      "rgba(220, 38, 38, 0.05)",
    ],
    transition: { duration: 1.2, times: [0, 0.3, 0.6, 1] },
  },
}
```

### 7.7 Skeleton Loading for Cart

```tsx
// While agents are working, show skeleton cart
function CartSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          className="flex items-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.05 }}
        >
          <Skeleton className="h-12 w-12 rounded-md" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-4 w-16" />
        </motion.div>
      ))}
    </div>
  )
}
```

---

## 8. Loading & Progress States

### Pipeline Progression

The pipeline has 5 stages. Each maps to an agent:

| Step | Agent             | Duration (simulated) | What Happens on Screen                          |
|------|-------------------|----------------------|-------------------------------------------------|
| 1    | Prefetch Agent    | 1.5s                 | Skeleton cart appears, "Fetching your history..."   |
| 2    | Analysis Agent    | 2s                   | Past order patterns appear in feed              |
| 3    | Meal Planner      | 3s                   | Meal cards populate one by one                  |
| 4    | Budget Optimizer  | 2s                   | Budget bar fills, possible rejection            |
| 5    | Cart Builder      | 2s                   | Cart items stagger in by category               |

### State Machine

```
IDLE -> PREFETCHING -> ANALYZING -> PLANNING -> OPTIMIZING -> BUILDING -> COMPLETE
                                      ^              |
                                      |              | (if over budget)
                                      +-REPLANNING---+
```

### Visual States per Component

| Component          | IDLE        | WORKING          | COMPLETE         | ERROR             |
|--------------------|-------------|------------------|------------------|-------------------|
| Pipeline Status    | All grey    | Active pulses    | All checked      | Error step red    |
| Meal Plan Summary  | Empty       | Skeleton cards   | Populated cards  | --                |
| Budget Bar         | Hidden      | Filling          | Filled + total   | Red overshoot     |
| Grocery Cart       | Empty msg   | Skeleton items   | Full cart        | --                |
| DAG                | All grey    | Active node glow | All green        | Error node red    |
| Activity Feed      | Empty       | Entries stream   | Summary entry    | Error entry       |

### "Disagreement" Moment

This is the demo's dramatic peak. When the Budget Optimizer rejects:

1. Pipeline status step 4 shows a red X icon
2. A prominent feed entry appears: "REJECTED: Over budget by EUR 12.50"
3. The DAG feedback edge animates (red, pulsing)
4. Pipeline rewinds: step 3 reactivates with pulse
5. New feed entries from Meal Planner stream in
6. Cart items that change get diff highlighting (yellow for substitutions)
7. Budget bar adjusts downward with spring animation
8. Pipeline resumes forward: step 4 re-evaluates, this time approves

Total disagreement sequence: ~4-5 seconds of choreographed animation.

---

## 9. shadcn/ui Component Mapping

### Required shadcn/ui Components

Install these via the shadcn CLI:

```bash
npx shadcn@latest add badge
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add collapsible
npx shadcn@latest add progress
npx shadcn@latest add resizable
npx shadcn@latest add scroll-area
npx shadcn@latest add separator
npx shadcn@latest add skeleton
npx shadcn@latest add toggle
npx shadcn@latest add tooltip
```

### Mapping to Custom Components

| Custom Component      | shadcn/ui Base                        | Customization                                       |
|-----------------------|---------------------------------------|-----------------------------------------------------|
| Header                | --                                    | Custom flex container                               |
| PipelineStatus        | --                                    | Custom SVG circles + lines                          |
| ModeToggle            | `Toggle`                              | Icon swap (Eye/EyeOff)                              |
| MealPlanSummary       | `Card`                                | Compact variant, horizontal scroll                  |
| BudgetProgressBar     | `Progress`                            | Custom color logic, animated number overlay         |
| GroceryCart           | `ScrollArea`                          | Category grouping wrapper                           |
| CartCategoryGroup     | `Collapsible`                         | Custom header with count + subtotal                 |
| CartItem              | `Card` (compact)                      | Diff border colors, reason Badge                    |
| ReasonTag             | `Badge` (variant="outline")           | Color per tag type                                  |
| DAGVisualization      | -- (React Flow)                       | Custom nodes with Tailwind                          |
| AgentActivityFeed     | `ScrollArea`                          | Auto-scroll logic, filter buttons                   |
| FeedEntry             | `Card` + `Collapsible`                | Agent color coding, status icon                     |
| StatusIcon            | -- (Lucide icons)                     | Loader2 (spinning), Check, X, AlertTriangle         |

### Additional Dependencies

```json
{
  "dependencies": {
    "@xyflow/react": "^12.0.0",
    "dagre": "^0.8.5",
    "motion": "^12.0.0",
    "lucide-react": "^0.400.0"
  },
  "devDependencies": {
    "@types/dagre": "^0.7.52"
  }
}
```

---

## 10. Responsive & Projector Considerations

### Target: 1920x1080 Projector

- **Font sizes already scaled up** (minimum 12px for badges, 14-15px for body)
- **High contrast**: Use `--text-primary` (#1C1917) on `--background` (#FAFAF9), contrast ratio > 15:1
- **Avoid thin fonts**: Minimum weight 400, prefer 500-600 for key information
- **Color saturation**: Agent colors are medium-high saturation for projector visibility
- **No hover-only information**: Everything important should be visible without mouse interaction (judges watch, they don't interact)

### Layout at 1920x1080

```
Header:     1920 x 56px
Left Panel: 1152 x 1024px  (60%)
Handle:     8 x 1024px
Right Panel: 760 x 1024px  (40%)
```

### Fallback for Smaller Screens (Laptop Demo)

At < 1400px width:
- Switch to stacked layout (left on top, right below)
- Or: Collapse right panel by default, show toggle button
- DAG visualization switches to vertical orientation (top-to-bottom)

### Font Scaling

```css
/* Projector mode: bump everything slightly */
@media (min-width: 1800px) {
  :root {
    font-size: 16px;  /* base */
  }
}

/* Laptop fallback */
@media (max-width: 1400px) {
  :root {
    font-size: 14px;
  }
}
```

---

## 11. Implementation Priority

### Phase 1: Skeleton + Layout (2-3 hours)

Build the structural shell with static/mock data.

1. **Project setup**: Next.js + Tailwind + shadcn/ui initialization
2. **Resizable split panel layout** (Header + ResizablePanelGroup)
3. **Mode toggle** (show/hide right panel)
4. **Cart skeleton loading state**
5. **Basic feed entry** (no animation yet)

Deliverable: A split-panel layout that works on projector, with skeleton states.

### Phase 2: Cart + Data (2-3 hours)

Populate the left panel with grocery data.

1. **CartItem component** with diff styling and reason tags
2. **CartCategoryGroup** collapsible sections
3. **BudgetProgressBar** with color thresholds
4. **MealPlanSummary** card row
5. Wire up with mock grocery data (realistic products, prices)

Deliverable: A fully populated grocery cart that looks like a real grocery app.

### Phase 3: Agent Feed + DAG (3-4 hours)

Build the right panel intelligence layer.

1. **React Flow DAG** with 5 custom agent nodes
2. **DAG edge animations** (dashed flow lines)
3. **AgentActivityFeed** with ScrollArea and auto-scroll
4. **FeedEntry** with status icons and collapsible reasoning
5. **Agent color coding** throughout

Deliverable: A live-updating agent reasoning feed with visual DAG.

### Phase 4: Orchestration + Animation (2-3 hours)

Wire up the pipeline and add the choreographed animations.

1. **Pipeline state machine** driving all components
2. **Staggered cart item entry** animation
3. **Feed entry slide-in** animation
4. **Budget bar spring fill** animation
5. **Animated price counter**
6. **PipelineStatus** stepper with completion animations

Deliverable: The full pipeline runs end-to-end with smooth animations.

### Phase 5: The Rejection Moment (1-2 hours)

The dramatic demo highlight -- Budget Optimizer disagrees.

1. **Feedback edge** animation on DAG (red, pulsing, animated dot)
2. **Rejection flash** on feed entry
3. **Cart diff update** (items swap with yellow highlighting)
4. **Budget bar adjustment** (springs down, then back up)
5. **Pipeline rewind** visual (step 3 reactivates)
6. **Choreograph the full 5-second sequence** with precise timing

Deliverable: The "wow moment" that makes judges understand why multi-agent is special.

### Phase 6: Polish (1-2 hours)

Final refinements for demo day.

1. Dark mode toggle (if venue is dim)
2. Typography fine-tuning at projector distance
3. Performance optimization (React.memo on CartItem, feed virtualization if > 50 entries)
4. Keyboard shortcut to restart demo
5. Pre-recorded data replay mode (deterministic timing for demo)

---

## Appendix A: Mock Data Structure

```tsx
// types/grocery.ts

type AgentType = "prefetch" | "analyzer" | "meal-planner" | "budget-optimizer" | "cart-builder"

interface Product {
  id: string
  name: string
  category: "produce" | "dairy" | "proteins" | "pantry" | "bakery" | "frozen" | "beverages"
  price: number
  unit: "pcs" | "kg" | "L" | "pack"
  image?: string
}

interface CartItem {
  product: Product
  quantity: number
  diff: "added" | "removed" | "substituted" | "unchanged"
  reasonTag?: "repeat" | "substitution" | "recipe" | "suggestion"
  substituteFor?: string
}

interface Meal {
  day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun"
  name: string
  tags: string[]
  ingredients: string[]  // product IDs
}

interface FeedEntry {
  id: string
  agent: AgentType
  action: string
  reasoning?: string
  status: "thinking" | "done" | "rejected" | "warning"
  timestamp: Date
  affectedItems?: string[]  // product IDs
}

interface PipelineState {
  currentStep: number       // 0-4
  phase: "idle" | "running" | "replanning" | "complete"
  feedbackCount: number     // how many times optimizer rejected
}
```

## Appendix B: Agent Color Constants

```tsx
// lib/agent-colors.ts

export const AGENT_COLORS = {
  prefetch: {
    name: "Prefetch Agent",
    primary: "#6366F1",      // indigo-500
    lightBg: "#EEF2FF",      // indigo-50
    border: "#C7D2FE",       // indigo-200
    text: "#4338CA",         // indigo-700
    tailwind: "indigo",
  },
  analyzer: {
    name: "Analysis Agent",
    primary: "#8B5CF6",      // violet-500
    lightBg: "#F5F3FF",      // violet-50
    border: "#DDD6FE",       // violet-200
    text: "#6D28D9",         // violet-700
    tailwind: "violet",
  },
  "meal-planner": {
    name: "Meal Planner",
    primary: "#0EA5E9",      // sky-500
    lightBg: "#F0F9FF",      // sky-50
    border: "#BAE6FD",       // sky-200
    text: "#0369A1",         // sky-700
    tailwind: "sky",
  },
  "budget-optimizer": {
    name: "Budget Optimizer",
    primary: "#F59E0B",      // amber-500
    lightBg: "#FFFBEB",      // amber-50
    border: "#FDE68A",       // amber-200
    text: "#B45309",         // amber-700
    tailwind: "amber",
  },
  "cart-builder": {
    name: "Cart Builder",
    primary: "#10B981",      // emerald-500
    lightBg: "#ECFDF5",      // emerald-50
    border: "#A7F3D0",       // emerald-200
    text: "#047857",         // emerald-700
    tailwind: "emerald",
  },
} as const
```

## Appendix C: File Structure

```
src/
  app/
    page.tsx                     # Main orchestration page
    layout.tsx                   # Root layout with fonts
    globals.css                  # Tailwind + CSS variables
  components/
    layout/
      header.tsx                 # Header bar
      customer-panel.tsx         # Left panel container
      agent-panel.tsx            # Right panel container
    pipeline/
      pipeline-status.tsx        # Horizontal stepper
      mode-toggle.tsx            # Transparency mode switch
    cart/
      grocery-cart.tsx           # Cart container with categories
      cart-category-group.tsx    # Collapsible category section
      cart-item.tsx              # Individual product line
      cart-skeleton.tsx          # Loading skeleton
      reason-tag.tsx             # Badge for item reasoning
    meal-plan/
      meal-plan-summary.tsx      # Weekly meal grid
    budget/
      budget-progress-bar.tsx    # Budget bar with animated number
      animated-price.tsx         # Spring-animated price display
    dag/
      dag-visualization.tsx      # React Flow wrapper
      agent-node.tsx             # Custom React Flow node
      feedback-edge.tsx          # Custom animated edge
    feed/
      agent-activity-feed.tsx    # Scrollable feed container
      feed-entry.tsx             # Individual feed card
    ui/                          # shadcn/ui generated components
      badge.tsx
      button.tsx
      card.tsx
      collapsible.tsx
      progress.tsx
      resizable.tsx
      scroll-area.tsx
      separator.tsx
      skeleton.tsx
      toggle.tsx
      tooltip.tsx
  lib/
    agent-colors.ts              # Agent color constants
    motion-tokens.ts             # Animation duration/easing constants
    types.ts                     # TypeScript interfaces
    mock-data.ts                 # Realistic grocery mock data
    pipeline-orchestrator.ts     # State machine for demo flow
  hooks/
    use-pipeline.ts              # Pipeline state management hook
    use-auto-scroll.ts           # Auto-scroll feed hook
    use-animated-number.ts       # Spring number animation hook
```

---

## Appendix D: Key Design Decisions Summary

| Decision                    | Choice                          | Rationale                                                |
|-----------------------------|---------------------------------|----------------------------------------------------------|
| Panel library               | shadcn/ui Resizable             | Built on react-resizable-panels, native shadcn ecosystem |
| DAG library                 | React Flow + dagre              | Best React integration, custom nodes, edge animations    |
| Animation library           | Motion (Framer Motion)          | Industry standard, spring physics, AnimatePresence       |
| Panel ratio                 | 60/40                           | Cart is primary; feed needs enough width for readability |
| Color scheme                | Light mode default              | Better projector contrast; dark mode as toggle           |
| Agent colors                | Indigo/Violet/Sky/Amber/Emerald | Harmonious, distinguishable, colorblind-safe             |
| Cart item animation         | Stagger slide-in from left      | Feels like items being "placed" into cart                |
| Feed animation              | Slide down from top             | Mimics real-time log stream, newest on top               |
| Feedback loop visualization | Red animated edge + node flash  | Makes disagreement visually dramatic for demo            |
| Number animation            | useSpring + useTransform        | Smooth physics-based counting, no jitter                 |
| Font                        | Inter + JetBrains Mono          | Excellent readability at distance; mono for numbers      |
