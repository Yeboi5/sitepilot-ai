-- SitePilot AI — Sprint 0/1 foundation schema.
--
-- Security model (see docs/SECURITY.md):
--   * Deny by default: RLS is enabled on every table and `anon` has no table privileges.
--   * Organisation isolation: rows are readable only by members of the owning organisation.
--   * Matter-level grants: professionals see a client's property/documents only through an
--     ACTIVE matter plus an explicit matter_access row. Revoking either removes access.
--   * Platform administrators get NO implicit access to client data.
--   * Privileged helpers live in the private `app` schema (not exposed through the API).

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to authenticated, service_role;

-- ─── Enums ──────────────────────────────────────────────────────────────────

create type public.organisation_type as enum ('investor', 'professional');
create type public.verification_status as enum ('unverified', 'pending', 'verified', 'rejected');
create type public.membership_role as enum ('admin', 'member');
create type public.evidence_source_type as enum (
  'planning_certificate',   -- e.g. s10.7 certificate issued by council
  'planning_portal',        -- NSW Planning Portal record
  'lep_map',                -- Local Environmental Plan map / instrument
  'council_record',
  'title_search',
  'survey',
  'other'
);
create type public.evidence_status as enum ('unverified', 'verified', 'disputed', 'superseded');
create type public.document_classification as enum (
  'unclassified', 'contract_for_sale', 'title_search', 'planning_certificate',
  'survey', 'strata_report', 'building_report', 'other'
);
create type public.document_scan_status as enum ('pending', 'clean', 'infected', 'rejected');
create type public.finding_status as enum ('unreviewed', 'needs_clarification', 'confirmed', 'rejected');
create type public.matter_status as enum ('invited', 'active', 'declined', 'revoked', 'closed');
create type public.matter_permission as enum ('view', 'edit', 'manage');
create type public.task_status as enum ('open', 'in_progress', 'done', 'cancelled');
create type public.plan_tier as enum ('explorer', 'investor_pro', 'developer', 'conveyancer');
create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'canceled');

-- ─── Tables ─────────────────────────────────────────────────────────────────

create table public.users (
  id            uuid primary key default gen_random_uuid(),
  auth_id       uuid not null unique references auth.users (id) on delete cascade,
  display_name  text not null check (char_length(display_name) between 1 and 120),
  created_at    timestamptz not null default now()
);

