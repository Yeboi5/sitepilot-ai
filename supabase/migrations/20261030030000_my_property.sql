-- Master Blueprint v2.0, V2-3: My Property, homeowner claims and buyer enquiries (M5 + M6).
--
-- Principles (§4, §9 and approved decisions):
--   * "My Property" is private to the user. Adding an address is NOT a claim of ownership.
--   * A homeowner claim stays PENDING until a restricted, audited claim verifier decides it.
--     Evidence is private and is deleted once a decision is made (the app removes the file).
--   * Owner identity, contact details or inferred ownership are never published.
--   * Buyer enquiries are enabled, but only reach owners who are verified AND have opted in.
--     Owners can switch enquiries off and close any enquiry. Messages are platform-mediated:
--     no contact details are stored or exchanged.

-- ─── My Property ────────────────────────────────────────────────────────────

create table public.owned_properties (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.users (id) on delete cascade,
  property_record_id uuid references public.property_records (id) on delete set null,
  nickname           text check (char_length(nickname) <= 60),
  address            text not null check (char_length(address) between 3 and 300),
  suburb             text not null check (char_length(suburb) between 1 and 80),
  state              text not null check (state in ('NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT')),
  postcode           text not null check (postcode ~ '^[0-9]{4}$'),
  accepts_enquiries  boolean not null default false,
  created_at         timestamptz not null default now(),
  unique (user_id, property_record_id)
);
create index owned_properties_record_idx on public.owned_properties (property_record_id);

create table public.property_notes (
  id                 uuid primary key default gen_random_uuid(),
  owned_property_id  uuid not null references public.owned_properties (id) on delete cascade,
  body               text not null check (char_length(body) between 1 and 4000),
  created_at         timestamptz not null default now()
);
create index property_notes_owned_idx on public.property_notes (owned_property_id, created_at desc);

create table public.maintenance_items (
  id                 uuid primary key default gen_random_uuid(),
  owned_property_id  uuid not null references public.owned_properties (id) on delete cascade,
  title              text not null check (char_length(title) between 1 and 200),
  due_on             date,
  done_at            timestamptz,
  created_at         timestamptz not null default now()
);
create index maintenance_items_owned_idx on public.maintenance_items (owned_property_id);

-- ─── Claims ─────────────────────────────────────────────────────────────────

