# Recipe Endpoints

Quick reference for all recipe endpoints — searching, browsing, recommendations,
and user-defined recipes.

**Type conventions in this doc:**
- IDs are **strings**
- Timestamps are **ISO 8601 strings**
- `?` after a type means the field may be absent or null

---

## Searching

### hackathon-search-recipes (GET)

Searches both system recipes and user-defined recipes (matched via
case-insensitive name pattern).

**Params:** `query` (string, required), `limit` (number, default 20)

**Response:**

| Field | Type | Description |
|-------|------|-------------|
| `query` | string | Echo of the search query |
| `recipes[]` | Recipe[] | See Recipe shape below |
| `total` | number | Length of recipes |

---

## Getting Details

### hackathon-get-recipe (GET)

**Params:** `id` (string, required — the recipe/sellable ID)

**Response:** Single Recipe object (see shape below).

### hackathon-get-recipes (GET)

Batch get multiple recipes at once.

**Params:** `ids` (string[], required — array of recipe IDs, must not be empty)

**Response:**

| Field | Type | Description |
|-------|------|-------------|
| `recipes[]` | Recipe[] | See Recipe shape below |
| `total` | number | Number of recipes found |

---

## Recommendations

### hackathon-get-recipe-recommendations (GET)

Returns personalized recommendations. Filters by customer preferences: disliked
ingredients, disliked protein types, missing kitchen appliances, vegan
preference. Only includes main courses with <=30 min prep time.

**Params:** `limit` (number, default 10)

**Response:**

| Field | Type | Description |
|-------|------|-------------|
| `recipes[]` | Recipe[] | See Recipe shape below |
| `total` | number | Length of recipes |

---

## User-Defined Recipes

Customers can create, update, and delete their own recipes. A user-defined
recipe is a named collection of selling units (products) with portions.

**ID mapping:** `save-user-defined-recipe` returns a `selling_group_id`. This
same value appears as the recipe's `id` field and is also the `sellable_id`
used by `delete-user-defined-recipe`. For updates, pass it as `selling_group_id`.

> **Limitation:** When you retrieve a user-defined recipe via `get-recipe`, the
> `ingredients` field will be `null`. The API does not echo back the
> `selling_units` you provided at creation time. If you need to rebuild the
> ingredient list later (e.g. to re-add items to cart), persist the
> `selling_units` and `selling_unit_quantities_by_id` on your side when you
> call `save-user-defined-recipe`.

### hackathon-save-user-defined-recipe (POST)

**Payload:**

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `name` | yes | string | Recipe name |
| `portions` | yes | number | Positive integer, number of portions |
| `selling_units` | yes | string[] | Non-empty array of selling unit IDs |
| `selling_unit_quantities_by_id` | yes | `{ [id]: number }` | Map of selling unit ID to quantity |
| `selling_unit_sources` | yes | `{ [id]: string }` | Map of selling unit ID to source type (`"search"` or `"suggestion"`) |
| `note` | no | string | Preparation instructions or notes |
| `id` | no | string | Optional ID for the recipe |

**Response:**

| Field | Type | Description |
|-------|------|-------------|
| `selling_group_id` | string | ID of the created recipe — use this for updates |

### hackathon-update-user-defined-recipe (POST)

At least one of `name`, `portions`, or `note` must be provided.

**Payload:**

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `selling_group_id` | yes | string | ID from save-user-defined-recipe |
| `name` | no | string | New recipe name |
| `note` | no | string | Preparation instructions or notes |
| `portions` | no | number | New portion count (positive integer, >= 1) |

**Response:**

| Field | Type |
|-------|------|
| `successful` | boolean (always `true` on success) |

### hackathon-delete-user-defined-recipe (POST)

**Payload:** `sellable_id` (string, required — the recipe's sellable ID)

**Response:**

| Field | Type |
|-------|------|
| `successful` | boolean (always `true` on success) |

---

## Recipe shape

Returned by `search-recipes`, `get-recipe`, `get-recipes`, and
`get-recipe-recommendations`.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Recipe/sellable ID |
| `name` | string | Recipe display name |
| `creator` | object | `{ id?: string, type: "PIM" \| "USER" }` |
| `display_names` | object? | `{ main_name: string, sub_name?: string }` |
| `display_tags` | object? | `{ tags: [{ name, rank, background_color?, icon?, text_color? }] }` |
| `images` | object? | `{ images: [{ id, type, namespace, primary, rank?, tile_type? }] }` |
| `ingredients` | Ingredient[]? | See shape below. **Always `null` for user-defined recipes** (creator type `USER`). Only populated for system recipes (creator type `PIM`). |
| `meal_characteristics` | object? | `{ course?, kitchen?, meal_solution?, meal_type?, protein?, protein_category? }` — all string |
| `portioning` | object | `{ available_portions: { type, maximum_portions, minimum_portions, portion_step }, default_portions }` |
| `portions` | number | Customer's personalized portion count |
| `preparation_note` | object? | `{ note: string }` — user-authored preparation instructions (user-defined recipes only) |
| `preparation_time` | object? | `{ active_preparation_time: string, preparation_time: string }` |
| `saved_at` | string? | ISO 8601 timestamp. Indicates when a user bookmarked a system (PIM) recipe. Always `null` for user-defined recipes and for system recipes not yet bookmarked. |
| `unavailability` | object? | `{ long_term_unavailable_core_component_count, short_term_unavailable_core_component_count }` |

### Ingredient shape

| Field | Type | Description |
|-------|------|-------------|
| `ingredient_id` | string | Ingredient identifier |
| `ingredient_type` | string | `"CORE"`, `"CORE_STOCKABLE"`, `"COMPLEMENTARY"`, `"CUPBOARD"`, `"HIDDEN_CUPBOARD"`, or `"VARIATION"` |
| `name` | string | Ingredient display name |
| `selling_unit_id` | string? | Selling unit ID, null if no matching product |
| `selling_unit_quantity` | number | Quantity needed |
| `order` | number | Display order within the recipe |
| `availability_status` | string | e.g. `"AVAILABLE"`, `"LONG_TERM_UNAVAILABLE"` |
| `display_ingredient_quantity` | number? | Human-readable quantity (e.g. `400` for 400g) |
| `display_unit_of_measurement` | string? | Unit label (e.g. `"g"`, `"ml"`) |
| `display_text_suffix` | string? | Extra text after the ingredient name |
| `ingredient_swap_type` | string? | Swap classification if applicable |
