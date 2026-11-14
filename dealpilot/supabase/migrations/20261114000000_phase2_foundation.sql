-- Phase 2: real-world foundation.
--  * Supabase Auth: profiles are created from auth.users; MFA and email verification are handled by Auth.
--  * Atomic, guarded multi-row writes (apply_batch) for deals, verification and the ledger.
--  * Dual approval of final terms; qualifying-fee model (assessed, not collected).
--  * Business verification (ABN, credentials with expiry, admin approval/suspension) and
--    reviews tied to verified jobs.
--  * Rate limiting, document malware-scan status, privacy (deletion) support, configurable market.

-- ─── Accounts ────────────────────────────────────────────────────────────────
alter table public.profiles drop constraint if exists business_role;
alter table public.profiles
  add column if not exists jurisdiction text not null default 'AU',
  add column if not exists currency text not null default 'AUD' check (currency ~ '^[A-Z]{3}$'),
  add column if not exists ai_processing_consent boolean not null default false,
  add column if not exists deleted_at timestamptz;

-- Every profile belongs to a real Supabase Auth identity (memory-driver demo users never reach Postgres).
alter table public.profiles add constraint profiles_auth_user_fk foreign key (id) references auth.users (id) on delete cascade not valid;

-- Create the profile when someone signs up. Role comes from sign-up metadata but can only be
-- customer or business; admins are promoted manually in SQL.
create or replace function public.handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  requested text := meta ->> 'role';
begin
  insert into public.profiles (id, email, name, role, region, is_demo)
  values (
    new.id,
    lower(new.email),
    coalesce(nullif(trim(meta ->> 'name'), ''), split_part(new.email, '@', 1)),
    case when requested in ('customer', 'business') then requested else 'customer' end,
    coalesce(nullif(trim(meta ->> 'region'), ''), 'Australia-wide'),
    coalesce((meta ->> 'is_demo')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ─── Businesses: verification ────────────────────────────────────────────────
alter table public.businesses
  add column if not exists verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'pending', 'verified', 'suspended', 'rejected')),
  add column if not exists abn_status text not null default 'not_checked'
    check (abn_status in ('not_checked', 'checksum_valid', 'invalid', 'abr_active', 'abr_cancelled', 'abr_not_found', 'admin_confirmed')),
  add column if not exists abn_entity_name text,
  add column if not exists abn_checked_at timestamptz,
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references public.profiles (id),
  add column if not exists status_reason text,
  add column if not exists jurisdiction text not null default 'AU',
  add constraint verified_has_reviewer check (verification_status <> 'verified' or (verified_at is not null and verified_by is not null));

create table public.business_credentials (
  id                    uuid primary key default gen_random_uuid(),
  business_id           uuid not null references public.businesses (id) on delete cascade,
  kind                  text not null check (kind in ('licence', 'insurance')),
  reference             text not null,
  issuer                text not null default '',
  jurisdiction          text not null default '',
  expires_at            timestamptz,
  evidence_document_id  uuid references public.documents (id),
  status                text not null default 'submitted' check (status in ('submitted', 'verified', 'rejected')),
  check_method          text check (check_method in ('admin_document_review', 'register_lookup')),
  checked_by            uuid references public.profiles (id),
  checked_at            timestamptz,
  notes                 text,
  created_at            timestamptz not null default now(),
  -- Uploading evidence never verifies anything on its own: a person or a register lookup must.
  constraint verified_credential_has_check check (status <> 'verified' or (checked_at is not null and check_method is not null)),
  constraint admin_review_has_reviewer check (check_method is distinct from 'admin_document_review' or checked_by is not null)
);
create index on public.business_credentials (business_id);

-- Real offers can only come from verified businesses (simulated demo providers excepted).
create or replace function public.offer_requires_verified_business() returns trigger language plpgsql as $$
begin
  if new.status <> 'draft' and not new.is_simulated and (tg_op = 'INSERT' or old.status = 'draft') then
    if not exists (select 1 from public.businesses b where b.id = new.business_id and b.verification_status = 'verified') then
      raise exception 'business % is not verified', new.business_id using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;
create trigger offers_verified_business before insert or update on public.offers
  for each row execute function public.offer_requires_verified_business();

