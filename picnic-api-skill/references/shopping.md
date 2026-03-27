# Shopping Endpoints

Quick reference for all product, cart, category, favorite, delivery, and order
endpoints. For request/response conventions see the SKILL.md Key conventions
section.

**Type conventions in this doc:**
- Prices are **integer cents** (divide by 100 for EUR)
- IDs are **strings**
- Timestamps are **epoch milliseconds** (numbers) in hackathon endpoint responses.
  The `set_delivery_slot` direct REST endpoint returns **ISO 8601 strings** instead.
- `?` after a type means the field may be absent or null

---

## Products

### hackathon-search-products (GET)

**Params:** `query` (string, required), `limit` (number, default 20)

**Response:**

| Field | Type | Description |
|-------|------|-------------|
| `query` | string | Echo of the search query |
| `results[]` | Product[] | See Product shape below |
| `total` | number | Length of results |

### hackathon-get-product (GET)

**Params:** `selling_unit_id` (string, required)

**Response:** Single Product object (see shape below). Also includes:

| Extra field | Type | Description |
|-------------|------|-------------|
| `description` | string? | Rich text product description |
| `images` | string[]? | Array of image hash strings |
| `max_order_quantity` | number | Maximum units per order |
| `nutritional_info[]` | NutritionalInfo[]? | See shape below |

### hackathon-get-product-alternatives (GET)

**Params:** `selling_unit_id` (string, required)

**Response:**

| Field | Type | Description |
|-------|------|-------------|
| `alternatives[]` | Product[] | Product shape plus `description`, `images` (string[]), `max_order_quantity`, and `nutritional_info` |
| `total` | number | Length of alternatives |

### hackathon-search-suggestions (GET)

**Params:** `query` (string, required)

**Response:**

| Field | Type | Description |
|-------|------|-------------|
| `query` | string | Echo of the query |
| `suggestions[]` | string[] | Up to 7 autocomplete suggestions |

### Product shape

Returned by `search-products`, `get-product`, and `get-product-alternatives`.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Selling unit ID (e.g. `"s1132274"`) |
| `availability` | string | `"AVAILABLE"` or `"LONG_TERM_UNAVAILABLE"` |
| `brand` | string? | Brand name |
| `bundle_size` | number? | Number of articles in the bundle |
| `characteristics` | object? | Flags: `organic`, `frozen`, `bbq`, etc. |
| `countries_of_origin` | string[]? | Country codes |
| `discount_price` | number? | Discounted price in cents, null if none |
| `freshness` | object? | `{ fresh_days: number, freshness_guarantee: string, perishable: boolean }` |
| `image_url` | string | Image hash |
| `name` | string | Product display name |
| `packaging` | object? | `{ pieces?: number, volume?: number, volume_unit?: string, weight?: number, weight_unit?: string }` |
| `price` | number? | Unit price in cents |
| `temperature_zone` | string | e.g. `"chilled"`, `"ambient"` |
| `unit_quantity` | string? | e.g. `"1 liter"`, `"500 g"` |

### NutritionalInfo shape

Included in `get-product`, `search-products`, and `get-product-alternatives` responses.

| Field | Type |
|-------|------|
| `name` | string |
| `value` | string |
| `gda_percentage` | string? |
| `sub_values[]` | `{ name: string, value: string, gda_percentage?: string }[]` |

---

## Cart

### hackathon-get-cart (GET)

**Params:** None

**Response:**

| Field | Type | Description |
|-------|------|-------------|
| `items[]` | CartItem[] | See shape below |
| `total_items` | number | Sum of all item quantities |
| `total_price` | number | Sum of (discount_price ?? price) * quantity for available items, in cents |

### hackathon-add-to-cart (POST)

**Payload:** `selling_unit_id` (string, required), `count` (number, required, >= 1)

**Response:**

| Field | Type | Description |
|-------|------|-------------|
| `added_items` | MutationItem[] | Items that were added (see shape below) |
| `cart` | CartInternal? | **Not the same shape as `get-cart`.** Minimal internal state with only IDs and quantities — no product names or prices. Call `get-cart` afterwards for full details. See CartInternal note below. |

### hackathon-remove-from-cart (POST)

**Payload:** `selling_unit_id` (string, required), `count` (number, optional — omit to remove all)

**Response:**

| Field | Type | Description |
|-------|------|-------------|
| `removed_items` | MutationItem[] | Items that were removed (see shape below) |
| `cart` | CartInternal? | **Not the same shape as `get-cart`.** Minimal internal state with only IDs and quantities — no product names or prices. Call `get-cart` afterwards for full details. See CartInternal note below. |