create table public.platform_admins (
  user_id    uuid primary key references public.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.organisations (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null check (char_length(name) between 1 and 160),
  type                public.organisation_type not null,
  verification_status public.verification_status not null default 'unverified',
  created_at          timestamptz not null default now()
);

create table public.memberships (
  user_id         uuid not null references public.users (id) on delete cascade,
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  role            public.membership_role not null default 'member',
  created_at      timestamptz not null default now(),
  primary key (user_id, organisation_id)
);
create index memberships_org_idx on public.memberships (organisation_id);

create table public.properties (
  id           uuid primary key default gen_random_uuid(),
  owner_org_id uuid not null references public.organisations (id) on delete cascade,
  address      text not null check (char_length(address) between 3 and 300),
  suburb       text,
  postcode     text check (postcode ~ '^[0-9]{4}$'),
  lot_dp       text check (char_length(lot_dp) <= 120),
  -- MVP market is NSW only; widen the check when other jurisdictions are supported.
  jurisdiction text not null default 'NSW' check (jurisdiction in ('NSW')),
  created_by   uuid references public.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index properties_owner_idx on public.properties (owner_org_id);

create table public.documents (
  id             uuid primary key default gen_random_uuid(),
  owner_org_id   uuid not null references public.organisations (id) on delete cascade,
  property_id    uuid references public.properties (id) on delete cascade,
  matter_id      uuid, -- FK added after matters is created
  file_name      text not null check (char_length(file_name) between 1 and 255),
  storage_key    text not null unique,
  mime           text not null check (mime = 'application/pdf'),
  size_bytes     bigint not null check (size_bytes > 0 and size_bytes <= 26214400), -- 25 MiB
  checksum       text not null check (checksum ~ '^[0-9a-f]{64}$'),                  -- sha-256
  classification public.document_classification not null default 'unclassified',
  scan_status    public.document_scan_status not null default 'pending',
  uploaded_by    uuid references public.users (id) on delete set null,
  created_at     timestamptz not null default now()
);
create index documents_owner_idx on public.documents (owner_org_id);
create index documents_property_idx on public.documents (property_id);

create table public.evidence (
  id                  uuid primary key default gen_random_uuid(),
  property_id         uuid not null references public.properties (id) on delete cascade,
  title               text not null check (char_length(title) between 1 and 200),
  source_type         public.evidence_source_type not null,
  source_url          text check (source_url ~ '^https://'),
  fetched_at          date not null,
  verification_status public.evidence_status not null default 'unverified',
  verified_by         uuid references public.users (id) on delete set null,
  verified_at         timestamptz,
  notes               text check (char_length(notes) <= 4000),
  document_id         uuid references public.documents (id) on delete set null,
  created_by          uuid references public.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  constraint evidence_has_source check (source_url is not null or document_id is not null),
  constraint evidence_verified_consistency check (
    (verification_status = 'verified') = (verified_by is not null and verified_at is not null)
  )
);
create index evidence_property_idx on public.evidence (property_id);

create table public.scenarios (
  id               uuid primary key default gen_random_uuid(),
  property_id      uuid not null references public.properties (id) on delete cascade,
  name             text not null check (char_length(name) between 1 and 120),
  assumptions_json jsonb not null default '{}'::jsonb,
  formula_version  text not null,
  created_by       uuid references public.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index scenarios_property_idx on public.scenarios (property_id);

create table public.scenario_results (
  id            uuid primary key default gen_random_uuid(),
  scenario_id   uuid not null references public.scenarios (id) on delete cascade,
  result_json   jsonb not null,
  formula_version text not null,
  calculated_at timestamptz not null default now()
);
create index scenario_results_scenario_idx on public.scenario_results (scenario_id, calculated_at desc);

create table public.matters (
  id                  uuid primary key default gen_random_uuid(),
  property_id         uuid not null references public.properties (id) on delete cascade,
  investor_org_id     uuid not null references public.organisations (id) on delete cascade,
  professional_org_id uuid not null references public.organisations (id) on delete cascade,
  status              public.matter_status not null default 'invited',
  created_by          uuid references public.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint matters_distinct_orgs check (investor_org_id <> professional_org_id)
);
create index matters_property_idx on public.matters (property_id);
create index matters_professional_idx on public.matters (professional_org_id, status);
create index matters_investor_idx on public.matters (investor_org_id, status);

alter table public.documents
  add constraint documents_matter_fk foreign key (matter_id) references public.matters (id) on delete set null;
create index documents_matter_idx on public.documents (matter_id);

create table public.matter_access (
  matter_id  uuid not null references public.matters (id) on delete cascade,
  user_id    uuid not null references public.users (id) on delete cascade,
  permission public.matter_permission not null default 'view',
  granted_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (matter_id, user_id)
);
create index matter_access_user_idx on public.matter_access (user_id);

create table public.findings (
  id             uuid primary key default gen_random_uuid(),
  document_id    uuid not null references public.documents (id) on delete cascade,
  category       text not null check (char_length(category) between 1 and 80),
  extracted_text text not null,
  page_ref       integer not null check (page_ref >= 1),
  span_start     integer check (span_start >= 0),
  span_end       integer check (span_end >= span_start),
  confidence     numeric(4, 3) check (confidence between 0 and 1),
  status         public.finding_status not null default 'unreviewed',
  reviewer_id    uuid references public.users (id) on delete set null,
  reviewer_note  text check (char_length(reviewer_note) <= 4000),
  reviewed_at    timestamptz,
  ai_model       text,
  created_at     timestamptz not null default now()
);
create index findings_document_idx on public.findings (document_id, status);

create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  matter_id   uuid not null references public.matters (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 200),
  assignee_id uuid references public.users (id) on delete set null,
  due_at      timestamptz,
  status      public.task_status not null default 'open',
  verified_by uuid references public.users (id) on delete set null,
  created_by  uuid references public.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index tasks_matter_idx on public.tasks (matter_id, status);
create index tasks_assignee_idx on public.tasks (assignee_id);

create table public.audit_events (
  id              bigint generated always as identity primary key,
  -- No foreign keys: the audit trail is append-only and must outlive the rows it describes.
  organisation_id uuid,
  actor_id        uuid,
  resource_type   text not null,
  resource_id     uuid,
  action          text not null,
  metadata        jsonb not null default '{}'::jsonb,
  "timestamp"     timestamptz not null default now()
);
create index audit_events_org_idx on public.audit_events (organisation_id, "timestamp" desc);

create table public.subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  organisation_id    uuid not null unique references public.organisations (id) on delete cascade,
  stripe_customer_id text,
  plan               public.plan_tier not null default 'explorer',
  status             public.subscription_status not null default 'trialing',
  current_period_end timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ─── Helper functions (SECURITY DEFINER, private schema) ────────────────────
-- These bypass RLS internally so that policies don't recurse; each one only answers a
-- yes/no question about the *calling* user.

create or replace function app.current_user_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select u.id from public.users u where u.auth_id = auth.uid()
$$;

create or replace function app.is_member(org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.organisation_id = org and m.user_id = app.current_user_id()
  )
$$;

create or replace function app.is_org_admin(org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.organisation_id = org and m.user_id = app.current_user_id() and m.role = 'admin'
  )
$$;

create or replace function app.org_type(org uuid)
returns public.organisation_type language sql stable security definer set search_path = '' as $$
  select o.type from public.organisations o where o.id = org
$$;

-- True when the caller holds a grant of at least `min_perm` on an ACTIVE matter.
create or replace function app.has_matter_access(matter uuid, min_perm public.matter_permission default 'view')
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.matter_access ma
    join public.matters mt on mt.id = ma.matter_id
    where ma.matter_id = matter
      and ma.user_id = app.current_user_id()
      and mt.status = 'active'
      and ma.permission >= min_perm
  )
$$;

-- Owner-org members, or professionals with an active matter grant on the property.
create or replace function app.can_read_property(prop uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.properties p where p.id = prop and app.is_member(p.owner_org_id)
  ) or exists (
    select 1 from public.matters mt where mt.property_id = prop and app.has_matter_access(mt.id, 'view')
  )
$$;

create or replace function app.can_write_property(prop uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.properties p where p.id = prop and app.is_member(p.owner_org_id)
  )
$$;

-- Documents: owner-org members, or matter-grant holders for documents attached to that matter.
create or replace function app.can_read_document(doc uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.documents d
    where d.id = doc
      and (app.is_member(d.owner_org_id) or (d.matter_id is not null and app.has_matter_access(d.matter_id, 'view')))
  )
$$;

-- Only professionals with edit rights on the document's matter may verify AI findings.
create or replace function app.can_review_document(doc uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.documents d
    where d.id = doc and d.matter_id is not null and app.has_matter_access(d.matter_id, 'edit')
  )
$$;

-- Organisation members, investor-side members and grant holders can see a matter's tasks.
create or replace function app.is_matter_participant(matter uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.matters mt where mt.id = matter and app.is_member(mt.investor_org_id)
  ) or app.has_matter_access(matter, 'view')
$$;

grant execute on all functions in schema app to authenticated, service_role;

-- ─── Triggers ───────────────────────────────────────────────────────────────

-- Create the public profile when a Supabase auth user signs up.
create or replace function app.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.users (auth_id, display_name)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)), 120)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_auth_user();

