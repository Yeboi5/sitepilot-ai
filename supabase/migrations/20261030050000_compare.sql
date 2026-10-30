-- Master Blueprint v2.1: Compare My Properties (migrations M9 duty_presets and M10 compare in
-- BLUEPRINT_V2_1_COMPARE_PLAN.md).
--
--   property_estimates      estimated value and rent ranges per property record (DEMO until a
--                           licensed valuation provider is contracted)
--   duty_presets            state stamp duty brackets: reference data with source, as-of and review
--                           status (loaded only from official sources)
--   comparison_sets/items/assumptions   a user's saved comparisons (owner-only)
--
-- Results are not cached: the TypeScript engine is deterministic and recomputed on view. A shared
-- comparison stores a redacted snapshot taken when the link is created.

-- ─── Estimates ──────────────────────────────────────────────────────────────

create type public.estimate_confidence as enum ('low', 'medium', 'high');

create table public.property_estimates (
  id                 uuid primary key default gen_random_uuid(),
  property_record_id uuid not null references public.property_records (id) on delete cascade,
  value_low          integer not null check (value_low > 0),
  value_mid          integer not null,
  value_high         integer not null,
  rent_weekly_low    integer check (rent_weekly_low > 0),
  rent_weekly_mid    integer,
  rent_weekly_high   integer,
  confidence         public.estimate_confidence not null,
  source             text not null check (char_length(source) between 1 and 120),
  as_of              date not null,
  is_demo            boolean not null default false,
  created_at         timestamptz not null default now(),
  constraint property_estimates_value_order check (value_low <= value_mid and value_mid <= value_high),
  constraint property_estimates_rent_order check (
    (rent_weekly_low is null and rent_weekly_mid is null and rent_weekly_high is null)
    or (rent_weekly_low <= rent_weekly_mid and rent_weekly_mid <= rent_weekly_high)
  ),
  unique (property_record_id, source, as_of)
);
create index property_estimates_record_idx on public.property_estimates (property_record_id, as_of desc);

-- ─── Duty presets (reference data) ──────────────────────────────────────────

create type public.duty_preset_status as enum ('needs_review', 'reviewed');

create table public.duty_presets (
  id          uuid primary key default gen_random_uuid(),
  state       text not null check (state in ('NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT')),
  version     text not null check (char_length(version) between 1 and 40),
  -- [{ "from": 0, "base": 0, "ratePer100": 1.25 }, …] ascending; duty = base + (value − from) × rate / 100
  brackets    jsonb not null check (jsonb_typeof(brackets) = 'array' and jsonb_array_length(brackets) > 0),
  source_url  text not null check (source_url ~ '^https://'),
  as_of       date not null,
  status      public.duty_preset_status not null default 'needs_review',
  reviewed_by text,
  reviewed_at timestamptz,
  notes       text check (char_length(notes) <= 1000),
  created_at  timestamptz not null default now(),
  unique (state, version),
  constraint duty_presets_reviewed check ((status = 'reviewed') = (reviewed_at is not null and reviewed_by is not null))
);

-- ─── Comparisons ────────────────────────────────────────────────────────────

create type public.comparison_mode as enum ('homebuyer', 'investor');

create table public.comparison_sets (
  id               uuid primary key default gen_random_uuid(),
  owner_user_id    uuid not null references public.users (id) on delete cascade,
  name             text not null check (char_length(name) between 1 and 80),
  mode             public.comparison_mode not null default 'investor',
  share_token_hash text unique check (share_token_hash ~ '^[0-9a-f]{64}$'),
  share_snapshot   jsonb,
  shared_at        timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint comparison_sets_shared check (
    (share_token_hash is null and share_snapshot is null and shared_at is null)
    or (share_token_hash is not null and share_snapshot is not null and shared_at is not null)
  )
);
create index comparison_sets_owner_idx on public.comparison_sets (owner_user_id, updated_at desc);

create table public.comparison_items (
  id                uuid primary key default gen_random_uuid(),
  comparison_set_id uuid not null references public.comparison_sets (id) on delete cascade,
  listing_id        uuid references public.listings (id) on delete cascade,
  property_id       uuid references public.properties (id) on delete cascade,
  sort_order        smallint not null check (sort_order between 0 and 4),
  overrides_json    jsonb not null default '{}'::jsonb check (jsonb_typeof(overrides_json) = 'object'),
  created_at        timestamptz not null default now(),
  constraint comparison_items_one_target check (num_nonnulls(listing_id, property_id) = 1),
  unique (comparison_set_id, listing_id),
  unique (comparison_set_id, property_id)
);
create index comparison_items_set_idx on public.comparison_items (comparison_set_id, sort_order);

create table public.comparison_assumptions (
  comparison_set_id uuid primary key references public.comparison_sets (id) on delete cascade,
  assumptions_json  jsonb not null check (jsonb_typeof(assumptions_json) = 'object'),
  weights_json      jsonb not null check (jsonb_typeof(weights_json) = 'object'),
  engine_version    text not null check (char_length(engine_version) <= 40),
  score_version     text not null check (char_length(score_version) <= 40),
  updated_at        timestamptz not null default now()
);

-- ─── Helpers, triggers and RPCs ─────────────────────────────────────────────

