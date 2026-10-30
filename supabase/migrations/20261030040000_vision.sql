-- Master Blueprint v2.0, V2-4: SitePilot Vision (migration M7 in BLUEPRINT_V2_PLAN.md).
--
--   visual_projects  a user's photo (stripped of metadata) and the mode it's used in
--   visual_versions  each generated AI CONCEPT image (always watermarked), optionally shared
--   vision_usage     per-user daily generation counter (cost control)
--
-- Everything is owner-only. A shared version is reachable only through a secret link (the token's
-- SHA-256 is stored, never the token) and exposes only the watermarked output, never the source.

create type public.vision_mode as enum ('birds_eye', 'exterior', 'interior');

create table public.visual_projects (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.users (id) on delete cascade,
  owned_property_id   uuid references public.owned_properties (id) on delete set null,
  title               text not null check (char_length(title) between 1 and 80),
  mode                public.vision_mode not null,
  source_key          text not null check (char_length(source_key) <= 300),
  source_width        integer not null check (source_width > 0),
  source_height       integer not null check (source_height > 0),
  rights_confirmed_at timestamptz not null default now(),
  created_at          timestamptz not null default now()
);
create index visual_projects_user_idx on public.visual_projects (user_id, created_at desc);
create index visual_projects_home_idx on public.visual_projects (owned_property_id);

create table public.visual_versions (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.visual_projects (id) on delete cascade,
  user_id          uuid not null references public.users (id) on delete cascade,
  preset           text not null check (preset ~ '^[a-z_]{1,40}$'),
  style            text not null check (style ~ '^[a-z_]{1,40}$'),
  prompt           text check (char_length(prompt) <= 300),
  provider         text not null check (char_length(provider) <= 40),
  model            text not null check (char_length(model) <= 80),
  cost_cents       integer not null default 0 check (cost_cents >= 0),
  output_key       text not null check (char_length(output_key) <= 300),
  -- Every stored output carries the AI CONCEPT mark (§5); there is no unwatermarked variant.
  watermarked      boolean not null default true check (watermarked),
  share_token_hash text unique check (share_token_hash ~ '^[0-9a-f]{64}$'),
  shared_at        timestamptz,
  created_at       timestamptz not null default now(),
  constraint visual_versions_shared check ((share_token_hash is null) = (shared_at is null))
);
create index visual_versions_project_idx on public.visual_versions (project_id, created_at desc);
create index visual_versions_user_idx on public.visual_versions (user_id, created_at desc);

create table public.vision_usage (
  user_id     uuid not null references public.users (id) on delete cascade,
  day         date not null,
  generations integer not null default 0 check (generations >= 0),
  primary key (user_id, day)
);

-- ─── Helpers ────────────────────────────────────────────────────────────────

create or replace function app.vision_daily_limit()
returns integer language sql immutable as $$ select 10 $$;