create or replace function app.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger properties_touch before update on public.properties for each row execute function app.touch_updated_at();
create trigger scenarios_touch before update on public.scenarios for each row execute function app.touch_updated_at();
create trigger matters_touch before update on public.matters for each row execute function app.touch_updated_at();
create trigger tasks_touch before update on public.tasks for each row execute function app.touch_updated_at();
create trigger subscriptions_touch before update on public.subscriptions for each row execute function app.touch_updated_at();

-- Server-stamped authorship: clients cannot forge created_by / uploaded_by.
create or replace function app.stamp_created_by()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null then
    new.created_by = app.current_user_id();
  end if;
  return new;
end;
$$;

create trigger properties_stamp before insert on public.properties for each row execute function app.stamp_created_by();
create trigger evidence_stamp before insert on public.evidence for each row execute function app.stamp_created_by();
create trigger scenarios_stamp before insert on public.scenarios for each row execute function app.stamp_created_by();
create trigger matters_stamp before insert on public.matters for each row execute function app.stamp_created_by();
create trigger tasks_stamp before insert on public.tasks for each row execute function app.stamp_created_by();

create or replace function app.stamp_uploaded_by()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null then
    new.uploaded_by = app.current_user_id();
  end if;
  return new;
end;
$$;
create trigger documents_stamp before insert on public.documents for each row execute function app.stamp_uploaded_by();

