-- Official area statistics (INTELLIGENCE_UPGRADE_PLAN.md §7, step 4).
--
-- First source: the NSW Rent and Sales Report (Department of Communities and Justice), quarterly,
-- by postcode, CC BY 4.0. Rows keep the publisher's own categories and suppression rules exactly:
-- DCJ doesn't publish a median for 10 or fewer sales/bonds, and replaces counts of 30 or fewer
-- with "s". We store what was published, never an estimate of what wasn't.

create table public.official_area_stats (
  id                uuid primary key default gen_random_uuid(),
  dataset           text not null check (dataset in ('nsw_dcj_sales', 'nsw_dcj_rent')),
  state             text not null check (state in ('NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT')),
  area_type         text not null check (area_type in ('postcode', 'lga')),
  area_code         text not null check (char_length(area_code) between 1 and 80),
  category          text not null check (char_length(category) between 1 and 40), -- as published, e.g. 'Non Strata', 'House'
  dwelling_type     text not null check (dwelling_type in ('all', 'house', 'unit', 'townhouse', 'other')),
  bedrooms          text not null default 'Total' check (char_length(bedrooms) between 1 and 40),
  period_start      date not null,
  period_end        date not null,
  q1                integer check (q1 >= 0),
  median            integer check (median >= 0),       -- stored as published; 0 (a source error) is never used in calculations
  q3                integer check (q3 >= 0),
  mean              integer check (mean >= 0),
  count             integer check (count >= 0),        -- null when DCJ withheld the count
  count_note        text not null check (count_note in ('exact', '30_or_fewer', '10_or_fewer')),
  change_quarterly  numeric(8, 4),                     -- as published (0.0399 = 3.99%)
  change_annual     numeric(8, 4),
  bonds_held        integer check (bonds_held >= 0),
  source_url        text not null check (source_url ~ '^https://'),
  licence           text not null,
  retrieved_at      timestamptz not null default now(),
  status            public.fact_status not null default 'reported',
  constraint official_area_stats_period check (period_end >= period_start),
  constraint official_area_stats_suppressed check (count_note <> '10_or_fewer' or (median is null and count is null)),
  unique (dataset, area_type, area_code, category, bedrooms, period_end)
);
create index official_area_stats_lookup on public.official_area_stats (dataset, area_type, area_code, period_end desc);

alter table public.official_area_stats enable row level security;
revoke all on public.official_area_stats from anon, authenticated;
grant select on public.official_area_stats to anon, authenticated;
grant all on public.official_area_stats to service_role;
create policy official_area_stats_read on public.official_area_stats for select to anon, authenticated using (true);
