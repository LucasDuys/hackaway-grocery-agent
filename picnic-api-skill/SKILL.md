---
name: picnic-api-skill
description: >-
  Interacts with the Picnic grocery delivery API for hackathon projects. Handles
  authentication, product search, cart management, favorites, orders, delivery
  slots, and recipes. Activates when users need to search
  Picnic products, manage shopping carts, place grocery orders, check delivery
  windows, browse or create recipes, or interact with the Picnic storefront API.
compatibility: >-
  Requires curl and a shell (bash/zsh). Requires a Picnic customer account and
  network access to storefront-prod.nl.picnicinternational.com.
metadata:
  author: Picnic
  version: "1.0.0"
  created: 2026-03-10
  last_reviewed: 2026-03-10
  review_interval_days: 90
  dependencies:
    - url: https://storefront-prod.nl.picnicinternational.com/api/15/pages/hackathon-registry
      name: Picnic Hackathon API
      type: api
---

# /picnic-api-skill — Picnic Grocery Delivery API

You are an assistant that helps users interact with the Picnic grocery delivery 
API. You can search products, manage carts, browse favorites, check orders and
delivery slots, and browse and create recipes.

## Trigger

User invokes `/picnic-api-skill` followed by their input, or activates
naturally when mentioning Picnic, grocery shopping, cart management, delivery
slots, or any of the hackathon API endpoints:

```
/picnic-api-skill Search for pasta products
/picnic-api-skill Add 2 units of product s1000786 to my cart
/picnic-api-skill What delivery slots are available?
/picnic-api-skill Show me my order history
/picnic-api-skill Search for pasta recipes
/picnic-api-skill Recommend me some recipes
```

The skill also activates without the prefix:

```
Search for pasta products on Picnic
Add 2 units of product s1000786 to my cart
What delivery slots are available?
Show me my order history
Find a chicken recipe and add all its ingredients to my cart
```

## Authentication

Authentication requires a login call, followed by 2FA **only if the account requires it**.
Hackathon accounts skip 2FA entirely; personal accounts need it.

### Step 1: Login

```bash
AUTH_TOKEN=$(curl -s -D - -o /dev/null \
  -H "Content-Type: application/json" \
  -H "x-picnic-agent: 30100;3.3.0" \
  -H "x-picnic-did: AGENT-001" \
  -d "{\"key\": \"<email>\", \"password\": \"<password>\", \"client_id\": 30100}" \
  "https://storefront-prod.nl.picnicinternational.com/api/15/user/login" \
  | grep -i "x-picnic-auth" | awk '{ gsub(/,/, ""); print $2 }' | tr -d '\r\n')

echo "Token received. Length: ${#AUTH_TOKEN} chars"
```

### Step 2: Check if 2FA is required

Decode the JWT payload and read the `pc:2fa` claim:

```bash
TWO_FA=$(echo "$AUTH_TOKEN" | cut -d'.' -f2 | tr '_-' '/+' | awk '{while(length%4)$0=$0"="}1' | \
  base64 -d 2>/dev/null || echo "$AUTH_TOKEN" | cut -d'.' -f2 | tr '_-' '/+' | awk '{while(length%4)$0=$0"="}1' | \
  base64 -D 2>/dev/null)
TWO_FA=$(echo "$TWO_FA" | python3 -c "import sys,json; print(json.load(sys.stdin).get('pc:2fa','REQUIRED'))")

echo "2FA status: $TWO_FA"
```

- `NOT_REQUIRED` — the token is already fully authenticated. Save it and skip to **Making requests**:

```bash
echo -n "$AUTH_TOKEN" > /tmp/picnic-token
echo "Token saved (no 2FA needed). Length: $(wc -c < /tmp/picnic-token) chars"
```

- `NOT_VERIFIED` — the token is a weak token and 2FA is required. Continue with Steps 3 and 4 below.

### Step 3: Generate 2FA code (triggers SMS)

Only needed when `pc:2fa` is **not** `NOT_REQUIRED`.

```bash
curl -s -X POST "https://storefront-prod.nl.picnicinternational.com/api/15/user/2fa/generate" \
  -H "Content-Type: application/json" \
  -H "x-picnic-auth: $AUTH_TOKEN" \
  -H "x-picnic-agent: 30100;3.3.0" \
  -H "x-picnic-did: AGENT-001" \
  -d '{"channel": "SMS"}'

echo "SMS sent. Ask the user for the code they received."
```

### Step 4: Verify 2FA (get full token)

```bash
curl -s -D - -o /dev/null \
  -X POST "https://storefront-prod.nl.picnicinternational.com/api/15/user/2fa/verify" \
  -H "Content-Type: application/json" \
  -H "x-picnic-auth: $AUTH_TOKEN" \
  -H "x-picnic-agent: 30100;3.3.0" \
  -H "x-picnic-did: AGENT-001" \
  -d "{\"otp\": \"<code-from-sms>\"}" \
  | grep -i "x-picnic-auth" | awk '{ gsub(/,/, ""); print $2 }' | tr -d '\r\n' > /tmp/picnic-token

echo "Token saved. Length: $(wc -c < /tmp/picnic-token) chars"
```

**Never paste the token as a string literal** — always use `$(cat /tmp/picnic-token)`.

## Making requests

Every request requires these headers:

```
x-picnic-auth: $(cat /tmp/picnic-token)
x-picnic-agent: 30100;3.3.0
x-picnic-did: AGENT-001
```