-- Evidence verification is stamped by the server, never trusted from the client.
create or replace function app.stamp_evidence_verification()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    return new; -- trusted server context (service role / seed)
  end if;
  if new.verification_status = 'verified'
     and (tg_op = 'INSERT' or old.verification_status is distinct from 'verified') then
    new.verified_by = app.current_user_id();
    new.verified_at = now();
  elsif new.verification_status <> 'verified' then
    new.verified_by = null;
    new.verified_at = null;
  else
    new.verified_by = old.verified_by;
    new.verified_at = old.verified_at;
  end if;
  return new;
end;
$$;
create trigger evidence_verification before insert or update on public.evidence
  for each row execute function app.stamp_evidence_verification();

-- Findings: reviewers may change only review fields; AI output stays immutable.
create or replace function app.guard_finding_review()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    return new; -- service role (AI pipeline) may write freely
  end if;
  if new.document_id is distinct from old.document_id
     or new.category is distinct from old.category
     or new.extracted_text is distinct from old.extracted_text
     or new.page_ref is distinct from old.page_ref
     or new.span_start is distinct from old.span_start
     or new.span_end is distinct from old.span_end
     or new.confidence is distinct from old.confidence
     or new.ai_model is distinct from old.ai_model then
    raise exception 'AI-extracted fields are immutable' using errcode = '42501';
  end if;
  new.reviewer_id = app.current_user_id();
  new.reviewed_at = now();
  return new;
end;
$$;
create trigger findings_review_guard before update on public.findings
  for each row execute function app.guard_finding_review();

-- Matter lifecycle: invited → active|declined (firm admin) or revoked (investor);
-- active → closed (either side) or revoked (investor). declined/revoked/closed are terminal.
create or replace function app.guard_matter_transition()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  firm boolean;
  client boolean;
begin
  if new.status = old.status or auth.uid() is null then
    return new;
  end if;
  firm := app.is_org_admin(old.professional_org_id);
  client := app.is_member(old.investor_org_id);
  if not (
    (old.status = 'invited' and new.status in ('active', 'declined') and firm)
    or (old.status in ('invited', 'active') and new.status = 'revoked' and client)
    or (old.status = 'active' and new.status = 'closed' and (firm or client))
  ) then
    raise exception 'matter cannot move from % to %', old.status, new.status using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger matters_transition before update on public.matters
  for each row execute function app.guard_matter_transition();

-- Generic audit trail. Trigger argument = name of the column holding the organisation id,
-- or a SQL expression keyword handled below for child tables.
create or replace function app.audit_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  rec  jsonb := to_jsonb(coalesce(new, old));
  org  uuid;
begin
  org := case tg_argv[0]
    when 'property' then (select p.owner_org_id from public.properties p where p.id = (rec ->> 'property_id')::uuid)
    when 'matter'   then (select m.investor_org_id from public.matters m where m.id = (rec ->> 'matter_id')::uuid)
    when 'document' then (select d.owner_org_id from public.documents d where d.id = (rec ->> 'document_id')::uuid)
    else (rec ->> tg_argv[0])::uuid
  end;

  insert into public.audit_events (organisation_id, actor_id, resource_type, resource_id, action, metadata)
  values (
    org,
    app.current_user_id(),
    tg_table_name,
    coalesce((rec ->> 'id')::uuid, (rec ->> 'matter_id')::uuid),
    lower(tg_op),
    case when tg_op = 'UPDATE'
      then jsonb_build_object('changed', (
        select coalesce(jsonb_agg(k), '[]'::jsonb) from jsonb_object_keys(to_jsonb(new)) k
        where to_jsonb(new) -> k is distinct from to_jsonb(old) -> k
      ))
      else '{}'::jsonb
    end
  );
  return coalesce(new, old);
end;
$$;

