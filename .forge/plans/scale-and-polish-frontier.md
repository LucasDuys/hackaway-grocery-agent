---
spec: scale-and-polish
total_tasks: 3
estimated_tokens: 18k
depth: standard
---

# Scale and Polish Frontier

## Tier 1 (parallel -- no dependencies)
- [T001] Verify and improve mock order data quality | est: ~6k tokens
- [T002] Update ARCHITECTURE.md to reflect current state | est: ~5k tokens
- [T003] Update demo presentation to reflect current features | est: ~7k tokens

---

### T001: Verify and improve mock order data quality

**Goal**: Ensure the 100 mock orders are high-quality, realistic, and internally consistent.

**Steps**:
1. Load `src/data/mock-orders.json` and cross-reference every `product_id` against the product catalog -- flag any stale/missing IDs
2. Validate all `image_url` hashes are exactly 64 hex characters (SHA-256)
3. Check order dates span approximately 2 years with realistic weekly cadence (roughly 1 order/week)
4. Verify variety metrics: 15+ staple items appearing in 70%+ of orders, 20+ regular items, seasonal variation present
5. If any data quality issues are found, fix `scripts/seed-orders.ts` and regenerate `src/data/mock-orders.json`
6. Add a stats summary output to the seed script (printed on run): "100 orders, N unique products, avg M items/order, EUR X avg spend"

**Files**:
- `scripts/seed-orders.ts`
- `src/data/mock-orders.json`

---

### T002: Update ARCHITECTURE.md to reflect current state

**Goal**: Bring the architecture doc up to date with all features added since initial writing.

**Steps**:
1. Read the full current `ARCHITECTURE.md`
2. Update existing sections to reflect current implementation details
3. Add or update coverage for:
   - Dietary restriction support (guest-specific restrictions)
   - Preference memory (accumulated learning across sessions)
   - Proactive notification (periodic autonomy)
   - Image proxy/CDN integration (direct CDN with SHA-256 hashes)
   - Live price search for fallback items
   - Pipeline timing instrumentation
   - Demo page at `/demo` (10 slides)
   - Story mode vs log mode in activity feed
   - Agent handoff indicators
   - Guest-specific dietary restrictions
4. Ensure the document structure remains clean and consistent

**Files**:
- `ARCHITECTURE.md`

---

### T003: Update demo presentation to reflect current features

**Goal**: Update the demo slide deck to showcase all current capabilities accurately.

**Steps**:
1. Read all step components in `src/components/demo/` and the demo page at `src/app/demo/page.tsx`
2. Update `step-summary.tsx` (final slide) to include:
   - Dietary awareness (guest-specific + user preferences)
   - Preference learning (accumulated memory across sessions)
   - Pipeline timing (show real timing data)
   - Live price verification from Picnic API
3. Update `step-analysis.tsx` to mention dietary filtering
4. Update `step-budget-conflict.tsx` to mention max 3 swaps + protected items
5. Ensure all demo data uses realistic Dutch grocery items with correct EUR prices
6. Add a scale mention: "Analyzed 100 orders in <50ms, 499 products indexed"
7. Verify `step-recipes.tsx` still renders correctly (no renumbering issues)

**Files**:
- `src/components/demo/step-summary.tsx`
- `src/components/demo/step-analysis.tsx`
- `src/components/demo/step-budget-conflict.tsx`
- `src/components/demo/step-recipes.tsx`
- `src/components/demo/step-agent-dag.tsx`
- `src/components/demo/step-cart-assembly.tsx`
- `src/components/demo/step-checkout.tsx`
- `src/components/demo/step-data-fetch.tsx`
- `src/components/demo/step-input-parse.tsx`
- `src/app/demo/page.tsx`

---

## Coverage
- SCALE-1 -> T001
- SCALE-2 -> T002
- SCALE-3 -> T003
