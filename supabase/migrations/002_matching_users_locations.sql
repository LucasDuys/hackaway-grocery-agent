-- 002_matching_users_locations.sql
-- Depends on: 001_core_schema.sql (stores, products tables)
--
-- Creates tables for:
--   - Cross-store product matching (unified_products, product_mappings)
--   - Store locations with coordinates (store_locations)
--   - User shopping lists (user_lists, list_items)
--   - Price alerts (price_alerts)
--   - Scrape logging (scrape_logs)

-- =============================================================================
-- 1. unified_products -- canonical product entries for cross-store matching
-- =============================================================================
create table unified_products (
    id              uuid primary key default gen_random_uuid(),
    canonical_name  text not null,
    canonical_category text,
    ean             text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

-- Partial unique index: EAN must be unique where it is not null
create unique index idx_unified_products_ean
    on unified_products (ean)
    where ean is not null;

comment on table unified_products is
    'Canonical product entries that unify the same product across different stores.';

-- =============================================================================
-- 2. product_mappings -- links store-specific products to unified products
-- =============================================================================
create table product_mappings (
    id                  uuid primary key default gen_random_uuid(),
    unified_product_id  uuid not null references unified_products (id),
    product_id          uuid not null references products (id),
    confidence_score    numeric not null check (confidence_score >= 0 and confidence_score <= 1),
    match_method        text check (match_method in ('exact_ean', 'fuzzy_name_and_size', 'fuzzy_name_only', 'manual')),
    created_at          timestamptz not null default now(),

    constraint uq_product_mappings_unified_product
        unique (unified_product_id, product_id)
);

create index idx_product_mappings_unified_product_id
    on product_mappings (unified_product_id);

create index idx_product_mappings_product_id
    on product_mappings (product_id);

comment on table product_mappings is
    'Maps store-specific products to unified product entries with confidence scoring.';

-- =============================================================================
-- 3. store_locations -- physical supermarket locations
-- =============================================================================
create table store_locations (
    id          uuid primary key default gen_random_uuid(),
    store_id    uuid not null references stores (id),
    latitude    double precision not null,
    longitude   double precision not null,
    address     text,
    city        text,
    postal_code text,
    osm_id      bigint,
    created_at  timestamptz not null default now()
);

create index idx_store_locations_store_id
    on store_locations (store_id);

-- Composite index on coordinates for proximity queries
create index idx_store_locations_lat_lng
    on store_locations (latitude, longitude);

comment on table store_locations is
    'Physical supermarket locations sourced from OpenStreetMap. Used for radius-based filtering.';

-- =============================================================================
-- 4. user_lists -- shopping lists (not user-scoped in v1, no auth)
-- =============================================================================
create table user_lists (
    id          uuid primary key default gen_random_uuid(),
    name        text not null,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

comment on table user_lists is
    'Shopping lists. Not user-scoped in v1 (no auth system yet).';

-- =============================================================================
-- 5. list_items -- items within a shopping list
-- =============================================================================
create table list_items (
    id                  uuid primary key default gen_random_uuid(),
    list_id             uuid not null references user_lists (id) on delete cascade,
    product_name        text not null,
    quantity            integer not null default 1,
    unified_product_id  uuid references unified_products (id),
    created_at          timestamptz not null default now()
);

create index idx_list_items_list_id
    on list_items (list_id);

comment on table list_items is
    'Individual items in a shopping list, optionally linked to a unified product.';

-- =============================================================================
-- 6. price_alerts -- track target prices for products
-- =============================================================================
create table price_alerts (
    id                  uuid primary key default gen_random_uuid(),
    product_id          uuid not null references products (id),
    unified_product_id  uuid references unified_products (id),
    target_price_cents  integer not null,
    is_active           boolean not null default true,
    triggered_at        timestamptz,
    created_at          timestamptz not null default now()
);

-- Partial index: only index active alerts (most queries filter on active)
create index idx_price_alerts_active
    on price_alerts (is_active)
    where is_active = true;

comment on table price_alerts is
    'Price drop alerts. Not user-scoped in v1. Triggered when current price <= target.';

-- =============================================================================
-- 7. scrape_logs -- track scraper runs for monitoring
-- =============================================================================
create table scrape_logs (
    id                uuid primary key default gen_random_uuid(),
    store_id          uuid not null references stores (id),
    started_at        timestamptz not null default now(),
    completed_at      timestamptz,
    products_scraped  integer not null default 0,
    errors_count      integer not null default 0,
    status            text check (status in ('running', 'completed', 'failed')),
    error_details     jsonb
);

comment on table scrape_logs is
    'Logging table for scraper runs. One row per store per scrape invocation.';

-- =============================================================================
-- Row Level Security
-- =============================================================================

-- Enable RLS on all tables
alter table unified_products enable row level security;
alter table product_mappings enable row level security;
alter table store_locations  enable row level security;
alter table user_lists       enable row level security;
alter table list_items       enable row level security;
alter table price_alerts     enable row level security;
alter table scrape_logs      enable row level security;

-- Public read on reference/catalog tables
create policy "Public read access on unified_products"
    on unified_products for select
    using (true);

create policy "Public read access on product_mappings"
    on product_mappings for select
    using (true);

create policy "Public read access on store_locations"
    on store_locations for select
    using (true);

-- Public read + write on user-facing tables (no auth in v1)
create policy "Public read access on user_lists"
    on user_lists for select
    using (true);

create policy "Public insert access on user_lists"
    on user_lists for insert
    with check (true);

create policy "Public update access on user_lists"
    on user_lists for update
    using (true);

create policy "Public delete access on user_lists"
    on user_lists for delete
    using (true);

create policy "Public read access on list_items"
    on list_items for select
    using (true);

create policy "Public insert access on list_items"
    on list_items for insert
    with check (true);

create policy "Public update access on list_items"
    on list_items for update
    using (true);

create policy "Public delete access on list_items"
    on list_items for delete
    using (true);

create policy "Public read access on price_alerts"
    on price_alerts for select
    using (true);

create policy "Public insert access on price_alerts"
    on price_alerts for insert
    with check (true);

create policy "Public update access on price_alerts"
    on price_alerts for update
    using (true);

create policy "Public delete access on price_alerts"
    on price_alerts for delete
    using (true);

-- scrape_logs: public read, service role handles writes
create policy "Public read access on scrape_logs"
    on scrape_logs for select
    using (true);

-- Service role bypasses RLS by default in Supabase, so no explicit
-- service-role policies needed. The service_role key has full access
-- regardless of RLS policies.