create trigger audit_organisations after insert or update or delete on public.organisations for each row execute function app.audit_row('id');
create trigger audit_memberships after insert or update or delete on public.memberships for each row execute function app.audit_row('organisation_id');
create trigger audit_properties after insert or update or delete on public.properties for each row execute function app.audit_row('owner_org_id');
create trigger audit_evidence after insert or update or delete on public.evidence for each row execute function app.audit_row('property');
create trigger audit_documents after insert or update or delete on public.documents for each row execute function app.audit_row('owner_org_id');
create trigger audit_findings after update on public.findings for each row execute function app.audit_row('document');
create trigger audit_matters after insert or update or delete on public.matters for each row execute function app.audit_row('investor_org_id');
create trigger audit_matter_access after insert or update or delete on public.matter_access for each row execute function app.audit_row('matter');
create trigger audit_tasks after insert or update or delete on public.tasks for each row execute function app.audit_row('matter');
create trigger audit_scenarios after insert or update or delete on public.scenarios for each row execute function app.audit_row('property');

-- ─── RPCs ───────────────────────────────────────────────────────────────────

-- Atomically create an organisation, make the caller its admin and open a free plan.
create or replace function public.create_organisation(org_name text, org_type public.organisation_type)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := app.current_user_id();
  org uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  insert into public.organisations (name, type) values (trim(org_name), org_type) returning id into org;
  insert into public.memberships (user_id, organisation_id, role) values (uid, org, 'admin');
  insert into public.subscriptions (organisation_id, plan, status)
  values (org, case when org_type = 'professional' then 'conveyancer'::public.plan_tier else 'explorer'::public.plan_tier end, 'trialing');
  return org;
end;
$$;
revoke all on function public.create_organisation(text, public.organisation_type) from public, anon;
grant execute on function public.create_organisation(text, public.organisation_type) to authenticated;

-- ─── Row-level security ─────────────────────────────────────────────────────

alter table public.users            enable row level security;
alter table public.platform_admins  enable row level security;
alter table public.organisations    enable row level security;
alter table public.memberships      enable row level security;
alter table public.properties       enable row level security;
alter table public.evidence         enable row level security;
alter table public.scenarios        enable row level security;
alter table public.scenario_results enable row level security;
alter table public.documents        enable row level security;
alter table public.findings         enable row level security;
alter table public.matters          enable row level security;
alter table public.matter_access    enable row level security;
alter table public.tasks            enable row level security;
alter table public.audit_events     enable row level security;
alter table public.subscriptions    enable row level security;

-- Explicit privileges: anon gets nothing; authenticated gets only what policies may allow.
revoke all on all tables in schema public from anon, authenticated;
grant select, update                 on public.users            to authenticated;
grant select                         on public.organisations    to authenticated;
grant update (name)                  on public.organisations    to authenticated;
grant select, insert, update, delete on public.memberships      to authenticated;
grant select, insert, update, delete on public.properties       to authenticated;
grant select, insert, update, delete on public.evidence         to authenticated;
grant select, insert, update, delete on public.scenarios        to authenticated;
grant select, insert                 on public.scenario_results to authenticated;
grant select, insert, delete         on public.documents        to authenticated;
grant select                         on public.findings         to authenticated;
grant update (status, reviewer_note) on public.findings         to authenticated;
grant select, insert                 on public.matters          to authenticated;
grant update (status)                on public.matters          to authenticated;
grant select, insert, update, delete on public.matter_access    to authenticated;
grant select, insert, update, delete on public.tasks            to authenticated;
grant select                         on public.audit_events     to authenticated;
grant select                         on public.subscriptions    to authenticated;
-- users.display_name is the only user-editable profile column.
revoke update on public.users from authenticated;
grant update (display_name) on public.users to authenticated;

grant all on all tables in schema public to service_role;
grant usage on all sequences in schema public to service_role;

-- users: yourself, plus people you share an organisation or an active matter with.
create policy users_select on public.users for select to authenticated using (
  auth_id = auth.uid()
  or exists (
    select 1 from public.memberships mine
    join public.memberships theirs on theirs.organisation_id = mine.organisation_id
    where mine.user_id = app.current_user_id() and theirs.user_id = users.id
  )
  or exists (
    select 1 from public.matter_access ma
    join public.matters mt on mt.id = ma.matter_id
    where ma.user_id = users.id and app.is_matter_participant(mt.id)
  )
);
create policy users_update_self on public.users for update to authenticated
  using (auth_id = auth.uid()) with check (auth_id = auth.uid());

