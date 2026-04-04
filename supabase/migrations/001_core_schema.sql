-- ============================================================================
-- 001_core_schema.sql
-- Core product data model for Dutch Grocery Optimizer
-- Tables: stores, products, prices, nutrition
-- ============================================================================

-- ============================================================================
-- STORES
-- ============================================================================
create table if not exists stores (
    id          uuid primary key default gen_random_uuid(),
    name        text not null,
    slug        text unique not null,
    logo_url    text,
    website_url text,
    scraper_type text check (scraper_type in ('http', 'playwright')),
    created_at  timestamptz default now()
);

comment on table stores is 'Dutch supermarket chains';

-- ============================================================================
-- PRODUCTS
-- ============================================================================
create table if not exists products (
    id          uuid primary key default gen_random_uuid(),
    store_id    uuid not null references stores(id) on delete cascade,
    name        text not null,
    brand       text,
    ean         text,
    category    text,
    subcategory text,
    unit_size   numeric,
    unit_type   text,
    image_url   text,
    product_url text,
    is_active   boolean default true,
    created_at  timestamptz default now(),
    updated_at  timestamptz default now()
);

comment on table products is 'Products from individual stores (store-specific entries)';

-- ============================================================================
-- PRICES
-- ============================================================================
create table if not exists prices (
    id                   uuid primary key default gen_random_uuid(),
    product_id           uuid not null references products(id) on delete cascade,
    price_cents          integer not null,
    price_per_unit_cents integer,
    currency             text default 'EUR',
    scraped_at           timestamptz default now(),
    is_on_sale           boolean default false,
    original_price_cents integer,
    is_current           boolean default true
);

comment on table prices is 'Price history -- one row per scrape, is_current marks the latest';

-- ============================================================================
-- NUTRITION
-- ============================================================================
create table if not exists nutrition (
    id               uuid primary key default gen_random_uuid(),
    product_id       uuid not null unique references products(id) on delete cascade,
    calories_per_100g numeric,
    protein_g        numeric,
    carbs_g          numeric,
    fat_g            numeric,
    fiber_g          numeric,
    salt_g           numeric,
    source           text check (source in ('store', 'openfoodfacts')),
    updated_at       timestamptz default now()
);

comment on table nutrition is 'Nutritional info per product (one-to-one)';

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Products indexes
create index if not exists idx_products_ean on products(ean);
create index if not exists idx_products_store_id on products(store_id);
create index if not exists idx_products_category on products(category);
create index if not exists idx_products_store_ean on products(store_id, ean);

-- Prices indexes
create index if not exists idx_prices_product_current on prices(product_id, is_current);
create index if not exists idx_prices_scraped_at on prices(scraped_at);
create index if not exists idx_prices_product_scraped on prices(product_id, scraped_at);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table stores enable row level security;
alter table products enable row level security;
alter table prices enable row level security;
alter table nutrition enable row level security;

-- Public read access (anon role can SELECT)
create policy "stores_public_read" on stores
    for select to anon using (true);

create policy "products_public_read" on products
    for select to anon using (true);

create policy "prices_public_read" on prices
    for select to anon using (true);

create policy "nutrition_public_read" on nutrition
    for select to anon using (true);

-- Service role full access for scrapers (INSERT, UPDATE, DELETE)
create policy "stores_service_write" on stores
    for all to service_role using (true) with check (true);

create policy "products_service_write" on products
    for all to service_role using (true) with check (true);

create policy "prices_service_write" on prices
    for all to service_role using (true) with check (true);

create policy "nutrition_service_write" on nutrition
    for all to service_role using (true) with check (true);

-- ============================================================================
-- SEED DATA -- Dutch supermarket stores
-- ============================================================================

insert into stores (name, slug, logo_url, website_url, scraper_type) values
    ('Albert Heijn', 'ah',     null, 'https://www.ah.nl',     'http'),
    ('Jumbo',        'jumbo',  null, 'https://www.jumbo.com', 'http'),
    ('Lidl',         'lidl',   null, 'https://www.lidl.nl',   'playwright'),
    ('Picnic',       'picnic', null, 'https://www.picnic.app', 'http'),
    ('Plus',         'plus',   null, 'https://www.plus.nl',   'playwright'),
    ('Aldi',         'aldi',   null, 'https://www.aldi.nl',   'playwright')
on conflict (slug) do nothing;