### GET endpoints — query params in URL

```bash
curl -s -X GET "https://storefront-prod.nl.picnicinternational.com/api/15/pages/hackathon-search-products?query=milk&limit=5" \
  -H "x-picnic-auth: $(cat /tmp/picnic-token)" \
  -H "x-picnic-agent: 30100;3.3.0" \
  -H "x-picnic-did: AGENT-001"
```

### POST endpoints — payload in JSON body

```bash
curl -s -X POST "https://storefront-prod.nl.picnicinternational.com/api/15/pages/task/hackathon-add-to-cart" \
  -H "Content-Type: application/json" \
  -H "x-picnic-auth: $(cat /tmp/picnic-token)" \
  -H "x-picnic-agent: 30100;3.3.0" \
  -H "x-picnic-did: AGENT-001" \
  -d '{"payload": {"selling_unit_id": "s1234", "count": 2}}'
```

## Endpoint discovery

Call `hackathon-registry` (GET, no params) to list all available endpoints.
Returns `{ operations: [{ id, type }], total }` where `type` is `"query"` (GET)
or `"action"` (POST). The registry does not include parameters — refer to the
section below for what each endpoint accepts.

## Endpoint parameters

All endpoint IDs are prefixed with `hackathon-` (omitted below for brevity).

**No parameters:** `get-cart`, `get-delivery-slots`, `get-selected-delivery-slot`

**Search & browse:**
- `search-products`: `query` (required), `limit` (default 20)
- `search-suggestions`: `query` (required)
- `list-categories`: `limit` (default 50), `offset` (default 0)
- `get-subcategories`: `category_id` (required)
- `get-product`: `selling_unit_id` (required)
- `get-product-alternatives`: `selling_unit_id` (required)

**Cart:**
- `add-to-cart`: `selling_unit_id`, `count`
- `remove-from-cart`: `selling_unit_id`, `count` (optional — omit to remove all)
- `clear-cart`: empty payload `{}`

> **Important:** `get-cart` returns a different response shape than `add-to-cart`, `remove-from-cart`, and `clear-cart`. The read endpoint returns full product details (`CartItem[]` with names, prices, images). The mutation endpoints return a minimal internal representation (`CartInternal` with only IDs and quantities). Always call `get-cart` after a mutation if you need product names or prices. See `references/shopping.md` for both shapes.

**Favorites:**
- `list-favorites`: `limit` (default 50), `offset` (default 0)
- `toggle-favorite`: `selling_unit_id`, `status` (`"LIKE"` or `"UNLIKE"`)

**Orders:**
- `list-orders`: `limit` (default 20), `offset` (default 0)
- `get-order`: `delivery_id` (required)

**Recipes:**
- `search-recipes`: `query` (required), `limit` (default 20)
- `get-recipe`: `id` (required)
- `get-recipes`: `ids` (required, array — pass as `?ids=a&ids=b`)
- `get-recipe-recommendations`: `limit` (default 10)
- `save-user-defined-recipe`: `name`, `portions`, `selling_units`, `selling_unit_quantities_by_id`, `selling_unit_sources`, `note` (optional — preparation instructions)
- `update-user-defined-recipe`: `selling_group_id` (required), `name` (optional), `portions` (optional), `note` (optional — preparation instructions)
- `delete-user-defined-recipe`: `sellable_id`

## Key conventions

- **Timestamps**: epoch milliseconds (numbers) in hackathon endpoint responses.
  The `set_delivery_slot` direct REST endpoint returns ISO 8601 strings.
  Exception: `mts` from `set_delivery_slot` is epoch milliseconds
- **Prices**: integer cents (divide by 100 for EUR)
- **Product IDs**: selling unit IDs prefixed with `s` (e.g. `s1132274`)
- **Empty `{}` response**: usually means bad auth token — re-authenticate

## Error responses

The API returns errors in this shape:

```json
{ "error": { "message": "...", "code": "...", "details": {} } }
```

Common error patterns:

| Situation | What you get |
|-----------|-------------|
| Missing or invalid required parameter | Clear message naming the field, e.g. `"'query' string field is required"` |
| Non-existent product/recipe ID in a **mutation** (add-to-cart, update/delete recipe) | `{ "error": { "code": "JAVASCRIPT_INTERNAL_ERROR", ... } }` — this means the ID does not exist. The message is opaque; treat it as "not found". |
| Non-existent slot ID in `set_delivery_slot` | HTTP 500 with **empty body** (0 bytes). Same cause: the slot ID is invalid or expired. |
| Expired or invalid auth token | Empty object `{}` with HTTP 200. Re-authenticate if you see this. |

> **Tip:** If you get `JAVASCRIPT_INTERNAL_ERROR` or an empty 500 response, double-check that the ID you are passing exists and is correctly copied. These are "not found" errors, not server outages.

## Delivery slots

Setting a delivery slot uses a direct REST call (`/api/15/cart/set_delivery_slot`),
not a hackathon-pages endpoint. See [references/shopping.md](references/shopping.md)
for the full curl example and usage notes.

## Detailed endpoint reference

For full request/response schemas with field types, see:
- **Shopping endpoints**: [references/shopping.md](references/shopping.md) —
  products, cart, categories, favorites, delivery slots, orders
- **Recipe endpoints**: [references/recipes.md](references/recipes.md) —
  search, details, recommendations, user-defined recipes

## Advanced workflows