-- platform_admins: no client policies (service role only).

-- organisations: members, plus counterpart organisations on a matter you participate in.
create policy organisations_select on public.organisations for select to authenticated using (
  app.is_member(id)
  or exists (
    select 1 from public.matters mt
    where (mt.investor_org_id = organisations.id or mt.professional_org_id = organisations.id)
      and (app.is_member(mt.investor_org_id) or app.is_member(mt.professional_org_id))
  )
);
create policy organisations_update on public.organisations for update to authenticated
  using (app.is_org_admin(id)) with check (app.is_org_admin(id));

-- memberships: visible to fellow members; managed by org admins; admins can't demote/remove themselves
-- (prevents orphaning an organisation).
create policy memberships_select on public.memberships for select to authenticated using (app.is_member(organisation_id));
create policy memberships_insert on public.memberships for insert to authenticated with check (app.is_org_admin(organisation_id));
create policy memberships_update on public.memberships for update to authenticated
  using (app.is_org_admin(organisation_id) and user_id <> app.current_user_id())
  with check (app.is_org_admin(organisation_id));
create policy memberships_delete on public.memberships for delete to authenticated
  using (app.is_org_admin(organisation_id) and user_id <> app.current_user_id());

-- properties
-- Policies test the row's own columns first: helper lookups by id can't see a row that the
-- current statement is inserting (INSERT … RETURNING).
create policy properties_select on public.properties for select to authenticated using (
  app.is_member(owner_org_id)
  or exists (select 1 from public.matters mt where mt.property_id = properties.id and app.has_matter_access(mt.id, 'view'))
);
create policy properties_insert on public.properties for insert to authenticated
  with check (app.is_member(owner_org_id) and app.org_type(owner_org_id) = 'investor');
create policy properties_update on public.properties for update to authenticated
  using (app.is_member(owner_org_id)) with check (app.is_member(owner_org_id));
create policy properties_delete on public.properties for delete to authenticated using (app.is_org_admin(owner_org_id));

-- evidence: readable with the property; writable by the owning organisation.
create policy evidence_select on public.evidence for select to authenticated using (app.can_read_property(property_id));
create policy evidence_insert on public.evidence for insert to authenticated
  with check (app.can_write_property(property_id) and (document_id is null or app.can_read_document(document_id)));
create policy evidence_update on public.evidence for update to authenticated
  using (app.can_write_property(property_id))
  with check (app.can_write_property(property_id) and (document_id is null or app.can_read_document(document_id)));
create policy evidence_delete on public.evidence for delete to authenticated using (app.can_write_property(property_id));

-- scenarios / results: the investor's private feasibility work — owner organisation only.
create policy scenarios_select on public.scenarios for select to authenticated using (app.can_write_property(property_id));
create policy scenarios_insert on public.scenarios for insert to authenticated with check (app.can_write_property(property_id));
create policy scenarios_update on public.scenarios for update to authenticated
  using (app.can_write_property(property_id)) with check (app.can_write_property(property_id));
create policy scenarios_delete on public.scenarios for delete to authenticated using (app.can_write_property(property_id));

create policy scenario_results_select on public.scenario_results for select to authenticated using (
  exists (select 1 from public.scenarios s where s.id = scenario_id and app.can_write_property(s.property_id))
);
create policy scenario_results_insert on public.scenario_results for insert to authenticated with check (
  exists (select 1 from public.scenarios s where s.id = scenario_id and app.can_write_property(s.property_id))
);

-- documents: owner org, or grant holders for matter-attached documents.
create policy documents_select on public.documents for select to authenticated using (
  app.is_member(owner_org_id) or (matter_id is not null and app.has_matter_access(matter_id, 'view'))
);
create policy documents_insert on public.documents for insert to authenticated with check (
  app.is_member(owner_org_id)
  and (property_id is null or exists (select 1 from public.properties p where p.id = property_id and p.owner_org_id = documents.owner_org_id))
  and (matter_id is null or exists (select 1 from public.matters m where m.id = matter_id and m.investor_org_id = documents.owner_org_id))
);
create policy documents_delete on public.documents for delete to authenticated using (app.is_org_admin(owner_org_id));