create or replace function app.owns_comparison(set_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.comparison_sets s where s.id = set_id and s.owner_user_id = app.current_user_id());
$$;

create or replace function app.stamp_comparison_set()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null then
    if tg_op = 'INSERT' then
      new.owner_user_id = app.current_user_id();
      if (select count(*) from public.comparison_sets s where s.owner_user_id = new.owner_user_id) >= 100 then
        raise exception 'comparison limit reached' using errcode = '54000';
      end if;
    end if;
    -- Sharing sets the time on the server; unsharing clears the snapshot.
    if new.share_token_hash is null then
      new.share_snapshot = null;
      new.shared_at = null;
    elsif tg_op = 'INSERT' or old.share_token_hash is distinct from new.share_token_hash then
      new.shared_at = now();
    end if;
  end if;
  new.updated_at = now();
  return new;
end;
$$;
create trigger comparison_sets_10_stamp before insert or update on public.comparison_sets for each row execute function app.stamp_comparison_set();

-- 2–5 properties per comparison: the maximum is enforced here, the minimum by the app.
create or replace function app.limit_comparison_items()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.comparison_sets where id = new.comparison_set_id for update;
  if (select count(*) from public.comparison_items i where i.comparison_set_id = new.comparison_set_id) >= 5 then
    raise exception 'a comparison holds at most 5 properties' using errcode = '54000';
  end if;
  return new;
end;
$$;
create trigger comparison_items_20_limit before insert on public.comparison_items for each row execute function app.limit_comparison_items();

create or replace function app.touch_comparison_assumptions()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger comparison_assumptions_touch before update on public.comparison_assumptions for each row execute function app.touch_comparison_assumptions();

-- Public view of a shared comparison by the SHA-256 of its secret token: the redacted snapshot only.
create or replace function public.shared_comparison(token_hash text)
returns table (name text, mode public.comparison_mode, snapshot jsonb, shared_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select s.name, s.mode, s.share_snapshot, s.shared_at
  from public.comparison_sets s
  where token_hash ~ '^[0-9a-f]{64}$' and s.share_token_hash = token_hash;
$$;
revoke all on function public.shared_comparison(text) from public;
grant execute on function public.shared_comparison(text) to anon, authenticated;

-- ─── Row-level security ─────────────────────────────────────────────────────

alter table public.property_estimates     enable row level security;
alter table public.duty_presets           enable row level security;
alter table public.comparison_sets        enable row level security;
alter table public.comparison_items       enable row level security;
alter table public.comparison_assumptions enable row level security;

revoke all on public.property_estimates, public.duty_presets, public.comparison_sets, public.comparison_items,
  public.comparison_assumptions from anon, authenticated;
grant all on public.property_estimates, public.duty_presets, public.comparison_sets, public.comparison_items,
  public.comparison_assumptions to service_role;

-- Reference data: readable by everyone (estimates: DEMO rows only until licensed data has its own rules).
grant select on public.property_estimates, public.duty_presets to anon, authenticated;
create policy property_estimates_read_demo on public.property_estimates for select to anon, authenticated using (is_demo);
create policy duty_presets_read on public.duty_presets for select to anon, authenticated using (true);

grant select, delete on public.comparison_sets to authenticated;
grant insert (owner_user_id, name, mode) on public.comparison_sets to authenticated;
grant update (name, mode, share_token_hash, share_snapshot) on public.comparison_sets to authenticated;
create policy comparison_sets_own_select on public.comparison_sets for select to authenticated using (owner_user_id = app.current_user_id());
create policy comparison_sets_own_insert on public.comparison_sets for insert to authenticated with check (owner_user_id = app.current_user_id());
create policy comparison_sets_own_update on public.comparison_sets for update to authenticated
  using (owner_user_id = app.current_user_id()) with check (owner_user_id = app.current_user_id());
create policy comparison_sets_own_delete on public.comparison_sets for delete to authenticated using (owner_user_id = app.current_user_id());

grant select, delete on public.comparison_items to authenticated;
grant insert (comparison_set_id, listing_id, property_id, sort_order, overrides_json) on public.comparison_items to authenticated;
grant update (sort_order, overrides_json) on public.comparison_items to authenticated;
create policy comparison_items_own_select on public.comparison_items for select to authenticated using (app.owns_comparison(comparison_set_id));
-- The listing must be one the caller can read (RLS on listings applies in this subquery), and a
-- workspace must be one they can read.
create policy comparison_items_own_insert on public.comparison_items for insert to authenticated with check (
  app.owns_comparison(comparison_set_id)
  and (listing_id is null or exists (select 1 from public.listings l where l.id = listing_id))
  and (property_id is null or app.can_read_property(property_id))
);
create policy comparison_items_own_update on public.comparison_items for update to authenticated
  using (app.owns_comparison(comparison_set_id)) with check (app.owns_comparison(comparison_set_id));
create policy comparison_items_own_delete on public.comparison_items for delete to authenticated using (app.owns_comparison(comparison_set_id));

grant select, insert, update, delete on public.comparison_assumptions to authenticated;
create policy comparison_assumptions_own on public.comparison_assumptions for all to authenticated
  using (app.owns_comparison(comparison_set_id)) with check (app.owns_comparison(comparison_set_id));