-- ─── Reviews: only for verified, real jobs ───────────────────────────────────
create table public.reviews (
  id              uuid primary key default gen_random_uuid(),
  transaction_id  uuid not null unique references public.transactions (id),
  business_id     uuid not null references public.businesses (id),
  customer_id     uuid not null references public.profiles (id),
  rating          integer not null check (rating between 1 and 5),
  comment         text not null default '' check (length(comment) <= 2000),
  created_at      timestamptz not null default now()
);
create index on public.reviews (business_id);

create or replace function public.review_requires_verified_job() returns trigger language plpgsql as $$
begin
  if not exists (
    select 1 from public.transactions t
    where t.id = new.transaction_id and t.status = 'verified' and not t.simulated
      and t.customer_id = new.customer_id and t.business_id = new.business_id
  ) then
    raise exception 'reviews require a verified, real transaction between this customer and business' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger reviews_verified_job before insert on public.reviews
  for each row execute function public.review_requires_verified_job();

-- ─── Documents: scanning, AI consent, customer review of extraction ─────────
alter table public.documents drop constraint if exists documents_kind_check;
alter table public.documents add constraint documents_kind_check
  check (kind in ('quote', 'bill', 'receipt', 'contract', 'invoice', 'statement', 'certificate', 'other'));
alter table public.documents
  add column if not exists scan_status text not null default 'not_scanned' check (scan_status in ('not_scanned', 'clean', 'infected', 'error')),
  add column if not exists scan_engine text,
  add column if not exists scanned_at timestamptz,
  add column if not exists confirmed jsonb,
  add column if not exists confirmed_at timestamptz;

-- ─── Negotiations: dual approval of final terms ──────────────────────────────
alter table public.negotiations drop constraint if exists negotiations_state_check;
alter table public.negotiations add constraint negotiations_state_check check (state in (
  'open', 'awaiting_approval', 'awaiting_counterparty', 'counter_received', 'escalated', 'final_approval',
  'agreed', 'completed', 'declined', 'cancelled', 'expired'));
alter table public.negotiations add column if not exists final_terms jsonb;
alter table public.negotiations add column if not exists group_id uuid references public.purchasing_groups (id);
alter table public.negotiations add column if not exists version integer not null default 0 check (version >= 0);
alter table public.negotiations drop constraint if exists agreed_has_price;
alter table public.negotiations add constraint agreed_has_price check (state not in ('agreed', 'completed') or agreed_cents is not null);
-- Both parties (or a recorded exemption such as a simulated or external counterparty) approved.
alter table public.negotiations add constraint agreed_terms_approved check (
  state not in ('agreed', 'completed') or final_terms is null or (
    final_terms ? 'customerApprovedAt'
    and (final_terms ? 'businessApprovedAt' or final_terms ->> 'businessApproval' in ('simulated', 'not_applicable', 'pre_approved'))
  ));

-- ─── Transactions & ledger: qualifying fees, assessed not collected ──────────
alter table public.transactions drop constraint if exists transactions_fee_status_check;
alter table public.transactions add constraint transactions_fee_status_check check (fee_status in (
  'not_applicable', 'pending', 'not_qualifying', 'waived', 'assessed', 'collected', 'refunded', 'charged_simulated'));
alter table public.transactions
  add column if not exists currency text not null default 'AUD' check (currency ~ '^[A-Z]{3}$'),
  add column if not exists jurisdiction text not null default 'AU',
  add column if not exists qualifies_for_fee boolean not null default false,
  add column if not exists fee_reason text;
alter table public.transactions drop constraint if exists fee_only_when_verified;
alter table public.transactions add constraint fee_only_when_verified check (fee_cents = 0 or (status = 'verified' and qualifies_for_fee));

alter table public.ledger_entries drop constraint if exists ledger_entries_type_check;
alter table public.ledger_entries add constraint ledger_entries_type_check check (type in (
  'saving_recorded', 'saving_verified', 'fee_assessed', 'fee_collected', 'fee_refunded', 'fee_waived', 'fee_charged', 'commission_recorded'));

