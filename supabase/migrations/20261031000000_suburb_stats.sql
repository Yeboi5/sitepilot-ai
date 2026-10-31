-- Suburb profiles (INTELLIGENCE_UPGRADE_PLAN.md §7).
--
--   suburb_sales_stats  rolling 12-month median sale price and number of sales, per suburb,
--                       property type and (optionally) bedrooms, one row per month
--   suburb_rent_stats   median weekly rent and number of new bonds, per quarter
--
-- Aggregate market statistics: readable by everyone, written only by the service role (loaders).
-- Every row carries its source, retrieval time and evidence status, and figures are never hidden
-- for small samples: the sales count is stored and shown beside every median.

create type public.fact_status as enum ('verified', 'reported', 'estimated', 'unverified');
create type public.dwelling_type as enum ('house', 'unit');

create table public.suburb_sales_stats (
  id            uuid primary key default gen_random_uuid(),
  state         text not null check (state in ('NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT')),
  suburb        text not null check (char_length(suburb) between 1 and 80),
  postcode      text not null check (postcode ~ '^[0-9]{4}$'),
  dwelling_type public.dwelling_type not null,
  bedrooms      smallint check (bedrooms between 1 and 9), -- null = all bedrooms
  period_end    date not null,                             -- last day of the rolling window
  window_months smallint not null default 12 check (window_months between 1 and 60),
  median_price  integer check (median_price > 0),          -- null when there were no sales
  sales_count   integer not null check (sales_count >= 0),
  source        text not null check (char_length(source) between 1 and 160),
  source_url    text check (source_url ~ '^https://'),
  retrieved_at  timestamptz not null default now(),
  status        public.fact_status not null,
  is_demo       boolean not null default false,
  constraint suburb_sales_stats_median_needs_sales check ((median_price is null) = (sales_count = 0)),
  unique nulls not distinct (state, suburb, postcode, dwelling_type, bedrooms, period_end, window_months, source)
);
create index suburb_sales_stats_lookup on public.suburb_sales_stats (state, lower(suburb), dwelling_type, period_end desc);

create table public.suburb_rent_stats (
  id                 uuid primary key default gen_random_uuid(),
  state              text not null check (state in ('NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT')),
  suburb             text not null check (char_length(suburb) between 1 and 80),
  postcode           text not null check (postcode ~ '^[0-9]{4}$'),
  dwelling_type      public.dwelling_type not null,
  bedrooms           smallint check (bedrooms between 1 and 9),
  period_end         date not null,
  median_rent_weekly integer check (median_rent_weekly > 0),
  bonds_count        integer not null check (bonds_count >= 0),
  source             text not null check (char_length(source) between 1 and 160),
  source_url         text check (source_url ~ '^https://'),
  retrieved_at       timestamptz not null default now(),
  status             public.fact_status not null,
  is_demo            boolean not null default false,
  constraint suburb_rent_stats_median_needs_bonds check ((median_rent_weekly is null) = (bonds_count = 0)),
  unique nulls not distinct (state, suburb, postcode, dwelling_type, bedrooms, period_end, source)
);
create index suburb_rent_stats_lookup on public.suburb_rent_stats (state, lower(suburb), dwelling_type, period_end desc);

alter table public.suburb_sales_stats enable row level security;
alter table public.suburb_rent_stats enable row level security;
revoke all on public.suburb_sales_stats, public.suburb_rent_stats from anon, authenticated;
grant select on public.suburb_sales_stats, public.suburb_rent_stats to anon, authenticated;
grant all on public.suburb_sales_stats, public.suburb_rent_stats to service_role;
create policy suburb_sales_stats_read on public.suburb_sales_stats for select to anon, authenticated using (true);
create policy suburb_rent_stats_read on public.suburb_rent_stats for select to anon, authenticated using (true);