-- Usage days follow Sydney time (a fixed, documented reset; it's a cost guard, not a legal date).
create or replace function app.vision_today()
returns date language sql stable as $$ select (now() at time zone 'Australia/Sydney')::date $$;

create or replace function app.owns_visual_project(project uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.visual_projects p where p.id = project and p.user_id = app.current_user_id());
$$;

create or replace function app.vision_output_is_shared(object_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.visual_versions v where v.output_key = object_name and v.share_token_hash is not null);
$$;

-- ─── RPCs ───────────────────────────────────────────────────────────────────

-- Reserve one generation before calling the (possibly paid) image provider. Atomic per user/day.
create or replace function public.reserve_vision_credit()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  uid  uuid := app.current_user_id();
  used integer;
begin
  if uid is null then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  insert into public.vision_usage (user_id, day, generations) values (uid, app.vision_today(), 0)
  on conflict (user_id, day) do nothing;
  update public.vision_usage set generations = generations + 1
   where user_id = uid and day = app.vision_today() and generations < app.vision_daily_limit()
  returning generations into used;
  if used is null then
    raise exception 'daily Vision limit reached' using errcode = '54000';
  end if;
  return app.vision_daily_limit() - used;
end;
$$;

create or replace function public.vision_credits_left()
returns integer language sql stable security definer set search_path = '' as $$
  select app.vision_daily_limit() - coalesce(
    (select u.generations from public.vision_usage u where u.user_id = app.current_user_id() and u.day = app.vision_today()), 0);
$$;

-- Public view of one shared version, by the SHA-256 of its secret link token. Returns only what the
-- share page shows: never the source photo, owner, address or prompt.
create or replace function public.shared_vision(token_hash text)
returns table (version_id uuid, output_key text, mode public.vision_mode, preset text, style text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select v.id, v.output_key, p.mode, v.preset, v.style, v.created_at
  from public.visual_versions v join public.visual_projects p on p.id = v.project_id
  where token_hash ~ '^[0-9a-f]{64}$' and v.share_token_hash = token_hash;
$$;

revoke all on function public.reserve_vision_credit(), public.vision_credits_left(), public.shared_vision(text) from public;
grant execute on function public.reserve_vision_credit(), public.vision_credits_left() to authenticated;
grant execute on function public.shared_vision(text) to anon, authenticated;

-- ─── Triggers ───────────────────────────────────────────────────────────────

create or replace function app.stamp_visual_project()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null then
    new.user_id = app.current_user_id();
    new.rights_confirmed_at = now();
    if (select count(*) from public.visual_projects p where p.user_id = new.user_id) >= 50 then
      raise exception 'Vision project limit reached' using errcode = '54000';
    end if;
  end if;
  return new;
end;
$$;
create trigger visual_projects_10_stamp before insert on public.visual_projects for each row execute function app.stamp_visual_project();

-- A version can only be stored against a reserved credit, so the quota can't be bypassed by
-- inserting rows directly.
create or replace function app.stamp_visual_version()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null then
    new.user_id = app.current_user_id();
    new.watermarked = true;
    new.share_token_hash = null;
    new.shared_at = null;
    if (select count(*) from public.visual_versions v
        where v.user_id = new.user_id and (v.created_at at time zone 'Australia/Sydney')::date = app.vision_today())
       >= coalesce((select u.generations from public.vision_usage u where u.user_id = new.user_id and u.day = app.vision_today()), 0) then
      raise exception 'no Vision credit reserved' using errcode = '54000';
    end if;
  end if;
  return new;
end;
$$;
create trigger visual_versions_10_stamp before insert on public.visual_versions for each row execute function app.stamp_visual_version();

-- Clients may only share or unshare; the share time is set by the server.
create or replace function app.guard_visual_version_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.shared_at = case when new.share_token_hash is null then null
                       when old.share_token_hash is distinct from new.share_token_hash then now()
                       else old.shared_at end;
  return new;
end;
$$;
create trigger visual_versions_20_share before update on public.visual_versions for each row execute function app.guard_visual_version_update();

-- ─── Row-level security ─────────────────────────────────────────────────────

alter table public.visual_projects enable row level security;
alter table public.visual_versions enable row level security;
alter table public.vision_usage    enable row level security;

revoke all on public.visual_projects, public.visual_versions, public.vision_usage from anon, authenticated;
grant all on public.visual_projects, public.visual_versions, public.vision_usage to service_role;

grant select, delete on public.visual_projects to authenticated;
grant insert (owned_property_id, user_id, title, mode, source_key, source_width, source_height) on public.visual_projects to authenticated;
grant update (title, owned_property_id) on public.visual_projects to authenticated;
grant select, delete on public.visual_versions to authenticated;
grant insert (project_id, user_id, preset, style, prompt, provider, model, cost_cents, output_key) on public.visual_versions to authenticated;
grant update (share_token_hash) on public.visual_versions to authenticated;
grant select on public.vision_usage to authenticated;

create policy visual_projects_own_select on public.visual_projects for select to authenticated using (user_id = app.current_user_id());
create policy visual_projects_own_insert on public.visual_projects for insert to authenticated with check (
  user_id = app.current_user_id() and (owned_property_id is null or app.owns_property(owned_property_id))
);
create policy visual_projects_own_update on public.visual_projects for update to authenticated
  using (user_id = app.current_user_id())
  with check (user_id = app.current_user_id() and (owned_property_id is null or app.owns_property(owned_property_id)));
create policy visual_projects_own_delete on public.visual_projects for delete to authenticated using (user_id = app.current_user_id());

create policy visual_versions_own_select on public.visual_versions for select to authenticated using (user_id = app.current_user_id());
create policy visual_versions_own_insert on public.visual_versions for insert to authenticated with check (
  user_id = app.current_user_id() and app.owns_visual_project(project_id)
);
create policy visual_versions_own_update on public.visual_versions for update to authenticated
  using (user_id = app.current_user_id()) with check (user_id = app.current_user_id());
create policy visual_versions_own_delete on public.visual_versions for delete to authenticated using (user_id = app.current_user_id());

create policy vision_usage_own_select on public.vision_usage for select to authenticated using (user_id = app.current_user_id());

-- ─── Storage: sources and outputs (private) ─────────────────────────────────
-- Object paths: <user_id>/<project id>/<uuid>.jpg. Files are re-encoded by the server first
-- (metadata such as GPS location removed). Shared outputs are readable by object name only while
-- shared; sources are never readable by anyone but their owner.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('vision-sources', 'vision-sources', false, 15728640, array['image/jpeg', 'image/png', 'image/webp']),
  ('vision-outputs', 'vision-outputs', false, 15728640, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy vision_own_insert on storage.objects for insert to authenticated with check (
  bucket_id in ('vision-sources', 'vision-outputs') and (storage.foldername(name))[1] = app.current_user_id()::text
);
create policy vision_own_read on storage.objects for select to authenticated using (
  bucket_id in ('vision-sources', 'vision-outputs') and (storage.foldername(name))[1] = app.current_user_id()::text
);
create policy vision_own_delete on storage.objects for delete to authenticated using (
  bucket_id in ('vision-sources', 'vision-outputs') and (storage.foldername(name))[1] = app.current_user_id()::text
);
create policy vision_shared_read on storage.objects for select to anon, authenticated using (
  bucket_id = 'vision-outputs' and app.vision_output_is_shared(name)
);