create table public.claim_verifiers (
  user_id    uuid primary key references public.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create type public.claim_status as enum ('pending', 'verified', 'rejected', 'withdrawn');

create table public.homeowner_claims (
  id                 uuid primary key default gen_random_uuid(),
  owned_property_id  uuid not null references public.owned_properties (id) on delete cascade,
  claimant_id        uuid not null references public.users (id) on delete cascade,
  status             public.claim_status not null default 'pending',
  method             text not null default 'document' check (method in ('document')),
  evidence_key       text check (char_length(evidence_key) <= 300),
  evidence_name      text check (char_length(evidence_name) <= 200),
  evidence_mime      text check (evidence_mime in ('application/pdf', 'image/jpeg', 'image/png')),
  declared_at        timestamptz not null default now(),
  decided_by         uuid references public.users (id) on delete set null,
  decided_at         timestamptz,
  decision_note      text check (char_length(decision_note) <= 1000),
  created_at         timestamptz not null default now(),
  constraint homeowner_claims_decided check ((status in ('verified', 'rejected')) = (decided_at is not null))
);
create index homeowner_claims_owned_idx on public.homeowner_claims (owned_property_id);
create index homeowner_claims_pending_idx on public.homeowner_claims (created_at) where status = 'pending';
-- One open claim per user property; one verified owner claim per property record is enforced
-- in decide_claim() (records are shared across users).
create unique index homeowner_claims_one_open on public.homeowner_claims (owned_property_id) where status in ('pending', 'verified');

-- ─── Buyer enquiries ────────────────────────────────────────────────────────

create type public.enquiry_status as enum ('open', 'replied', 'declined', 'withdrawn', 'closed');

create table public.buyer_enquiries (
  id                 uuid primary key default gen_random_uuid(),
  owned_property_id  uuid not null references public.owned_properties (id) on delete cascade,
  buyer_id           uuid not null references public.users (id) on delete cascade,
  message            text not null check (char_length(message) between 10 and 1000),
  status             public.enquiry_status not null default 'open',
  owner_reply        text check (char_length(owner_reply) <= 1000),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index buyer_enquiries_owned_idx on public.buyer_enquiries (owned_property_id, created_at desc);
create index buyer_enquiries_buyer_idx on public.buyer_enquiries (buyer_id, created_at desc);

-- ─── Helpers ────────────────────────────────────────────────────────────────

create or replace function app.owns_property(prop uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.owned_properties o where o.id = prop and o.user_id = app.current_user_id())
$$;

create or replace function app.is_claim_verifier()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.claim_verifiers v where v.user_id = app.current_user_id())
$$;

-- An owned property can receive enquiries only if its owner opted in and holds a verified claim.
create or replace function app.accepts_enquiries(prop uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.owned_properties o
    join public.homeowner_claims c on c.owned_property_id = o.id and c.status = 'verified'
    where o.id = prop and o.accepts_enquiries
  )
$$;

grant execute on function app.owns_property(uuid), app.is_claim_verifier(), app.accepts_enquiries(uuid) to authenticated;

-- Public RPCs (boolean / id only: never who the owner is).
create or replace function public.am_i_claim_verifier()
returns boolean language sql stable security definer set search_path = '' as $$
  select app.is_claim_verifier()
$$;

-- For a property record (e.g. behind an off-market listing): the owned property that accepts
-- enquiries, if any. Returns only an opaque id so a buyer can address an enquiry to it.
create or replace function public.enquiry_target_for_record(record uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select o.id from public.owned_properties o
  where o.property_record_id = record and app.accepts_enquiries(o.id)
  order by o.created_at
  limit 1
$$;

revoke all on function public.am_i_claim_verifier(), public.enquiry_target_for_record(uuid) from public, anon;
grant execute on function public.am_i_claim_verifier(), public.enquiry_target_for_record(uuid) to authenticated;

-- Verifier decision. Records the decision in the audit log and returns the evidence key so the
-- app can delete the file (evidence is only kept while a claim is pending).
create or replace function public.decide_claim(claim uuid, decision public.claim_status, note text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare
  c   public.homeowner_claims;
  rec uuid;
begin
  if not app.is_claim_verifier() then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  if decision not in ('verified', 'rejected') then
    raise exception 'decision must be verified or rejected' using errcode = '22023';
  end if;
  select * into c from public.homeowner_claims where id = claim for update;
  if c.id is null or c.status <> 'pending' then
    raise exception 'claim is not pending' using errcode = '22023';
  end if;
  if c.claimant_id = app.current_user_id() then
    raise exception 'verifiers cannot decide their own claims' using errcode = '42501';
  end if;
  if decision = 'verified' then
    select o.property_record_id into rec from public.owned_properties o where o.id = c.owned_property_id;
    if rec is not null and exists (
      select 1 from public.homeowner_claims hc join public.owned_properties o on o.id = hc.owned_property_id
      where o.property_record_id = rec and hc.status = 'verified'
    ) then
      raise exception 'this property already has a verified owner' using errcode = '23505';
    end if;
  end if;

  -- The evidence key is kept until the app has deleted the file (see clear_claim_evidence).
  update public.homeowner_claims
     set status = decision, decided_by = app.current_user_id(), decided_at = now(),
         decision_note = left(nullif(btrim(note), ''), 1000)
   where id = claim;

  insert into public.audit_events (organisation_id, actor_id, resource_type, resource_id, action, metadata)
  values (null, app.current_user_id(), 'homeowner_claims', claim, 'claim.' || decision::text, '{}'::jsonb);
  return c.evidence_key;
end;
$$;

-- Verifier opening a claim's evidence is always logged.
create or replace function public.record_claim_evidence_view(claim uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  k text;
begin
  if not app.is_claim_verifier() then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  select evidence_key into k from public.homeowner_claims where id = claim and status = 'pending';
  if k is null then
    raise exception 'no evidence available' using errcode = '22023';
  end if;
  insert into public.audit_events (organisation_id, actor_id, resource_type, resource_id, action, metadata)
  values (null, app.current_user_id(), 'homeowner_claims', claim, 'claim.evidence_viewed', '{}'::jsonb);
  return k;
end;
$$;

-- After deleting the evidence file, the deciding verifier clears the reference.
create or replace function public.clear_claim_evidence(claim uuid)
returns void language sql security definer set search_path = '' as $$
  update public.homeowner_claims set evidence_key = null
  where id = claim and decided_by = app.current_user_id() and status in ('verified', 'rejected')
$$;

-- Storage access for verifiers: evidence of pending claims, or of claims they decided (so they can
-- delete it straight after the decision).
create or replace function app.verifier_may_access_evidence(object_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select app.is_claim_verifier() and exists (
    select 1 from public.homeowner_claims c
    where c.evidence_key = object_name
      and (c.status = 'pending' or c.decided_by = app.current_user_id())
  )
$$;
grant execute on function app.verifier_may_access_evidence(text) to authenticated;

revoke all on function public.decide_claim(uuid, public.claim_status, text), public.record_claim_evidence_view(uuid),
  public.clear_claim_evidence(uuid) from public, anon;
grant execute on function public.decide_claim(uuid, public.claim_status, text), public.record_claim_evidence_view(uuid),
  public.clear_claim_evidence(uuid) to authenticated;

-- ─── Triggers ───────────────────────────────────────────────────────────────

create trigger owned_properties_10_stamp before insert on public.owned_properties for each row execute function app.stamp_user_id();

create or replace function app.stamp_claimant()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null then
    new.claimant_id = app.current_user_id();
    new.status = 'pending';
    new.decided_by = null;
    new.decided_at = null;
    new.decision_note = null;
    new.declared_at = now();
  end if;
  return new;
end;
$$;
create trigger homeowner_claims_10_stamp before insert on public.homeowner_claims for each row execute function app.stamp_claimant();

-- Claimants may only withdraw a pending claim; everything else goes through decide_claim().
create or replace function app.guard_claim_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if not (old.status = 'pending' and new.status = 'withdrawn') then
    raise exception 'only a pending claim can be withdrawn' using errcode = '42501';
  end if;
  return new;
end;
$$;
-- decide_claim() runs as its owner (security definer), so its updates skip this guard.
create trigger homeowner_claims_20_guard before update on public.homeowner_claims
  for each row when (current_user not in ('postgres', 'service_role', 'supabase_admin'))
  execute function app.guard_claim_update();

create or replace function app.stamp_buyer()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null then
    new.buyer_id = app.current_user_id();
    new.status = 'open';
    new.owner_reply = null;
  end if;
  -- Abuse guard: at most 5 enquiries per buyer per 24 hours.
  if (select count(*) from public.buyer_enquiries e where e.buyer_id = new.buyer_id and e.created_at > now() - interval '24 hours') >= 5 then
    raise exception 'enquiry limit reached, try again tomorrow' using errcode = '54000';
  end if;
  return new;
end;
$$;
create trigger buyer_enquiries_10_stamp before insert on public.buyer_enquiries for each row execute function app.stamp_buyer();

-- Owners reply, decline or close; buyers withdraw. Nobody edits the original message.
create or replace function app.guard_enquiry_update()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  is_owner boolean := app.owns_property(old.owned_property_id);
  is_buyer boolean := old.buyer_id = app.current_user_id();
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.owned_property_id <> old.owned_property_id or new.buyer_id <> old.buyer_id or new.message <> old.message then
    raise exception 'enquiry details cannot be changed' using errcode = '42501';
  end if;
  if old.status in ('declined', 'withdrawn', 'closed') then
    raise exception 'enquiry is closed' using errcode = '42501';
  end if;
  if is_owner and new.status in ('replied', 'declined', 'closed') then
    new.updated_at = now();
    return new;
  end if;
  if is_buyer and new.status = 'withdrawn' and new.owner_reply is not distinct from old.owner_reply then
    new.updated_at = now();
    return new;
  end if;
  raise exception 'not permitted' using errcode = '42501';
end;
$$;
create trigger buyer_enquiries_20_guard before update on public.buyer_enquiries for each row execute function app.guard_enquiry_update();

-- Turning enquiries off closes any open ones (owner revocation).
create or replace function app.close_enquiries_on_opt_out()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.accepts_enquiries and not new.accepts_enquiries then
    update public.buyer_enquiries set status = 'closed', updated_at = now()
    where owned_property_id = new.id and status in ('open', 'replied');
  end if;
  return new;
end;
$$;
create trigger owned_properties_30_opt_out after update on public.owned_properties for each row execute function app.close_enquiries_on_opt_out();

-- ─── Row-level security ─────────────────────────────────────────────────────

alter table public.owned_properties  enable row level security;
alter table public.property_notes    enable row level security;
alter table public.maintenance_items enable row level security;
alter table public.claim_verifiers   enable row level security;
alter table public.homeowner_claims  enable row level security;
alter table public.buyer_enquiries   enable row level security;

revoke all on public.owned_properties, public.property_notes, public.maintenance_items, public.claim_verifiers,
  public.homeowner_claims, public.buyer_enquiries from anon, authenticated;
grant all on public.owned_properties, public.property_notes, public.maintenance_items, public.claim_verifiers,
  public.homeowner_claims, public.buyer_enquiries to service_role;

grant select, insert, delete on public.owned_properties to authenticated;
grant update (nickname, accepts_enquiries) on public.owned_properties to authenticated;
grant select, insert, delete on public.property_notes to authenticated;
grant select, insert, delete on public.maintenance_items to authenticated;
grant update (title, due_on, done_at) on public.maintenance_items to authenticated;
grant select on public.homeowner_claims to authenticated;
grant insert (owned_property_id, claimant_id, method, evidence_key, evidence_name, evidence_mime) on public.homeowner_claims to authenticated;
grant update (status) on public.homeowner_claims to authenticated;
grant select on public.buyer_enquiries to authenticated;
grant insert (owned_property_id, buyer_id, message) on public.buyer_enquiries to authenticated;
grant update (status, owner_reply) on public.buyer_enquiries to authenticated;
-- claim_verifiers: no client privileges (service role manages verifiers).

create policy owned_own on public.owned_properties for all to authenticated
  using (user_id = app.current_user_id()) with check (user_id = app.current_user_id());

create policy notes_own on public.property_notes for all to authenticated
  using (app.owns_property(owned_property_id)) with check (app.owns_property(owned_property_id));
create policy maintenance_own on public.maintenance_items for all to authenticated
  using (app.owns_property(owned_property_id)) with check (app.owns_property(owned_property_id));

-- Claimants see their own claims; verifiers see pending claims only (no history browsing).
create policy claims_select on public.homeowner_claims for select to authenticated using (
  claimant_id = app.current_user_id() or (app.is_claim_verifier() and status = 'pending')
);
create policy claims_insert on public.homeowner_claims for insert to authenticated with check (
  app.owns_property(owned_property_id) and claimant_id = app.current_user_id()
);
create policy claims_withdraw on public.homeowner_claims for update to authenticated
  using (claimant_id = app.current_user_id()) with check (claimant_id = app.current_user_id());

-- Enquiries: the buyer and the owner of the target property only.
create policy enquiries_select on public.buyer_enquiries for select to authenticated using (
  buyer_id = app.current_user_id() or app.owns_property(owned_property_id)
);
create policy enquiries_insert on public.buyer_enquiries for insert to authenticated with check (
  buyer_id = app.current_user_id()
  and app.accepts_enquiries(owned_property_id)
  and not app.owns_property(owned_property_id)
);
create policy enquiries_update on public.buyer_enquiries for update to authenticated
  using (buyer_id = app.current_user_id() or app.owns_property(owned_property_id))
  with check (buyer_id = app.current_user_id() or app.owns_property(owned_property_id));

-- Verifiers can see the address being claimed (needed to check evidence), nothing else of the user.
create policy owned_verifier_pending on public.owned_properties for select to authenticated using (
  app.is_claim_verifier() and exists (
    select 1 from public.homeowner_claims c where c.owned_property_id = owned_properties.id and c.status = 'pending'
  )
);

-- ─── Storage: claim evidence (private) ──────────────────────────────────────
-- Object path: <user_id>/<claim uuid>.<ext>. Read by the claimant or a verifier (via server route).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('claim-evidence', 'claim-evidence', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy claim_evidence_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'claim-evidence' and (storage.foldername(name))[1] = app.current_user_id()::text
);
create policy claim_evidence_read on storage.objects for select to authenticated using (
  bucket_id = 'claim-evidence'
  and ((storage.foldername(name))[1] = app.current_user_id()::text or app.verifier_may_access_evidence(name))
);
create policy claim_evidence_delete on storage.objects for delete to authenticated using (
  bucket_id = 'claim-evidence'
  and ((storage.foldername(name))[1] = app.current_user_id()::text or app.verifier_may_access_evidence(name))
);
