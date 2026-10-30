-- Master Blueprint v2.0, V2-2: nationwide demo Discover (migrations M2 + M3 in BLUEPRINT_V2_PLAN.md).
--
-- Keeps listing data, property records and user activity distinct (§9):
--   property_records  canonical addresses (demo now; licensed address data later, e.g. G-NAF)
--   listings          for-sale and off-market cards (demo only until licensed data exists)
--   swipe_events      append-only log of a user's decisions (analytics + undo history)
--   saved_properties  the user's current shortlist
--
-- Guests (anon) may read DEMO rows of property_records and listings. That is the only data
-- anonymous users can read anywhere in the schema. Everything else is owner-only.

-- ─── Property records ───────────────────────────────────────────────────────

create table public.property_records (
  id             uuid primary key default gen_random_uuid(),
  state          text not null check (state in ('NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT')),
  suburb         text not null check (char_length(suburb) between 1 and 80),
  postcode       text not null check (postcode ~ '^[0-9]{4}$'),
  street_address text check (char_length(street_address) <= 200),
  source         text not null check (source in ('demo', 'licensed')),
  is_demo        boolean not null default false,
  gnaf_pid       text unique,
  created_at     timestamptz not null default now(),
  constraint property_records_demo_source check (is_demo = (source = 'demo'))
);
create index property_records_location_idx on public.property_records (state, suburb);

alter table public.properties add column property_record_id uuid references public.property_records (id) on delete set null;

-- ─── Listings ───────────────────────────────────────────────────────────────

create type public.listing_kind as enum ('home', 'investment');
create type public.listing_market as enum ('for_sale', 'off_market');
create type public.listing_property_type as enum ('house', 'townhouse', 'apartment', 'duplex', 'land');

create table public.listings (
  id                    uuid primary key default gen_random_uuid(),
  property_record_id    uuid references public.property_records (id) on delete set null,
  kind                  public.listing_kind not null,
  market                public.listing_market not null,
  is_demo               boolean not null default false,
  headline              text not null check (char_length(headline) between 1 and 140),
  description           text not null check (char_length(description) <= 2000),
  property_type         public.listing_property_type not null,
  state                 text not null check (state in ('NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT')),
  suburb                text not null,
  postcode              text not null check (postcode ~ '^[0-9]{4}$'),
  street_address        text,
  bedrooms              smallint check (bedrooms between 0 and 20),
  bathrooms             smallint check (bathrooms between 0 and 20),
  car_spaces            smallint check (car_spaces between 0 and 20),
  land_area_sqm         integer check (land_area_sqm > 0),
  asking_price          integer check (asking_price > 0),
  price_display         text,
  indicative_weekly_rent integer check (indicative_weekly_rent > 0),
  development_idea      text,
  risk_flags            text[] not null default '{}',
  lifestyle_tags        text[] not null default '{}',
  illustration_seed     integer not null default 0,
  provenance            jsonb not null,
  listed_on             date,
  created_at            timestamptz not null default now(),
  -- Off-market properties are NOT FOR SALE: never carry a price or a street address (§3, §4).
  constraint listings_off_market_no_price check (market = 'for_sale' or (asking_price is null and price_display is null)),
  constraint listings_off_market_no_address check (market = 'for_sale' or street_address is null),
  constraint listings_for_sale_priced check (market = 'off_market' or asking_price is not null),
  constraint listings_provenance_source check (provenance ? 'source')
);
create index listings_deck_idx on public.listings (kind, market, state);

-- ─── User activity ──────────────────────────────────────────────────────────

create type public.swipe_action as enum ('save', 'pass', 'undo', 'unsave');
create type public.swipe_source as enum ('swipe', 'button', 'keyboard', 'import', 'list');

create table public.swipe_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.users (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  action     public.swipe_action not null,
  source     public.swipe_source not null,
  created_at timestamptz not null default now()
);
create index swipe_events_user_idx on public.swipe_events (user_id, created_at desc);

create table public.saved_properties (
  user_id    uuid not null references public.users (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

-- Ownership is stamped by the server; clients can't act on someone else's behalf.
create or replace function app.stamp_user_id()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null then
    new.user_id = app.current_user_id();
  end if;
  return new;
end;
$$;

-- Trigger names are numbered because Postgres fires same-event triggers in name order: the
-- user must be stamped (10) before the rate limit counts that user's events (20).
create trigger swipe_events_10_stamp before insert on public.swipe_events for each row execute function app.stamp_user_id();
create trigger saved_properties_10_stamp before insert on public.saved_properties for each row execute function app.stamp_user_id();

-- Abuse guard: at most 1,000 swipe events per user per hour.
create or replace function app.limit_swipe_rate()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.swipe_events e
      where e.user_id = new.user_id and e.created_at > now() - interval '1 hour') >= 1000 then
    raise exception 'swipe rate limit exceeded' using errcode = '54000';
  end if;
  return new;
end;
$$;
create trigger swipe_events_20_rate before insert on public.swipe_events for each row execute function app.limit_swipe_rate();

-- ─── Row-level security ─────────────────────────────────────────────────────

alter table public.property_records enable row level security;
alter table public.listings         enable row level security;
alter table public.swipe_events     enable row level security;
alter table public.saved_properties enable row level security;

revoke all on public.property_records, public.listings, public.swipe_events, public.saved_properties from anon, authenticated;
grant select on public.property_records, public.listings to anon, authenticated;
grant select, insert on public.swipe_events to authenticated;
grant select, insert, delete on public.saved_properties to authenticated;
grant all on public.property_records, public.listings, public.swipe_events, public.saved_properties to service_role;

-- Only demo rows are readable until licensed data (with its own access rules) exists.
create policy property_records_read_demo on public.property_records for select to anon, authenticated using (is_demo);
create policy listings_read_demo on public.listings for select to anon, authenticated using (is_demo);

create policy swipe_events_own_select on public.swipe_events for select to authenticated using (user_id = app.current_user_id());
create policy swipe_events_own_insert on public.swipe_events for insert to authenticated with check (user_id = app.current_user_id());

create policy saved_own_select on public.saved_properties for select to authenticated using (user_id = app.current_user_id());
create policy saved_own_insert on public.saved_properties for insert to authenticated with check (user_id = app.current_user_id());
create policy saved_own_delete on public.saved_properties for delete to authenticated using (user_id = app.current_user_id());
