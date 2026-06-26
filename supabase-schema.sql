-- ─────────────────────────────────────────────────────────────────
-- GC Growth OS — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────

-- Stores table
create table if not exists public.stores (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  color               text default '#b8a070',
  shopify_domain      text,
  shopify_token       text,   -- consider pgcrypto encrypt in production
  shopify_shop_name   text,
  shopify_connected   boolean default false,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- Orders table (synced from Shopify)
create table if not exists public.orders (
  id                  uuid primary key default gen_random_uuid(),
  store_id            uuid references public.stores(id) on delete cascade,
  shopify_order_id    text unique not null,
  order_name          text,
  created_at          timestamptz,
  total_price         numeric(10,2),
  financial_status    text,
  fulfillment_status  text,
  line_items          jsonb,
  synced_at           timestamptz default now()
);

-- Indexes for fast date-range queries
create index if not exists orders_store_id_idx    on public.orders(store_id);
create index if not exists orders_created_at_idx  on public.orders(created_at);

-- Row Level Security (recommended — disable for service_role key)
alter table public.stores enable row level security;
alter table public.orders enable row level security;

-- Allow service_role full access (used by the API backend)
create policy "Service role full access on stores" on public.stores
  for all using (true) with check (true);

create policy "Service role full access on orders" on public.orders
  for all using (true) with check (true);