### hackathon-clear-cart (POST)

**Payload:** None (empty `{}`)

**Response:**

| Field | Type | Description |
|-------|------|-------------|
| `removed_items` | MutationItem[] | Items that were removed (see shape below) |
| `cart` | CartInternal? | **Not the same shape as `get-cart`.** Minimal internal state with only IDs and quantities — no product names or prices. `null` if cart was already empty. See CartInternal note below. |

### CartItem shape

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Selling unit ID |
| `availability` | string | `"AVAILABLE"` or `"SHORT_TERM_UNAVAILABLE"` |
| `discount_price` | number? | Discounted price in cents, null if none |
| `image_url` | string | Image hash |
| `name` | string | Product display name |
| `price` | number | Unit price in cents |
| `quantity` | number | Number of units in cart |
| `unit_quantity` | string? | e.g. `"1 liter"` |

### MutationItem shape

Returned in `added_items` and `removed_items` from cart mutation endpoints.

| Field | Type | Description |
|-------|------|-------------|
| `cart_line_id` | number | Internal cart line identifier |
| `selling_unit_id` | string | Selling unit ID |

### CartInternal note

The `cart` field in add/remove/clear responses is **not** the same shape as
`get-cart`. It is an internal representation:

| Field | Type | Description |
|-------|------|-------------|
| `checkoutTotalPrice` | number | Total price in cents |
| `generatedAt` | number | Epoch milliseconds |
| `sellingUnits` | object | `{ [selling_unit_id]: { availabilityStatus: { type }, quantity } }` |
| `sellingUnitsTotalPrice` | number | Sum of item prices in cents |

To get the full cart with product names and details, call `hackathon-get-cart`
after a mutation.

---

## Categories

### hackathon-list-categories (GET)

**Params:** `limit` (number, default 50), `offset` (number, default 0)

**Response:**

| Field | Type | Description |
|-------|------|-------------|
| `categories[]` | Category[] | See shape below |
| `total` | number | Length of categories |

### hackathon-get-subcategories (GET)

**Params:** `category_id` (string, required)

**Response:**

| Field | Type | Description |
|-------|------|-------------|
| `subcategories[]` | Category[] | Child categories |
| `total` | number | Length of subcategories |

### Category shape

| Field | Type |
|-------|------|
| `id` | string |
| `name` | string |
| `subcategory_ids` | string[] |

---

## Favorites

### hackathon-list-favorites (GET)

**Params:** `limit` (number, default 50), `offset` (number, default 0)

**Response:**

| Field | Type | Description |
|-------|------|-------------|
| `favorites[]` | FavoriteItem[] | See shape below |
| `total` | number | Length of favorites |

### hackathon-toggle-favorite (POST)

**Payload:** `selling_unit_id` (string, required), `status` (string, required — `"LIKE"` or `"UNLIKE"`)

**Response:**

| Field | Type | Description |
|-------|------|-------------|
| `selling_unit_id` | string | Echo of input |
| `status` | string | Echo of input (`"LIKE"` or `"UNLIKE"`) |

### FavoriteItem shape

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Selling unit ID |
| `availability` | string | `"AVAILABLE"` or `"LONG_TERM_UNAVAILABLE"` |
| `discount_price` | number? | Discounted price in cents |
| `image_url` | string | Image hash |
| `max_order_quantity` | number | Maximum units per order |
| `name` | string | Product display name |
| `price` | number? | Unit price in cents |
| `unit_quantity` | string? | e.g. `"1 liter"` |

---

## Delivery Slots

### hackathon-get-delivery-slots (GET)

**Params:** None

**Response:**

| Field | Type | Description |
|-------|------|-------------|
| `slots[]` | Slot[] | See shape below |
| `total` | number | Length of slots |

### hackathon-get-selected-delivery-slot (GET)

**Params:** None

**Response:**

| Field | Type | Description |
|-------|------|-------------|
| `selected_slot` | Slot? | Currently selected slot, or null if none |

Note: the returned slot omits the `selected` field (it is implicitly true).

### set_delivery_slot (direct REST call)

This is **not** a hackathon-pages endpoint. Use the standard base URL with
`/api/15/cart/set_delivery_slot`:

```bash
curl -s -X POST "https://storefront-prod.nl.picnicinternational.com/api/15/cart/set_delivery_slot" \
  -H "Content-Type: application/json" \
  -H "x-picnic-auth: $(cat /tmp/picnic-token)" \
  -H "x-picnic-agent: 30100;3.3.0" \
  -H "x-picnic-did: AGENT-001" \
  -d '{"slot_id": "<slot_id from get-delivery-slots>"}'
```

Only slots with `is_available: true` can be selected. After setting a slot, call
`hackathon-get-selected-delivery-slot` to confirm.

**Key response fields:**

| Field | Type | Description |
|-------|------|-------------|
| `mts` | number | Epoch milliseconds |
| `state_token` | string | State token |
| `selected_slot` | object | Minimal: `{ slot_id, state }` — NOT the full Slot shape. Call `get-selected-delivery-slot` for full details |
| `delivery_slots[]` | Slot[] | All available slots (ISO 8601 timestamps in this response) |
| `total_price` | number | Current cart total in cents |

### Slot shape

In hackathon endpoint responses (`get-delivery-slots`, `get-selected-delivery-slot`),
timestamps are epoch milliseconds. In `set_delivery_slot` responses they are
ISO 8601 strings.

| Field | Type | Description |
|-------|------|-------------|
| `slot_id` | string | Slot identifier |
| `window_start` | number | Epoch ms (or ISO 8601 string in `set_delivery_slot`) |
| `window_end` | number | Epoch ms (or ISO 8601 string in `set_delivery_slot`) |
| `cut_off_time` | number | Epoch ms — latest time to place an order for this slot |
| `is_available` | boolean | Whether the slot can be selected |
| `selected` | boolean | Whether this slot is currently selected |
| `minimum_order_value` | number | Minimum cart total in cents |
| `hub_id` | string? | Hub identifier |
| `fc_id` | string? | Fulfillment center identifier |
| `unavailability_reason` | string? | Reason if slot is unavailable |

---

## Orders

### hackathon-list-orders (GET)

**Params:** `limit` (number, default 20), `offset` (number, default 0)

**Response:**

| Field | Type | Description |
|-------|------|-------------|
| `orders[]` | OrderSummary[] | See shape below |
| `total` | number | Length of orders |

### hackathon-get-order (GET)

**Params:** `delivery_id` (string, required)

**Response:**

| Field | Type | Description |
|-------|------|-------------|
| `delivery_id` | string | Delivery identifier |
| `status` | string | e.g. `"DELIVERED"`, `"ACCEPTED"` |
| `created_at` | number | Epoch milliseconds |
| `delivered_at` | number? | Epoch milliseconds, null if not yet delivered |
| `delivery_window_start` | number | Epoch milliseconds |
| `delivery_window_end` | number | Epoch milliseconds |
| `items[]` | OrderItem[] | See shape below |
| `total_price` | number? | Payment-based total in cents (see Pricing note below), null if no payment data |

### OrderSummary shape

| Field | Type | Description |
|-------|------|-------------|
| `delivery_id` | string | Delivery identifier |
| `status` | string | Delivery status (excludes `"CANCELLED"`) |
| `created_at` | number | Epoch milliseconds |
| `delivered_at` | number? | Epoch milliseconds, null if not yet delivered |
| `delivery_window_start` | number | Epoch milliseconds |
| `delivery_window_end` | number | Epoch milliseconds |
| `total` | number? | Payment-based total in cents, null if no payment data |

### OrderItem shape

| Field | Type |
|-------|------|
| `selling_unit_id` | string |
| `name` | string |
| `image_url` | string |
| `price` | number |
| `quantity` | number |

### Pricing note

Prices may differ across endpoints. This is expected — not a bug.

**Product search price vs cart price:** The price shown by `search-products` or
`get-product` is the list price. The price in `get-cart` may be lower due to
automatic promotions or volume discounts that are only applied when items enter
the cart. There is no way to know the discounted price before adding to cart.

**`get-cart` total vs `set_delivery_slot` total:** The `total_price` returned by
`set_delivery_slot` may be slightly higher than `get-cart`'s `total_price`
because it can include delivery fees or checkout adjustments that `get-cart`
does not account for. Treat `set_delivery_slot`'s `total_price` as the more
accurate estimate of what the customer will pay.

**Order totals vs item sums:** Order totals (`total` in list-orders,
`total_price` in get-order) are payment-based: they reflect what the customer
was actually charged after vouchers, discounts, delivery fees, and refunds.
These will NOT match the sum of individual item prices, which are gross unit
prices before any adjustments.