-- ─── Atomic guarded batch writes ─────────────────────────────────────────────
-- Applies inserts/updates to whitelisted tables in one transaction. Each guard locks a row
-- (SELECT ... FOR UPDATE) and checks a column value; if any guard fails nothing is written and
-- the function returns false. Used for deal agreement, verification and cancellation so they are
-- all-or-nothing and safe under concurrency.
create or replace function public.apply_batch(guards jsonb, ops jsonb) returns boolean
language plpgsql set search_path = public as $$
declare
  allowed constant text[] := array['profiles', 'businesses', 'business_credentials', 'documents', 'purchase_requests', 'offers',
    'negotiations', 'purchasing_groups', 'price_watches', 'alerts', 'expense_lines', 'transactions', 'ledger_entries',
    'audit_logs', 'reviews'];
  g jsonb; op jsonb; t text; cols text; actual text; ok boolean;
begin
  for g in select * from jsonb_array_elements(coalesce(guards, '[]'::jsonb)) loop
    t := g ->> 'table';
    if not t = any (allowed) then raise exception 'table % not allowed', t; end if;
    execute format('select (%I)::text from public.%I where id = $1 for update', g ->> 'field', t) into actual using (g ->> 'id')::uuid;
    ok := case when g ? 'equals' then actual is not distinct from (g ->> 'equals')
               when g ? 'isNull' then actual is null
               else false end;
    if not ok then return false; end if;
  end loop;

  for op in select * from jsonb_array_elements(ops) loop
    t := op ->> 'table';
    if not t = any (allowed) then raise exception 'table % not allowed', t; end if;
    if op ->> 'op' = 'insert' then
      select string_agg(format('%I', k), ', ') into cols from jsonb_object_keys(op -> 'row') k;
      execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1)', t, cols, cols, t) using op -> 'row';
    elsif op ->> 'op' = 'update' then
      select string_agg(format('%I', k), ', ') into cols from jsonb_object_keys(op -> 'patch') k where k <> 'id';
      if cols is null then continue; end if;
      execute format('update public.%I set (%s) = (select %s from jsonb_populate_record(null::public.%I, $1)) where id = $2', t, cols, cols, t)
        using op -> 'patch', (op ->> 'id')::uuid;
      if not found then raise exception '% % not found', t, op ->> 'id'; end if;
    else
      raise exception 'unknown op %', op ->> 'op';
    end if;
  end loop;
  return true;
end $$;
revoke all on function public.apply_batch(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.apply_batch(jsonb, jsonb) to service_role;

-- ─── Rate limiting (fixed window, shared across app instances) ───────────────
create table public.rate_limits (
  key           text primary key,
  window_start  timestamptz not null,
  hits          integer not null
);

create or replace function public.rate_limit_hit(p_key text, p_max integer, p_window_seconds integer) returns boolean
language plpgsql set search_path = public as $$
declare current_hits integer;
begin
  insert into public.rate_limits as r (key, window_start, hits) values (p_key, now(), 1)
  on conflict (key) do update set
    hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into current_hits;
  return current_hits <= p_max;
end $$;
revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;

-- ─── Notification log ────────────────────────────────────────────────────────
create table public.notification_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles (id) on delete set null,
  channel     text not null check (channel in ('email', 'sms', 'push', 'in_app')),
  template    text not null,
  status      text not null check (status in ('sent', 'failed', 'skipped')),
  provider    text not null,
  error       text,
  created_at  timestamptz not null default now()
);

-- ─── RLS for new tables ──────────────────────────────────────────────────────
revoke all on public.business_credentials, public.reviews, public.rate_limits, public.notification_log from anon, authenticated;
grant all on public.business_credentials, public.reviews, public.rate_limits, public.notification_log to service_role;
alter table public.business_credentials enable row level security;
alter table public.reviews enable row level security;
alter table public.rate_limits enable row level security;
alter table public.notification_log enable row level security;

grant select on public.business_credentials, public.reviews to authenticated;
create policy credentials_owner on public.business_credentials for select to authenticated using (
  exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
);
create policy reviews_readable on public.reviews for select to authenticated using (true);

-- Businesses: clients see verified businesses and their own; not suspended/rejected strangers.
drop policy if exists businesses_visible on public.businesses;
create policy businesses_visible on public.businesses for select to authenticated using (
  verification_status = 'verified' or is_simulated or owner_id = auth.uid()
);

-- Soft-deleted profiles are invisible even to themselves via the API.
drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles for select to authenticated using (id = auth.uid() and deleted_at is null);
grant select (jurisdiction, currency, ai_processing_consent) on public.profiles to authenticated;