-- findings: inserted by the AI pipeline (service role); reviewed by matter professionals.
create policy findings_select on public.findings for select to authenticated using (app.can_read_document(document_id));
create policy findings_review on public.findings for update to authenticated
  using (app.can_review_document(document_id)) with check (app.can_review_document(document_id));

-- matters: both sides see them; the investor organisation creates invitations.
create policy matters_select on public.matters for select to authenticated using (
  app.is_member(investor_org_id) or app.is_member(professional_org_id)
);
create policy matters_insert on public.matters for insert to authenticated with check (
  status = 'invited'
  and app.is_member(investor_org_id)
  and app.org_type(professional_org_id) = 'professional'
  and exists (select 1 from public.properties p where p.id = property_id and p.owner_org_id = matters.investor_org_id)
);
-- Status transitions: the firm accepts/declines an invitation; the investor revokes/closes.
create policy matters_update on public.matters for update to authenticated
  using (app.is_org_admin(professional_org_id) or app.is_member(investor_org_id))
  with check (
    (app.is_org_admin(professional_org_id) and status in ('active', 'declined', 'closed'))
    or (app.is_member(investor_org_id) and status in ('revoked', 'closed'))
  );

-- matter_access: the investor organisation authorises named professionals on the matter.
create policy matter_access_select on public.matter_access for select to authenticated using (
  user_id = app.current_user_id()
  or exists (
    select 1 from public.matters m where m.id = matter_id
      and (app.is_member(m.investor_org_id) or app.is_org_admin(m.professional_org_id))
  )
);
create policy matter_access_write on public.matter_access for insert to authenticated with check (
  exists (
    select 1 from public.matters m
    join public.memberships pm on pm.organisation_id = m.professional_org_id and pm.user_id = matter_access.user_id
    where m.id = matter_id and app.is_member(m.investor_org_id)
  )
);
create policy matter_access_update on public.matter_access for update to authenticated
  using (exists (select 1 from public.matters m where m.id = matter_id and app.is_member(m.investor_org_id)))
  with check (exists (select 1 from public.matters m where m.id = matter_id and app.is_member(m.investor_org_id)));
create policy matter_access_delete on public.matter_access for delete to authenticated using (
  exists (select 1 from public.matters m where m.id = matter_id and app.is_member(m.investor_org_id))
);

-- tasks
create policy tasks_select on public.tasks for select to authenticated using (app.is_matter_participant(matter_id));
create policy tasks_insert on public.tasks for insert to authenticated with check (
  exists (select 1 from public.matters m where m.id = matter_id and app.is_member(m.investor_org_id))
  or app.has_matter_access(matter_id, 'edit')
);
create policy tasks_update on public.tasks for update to authenticated
  using (
    exists (select 1 from public.matters m where m.id = matter_id and app.is_member(m.investor_org_id))
    or app.has_matter_access(matter_id, 'edit')
  )
  with check (
    exists (select 1 from public.matters m where m.id = matter_id and app.is_member(m.investor_org_id))
    or app.has_matter_access(matter_id, 'edit')
  );
create policy tasks_delete on public.tasks for delete to authenticated using (
  exists (select 1 from public.matters m where m.id = matter_id and app.is_member(m.investor_org_id))
);

-- audit_events: written only by triggers; readable by the organisation's admins.
create policy audit_events_select on public.audit_events for select to authenticated using (app.is_org_admin(organisation_id));

-- subscriptions: members can see their plan; writes come from the billing webhook (service role).
create policy subscriptions_select on public.subscriptions for select to authenticated using (app.is_member(organisation_id));

-- ─── Storage ────────────────────────────────────────────────────────────────
-- Private bucket; object path convention: <owner_org_id>/<document_id>.pdf
-- Uploads/downloads go through server routes that create short-lived signed URLs after an
-- RLS-checked lookup of public.documents; these policies are defence in depth.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 26214400, array['application/pdf'])
on conflict (id) do nothing;

create policy documents_bucket_read on storage.objects for select to authenticated using (
  bucket_id = 'documents'
  and exists (select 1 from public.documents d where d.storage_key = storage.objects.name and app.can_read_document(d.id))
);
create policy documents_bucket_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'documents'
  and app.is_member(((storage.foldername(name))[1])::uuid)
);
