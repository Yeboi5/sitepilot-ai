-- DealPilot core schema.
-- Column names are the snake_case form of the TypeScript domain types in
-- src/lib/domain/types.ts (the Supabase driver maps them automatically).
-- Money is always integer cents (bigint). Nested, append-mostly structures
-- (negotiation messages, price history, group offers) are jsonb.
--
-- Access model: the Next.js server uses the service-role key and enforces
-- authorisation in src/lib/services. RLS below is defence in depth: any client
-- holding the anon key + a user JWT can only READ its own rows and can never
-- write. password_hash is never readable by API roles.

create extension if not exists pgcrypto;

-- ─── Categories (mirrors src/lib/domain/categories.ts) ───────────────────────
create table public.categories (
  id          text primary key,
  name        text not null,
  definition  jsonb not null default '{}'::jsonb,
  active      boolean not null default true
);

-- ─── Accounts ────────────────────────────────────────────────────────────────
create table public.profiles (
  id                     uuid primary key default gen_random_uuid(),
  email                  text not null unique check (email = lower(email)),
  name                   text not null,
  role                   text not null check (role in ('customer', 'business', 'admin')),
  business_id            uuid,
  password_hash          text,
  permission_mode        text not null default 'approval' check (permission_mode in ('advisory', 'approval', 'autopilot')),
  autopilot_limit_cents  bigint not null default 0 check (autopilot_limit_cents between 0 and 500000),
  region                 text not null default 'Australia-wide',
  is_demo                boolean not null default false,
  created_at             timestamptz not null default now()
);

create table public.businesses (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid references public.profiles (id) on delete set null,
  name              text not null,
  abn               text check (abn is null or abn ~ '^\d{11}$'),
  description       text not null default '',
  categories        text[] not null default '{}',
  regions           text[] not null default '{}',
  qualifications    text[] not null default '{}',
  licence_number    text,
  insured           boolean not null default false,
  rating            numeric(2, 1) check (rating is null or rating between 0 and 5),
  review_count      integer not null default 0 check (review_count >= 0),
  reviews_verified  boolean not null default false,
  is_simulated      boolean not null default false,
  created_at        timestamptz not null default now(),
  -- A real (non-simulated) business must be operated by a person.
  constraint real_business_has_owner check (is_simulated or owner_id is not null)
);

alter table public.profiles
  add constraint profiles_business_fk foreign key (business_id) references public.businesses (id) deferrable initially deferred,
  add constraint business_role check ((role = 'business') = (business_id is not null));

-- ─── Documents (blobs live in the private `documents` Storage bucket) ───────
create table public.documents (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  filename     text not null,
  mime_type    text not null check (mime_type in ('application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain', 'text/csv')),
  size_bytes   integer not null check (size_bytes between 1 and 8388608),
  category_id  text not null references public.categories (id),
  kind         text not null check (kind in ('quote', 'bill', 'receipt', 'contract', 'invoice', 'statement', 'other')),
  storage_key  text not null unique,
  analysis     jsonb,
  is_demo      boolean not null default false,
  uploaded_at  timestamptz not null default now(),
  -- Keys are always "<owner_id>/<document_id>" so storage policies can scope by folder.
  constraint storage_key_scoped check (storage_key = owner_id::text || '/' || id::text)
);

-- ─── Marketplace ─────────────────────────────────────────────────────────────
create table public.purchase_requests (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references public.profiles (id) on delete cascade,
  category_id     text not null references public.categories (id),
  title           text not null check (length(title) between 4 and 140),
  description     text not null default '',
  region          text not null,
  fields          jsonb not null default '{}'::jsonb,
  baseline_cents  bigint not null check (baseline_cents > 0),
  recurrence      text not null check (recurrence in ('one_off', 'weekly', 'monthly', 'quarterly', 'annual')),
  document_id     uuid references public.documents (id) on delete set null,
  status          text not null default 'open' check (status in ('open', 'negotiating', 'awarded', 'completed', 'cancelled')),
  closes_at       timestamptz not null,
  is_demo         boolean not null default false,
  created_at      timestamptz not null default now()
);

create table public.offers (
  id                   uuid primary key default gen_random_uuid(),
  request_id           uuid not null references public.purchase_requests (id) on delete cascade,
  business_id          uuid not null references public.businesses (id),
  status               text not null check (status in ('draft', 'submitted', 'countered', 'accepted', 'declined', 'withdrawn', 'expired')),
  price_cents          bigint not null check (price_cents > 0),
  recurrence           text not null,
  scope                text not null,
  materials            text not null default '',
  warranty_months      integer not null default 0 check (warranty_months between 0 and 600),
  completion_days      integer not null default 0 check (completion_days between 0 and 365),
  includes_insurance   boolean not null default false,
  ai_drafted           boolean not null default false,
  approved_by_user_id  uuid references public.profiles (id),
  approved_at          timestamptz,
  valid_until          timestamptz not null,
  is_simulated         boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (request_id, business_id),
  -- Human approval is required before a real business's offer leaves draft.
  constraint real_offers_are_approved check (is_simulated or status = 'draft' or approved_by_user_id is not null)
);

-- ─── Negotiations ────────────────────────────────────────────────────────────
create table public.negotiations (
  id                   uuid primary key default gen_random_uuid(),
  customer_id          uuid not null references public.profiles (id) on delete cascade,
  category_id          text not null references public.categories (id),
  title                text not null,
  request_id           uuid references public.purchase_requests (id) on delete set null,
  offer_id             uuid references public.offers (id) on delete set null,
  business_id          uuid references public.businesses (id),
  counterparty_name    text not null,
  mode                 text not null check (mode in ('advisory', 'approval', 'autopilot')),
  state                text not null check (state in ('open', 'awaiting_approval', 'awaiting_counterparty', 'counter_received', 'escalated', 'agreed', 'completed', 'declined', 'cancelled', 'expired')),
  baseline_cents       bigint not null check (baseline_cents > 0),
  target_cents         bigint not null check (target_cents >= 0),
  current_offer_cents  bigint not null check (current_offer_cents > 0),
  agreed_cents         bigint check (agreed_cents is null or agreed_cents > 0),
  recurrence           text not null,
  messages             jsonb not null default '[]'::jsonb,
  simulated            boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint agreed_has_price check (state not in ('agreed', 'completed') or agreed_cents is not null)
);

-- ─── Group buying ────────────────────────────────────────────────────────────
create table public.purchasing_groups (
  id                      uuid primary key default gen_random_uuid(),
  category_id             text not null references public.categories (id),
  title                   text not null,
  description             text not null default '',
  region                  text not null,
  eligibility             text not null default '',
  member_ids              uuid[] not null default '{}',
  simulated_member_count  integer not null default 0 check (simulated_member_count >= 0),
  target_size             integer not null check (target_size >= 2),
  baseline_cents          bigint not null check (baseline_cents > 0),
  recurrence              text not null,
  expires_at              timestamptz not null,
  offers                  jsonb not null default '[]'::jsonb,
  status                  text not null check (status in ('forming', 'offer_available', 'closed')),
  is_simulated            boolean not null default false,
  created_at              timestamptz not null default now()
);

-- ─── Monitoring & guardian ───────────────────────────────────────────────────
create table public.price_watches (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references public.profiles (id) on delete cascade,
  kind                    text not null check (kind in ('retail_product', 'bill', 'subscription', 'contract')),
  label                   text not null,
  merchant                text not null,
  category_id             text not null references public.categories (id),
  purchase_price_cents    bigint not null check (purchase_price_cents > 0),
  purchased_at            timestamptz,
  target_price_cents      bigint,
  adjustment_window_days  integer check (adjustment_window_days is null or adjustment_window_days between 1 and 365),
  renewal_date            timestamptz,
  history                 jsonb not null default '[]'::jsonb,
  -- No scraping: only manual entry, approved APIs or the labelled simulated feed.
  data_source             text not null check (data_source in ('manual', 'simulated_feed', 'approved_api')),
  active                  boolean not null default true,
  created_at              timestamptz not null default now()
);

create table public.alerts (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references public.profiles (id) on delete cascade,
  watch_id                 uuid references public.price_watches (id) on delete cascade,
  kind                     text not null,
  title                    text not null,
  body                     text not null,
  potential_savings_cents  bigint,
  href                     text,
  read                     boolean not null default false,
  created_at               timestamptz not null default now()
);

create table public.expense_lines (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  date          date not null,
  merchant      text not null,
  amount_cents  bigint not null check (amount_cents > 0),
  source        text not null check (source in ('manual', 'csv_upload', 'read_only_feed')),
  created_at    timestamptz not null default now()
);

-- ─── Transactions, ledger, audit ─────────────────────────────────────────────
create table public.transactions (
  id                    uuid primary key default gen_random_uuid(),
  customer_id           uuid not null references public.profiles (id),
  business_id           uuid references public.businesses (id),
  category_id           text not null references public.categories (id),
  description           text not null,
  request_id            uuid references public.purchase_requests (id),
  offer_id              uuid references public.offers (id),
  negotiation_id        uuid unique references public.negotiations (id),
  group_id              uuid references public.purchasing_groups (id),
  baseline_cents        bigint not null check (baseline_cents > 0),
  final_cents           bigint not null check (final_cents > 0),
  recurrence            text not null,
  period_savings_cents  bigint not null,
  annual_savings_cents  bigint not null,
  status                text not null check (status in ('pending_verification', 'verified', 'rejected', 'cancelled')),
  verification_method   text check (verification_method in ('customer_confirmed_invoice', 'business_confirmed', 'document_match', 'admin_review')),
  evidence_document_id  uuid references public.documents (id),
  verified_at           timestamptz,
  verified_by           uuid references public.profiles (id),
  fee_cents             bigint not null default 0 check (fee_cents >= 0),
  fee_status            text not null check (fee_status in ('not_applicable', 'pending', 'charged_simulated', 'waived')),
  simulated             boolean not null default false,
  created_at            timestamptz not null default now(),
  -- Savings integrity: always derived from baseline and final price, never negative.
  constraint savings_derived check (period_savings_cents = greatest(baseline_cents - final_cents, 0)),
  constraint annual_savings_derived check (annual_savings_cents = period_savings_cents * case recurrence when 'weekly' then 52 when 'monthly' then 12 when 'quarterly' then 4 else 1 end),
  -- Revenue integrity: fees only on verified savings, never more than the saving.
  constraint fee_only_when_verified check (fee_cents = 0 or status = 'verified'),
  constraint fee_not_above_saving check (fee_cents <= period_savings_cents),
  constraint verified_has_evidence check (status <> 'verified' or (verified_at is not null and verified_by is not null and verification_method is not null))
);

create table public.ledger_entries (
  id               uuid primary key default gen_random_uuid(),
  transaction_id   uuid not null references public.transactions (id),
  user_id          uuid not null references public.profiles (id),
  type             text not null check (type in ('saving_recorded', 'saving_verified', 'fee_charged', 'fee_waived', 'commission_recorded')),
  amount_cents     bigint not null check (amount_cents >= 0),
  currency         text not null default 'AUD' check (currency ~ '^[A-Z]{3}$'),
  idempotency_key  text not null unique,
  simulated        boolean not null default true,
  note             text,
  created_at       timestamptz not null default now()
);

create table public.audit_logs (
  id           uuid primary key default gen_random_uuid(),
  at           timestamptz not null default now(),
  actor_id     text not null,
  actor_role   text not null,
  action       text not null,
  entity_type  text not null,
  entity_id    text not null,
  detail       jsonb
);

create or replace function public.forbid_mutation() returns trigger language plpgsql as $$
begin
  raise exception '% is append-only', tg_table_name;
end $$;

create trigger ledger_append_only before update or delete on public.ledger_entries
  for each row execute function public.forbid_mutation();
create trigger audit_append_only before update or delete on public.audit_logs
  for each row execute function public.forbid_mutation();

-- ─── Indexes ─────────────────────────────────────────────────────────────────
create index on public.documents (owner_id);
create index on public.purchase_requests (customer_id);
create index on public.purchase_requests (category_id, region) where status in ('open', 'negotiating');
create index on public.offers (business_id);
create index on public.negotiations (customer_id);
create index on public.negotiations (business_id);
create index on public.price_watches (user_id);
create index on public.alerts (user_id) where not read;
create index on public.expense_lines (user_id, date);
create index on public.transactions (customer_id);
create index on public.transactions (business_id);
create index on public.ledger_entries (user_id);
create index on public.audit_logs (actor_id, at desc);

-- ─── Privileges & row-level security ─────────────────────────────────────────
revoke all on all tables in schema public from anon, authenticated;
grant all on all tables in schema public to service_role;

alter table public.categories enable row level security;
alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.documents enable row level security;
alter table public.purchase_requests enable row level security;
alter table public.offers enable row level security;
alter table public.negotiations enable row level security;
alter table public.purchasing_groups enable row level security;
alter table public.price_watches enable row level security;
alter table public.alerts enable row level security;
alter table public.expense_lines enable row level security;
alter table public.transactions enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.audit_logs enable row level security;

-- Read-only grants to signed-in users; RLS narrows them to their own rows.
grant select on public.categories, public.businesses, public.documents, public.purchase_requests, public.offers,
  public.price_watches, public.alerts, public.expense_lines, public.transactions, public.ledger_entries to authenticated;
-- profiles: every column except password_hash.
grant select (id, email, name, role, business_id, permission_mode, autopilot_limit_cents, region, is_demo, created_at) on public.profiles to authenticated;
grant select on public.categories to anon;

create policy categories_public on public.categories for select using (active);
create policy profiles_self on public.profiles for select to authenticated using (id = auth.uid());
create policy businesses_visible on public.businesses for select to authenticated using (true);
create policy documents_owner on public.documents for select to authenticated using (owner_id = auth.uid());
create policy requests_owner on public.purchase_requests for select to authenticated using (customer_id = auth.uid());
create policy offers_customer on public.offers for select to authenticated using (
  status <> 'draft' and exists (select 1 from public.purchase_requests r where r.id = request_id and r.customer_id = auth.uid())
);
create policy offers_business on public.offers for select to authenticated using (
  exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
);
-- Negotiations and groups contain data the counterparty must not see (targets, AI notes, member lists),
-- so there is no direct client read access; the server returns redacted views.
create policy watches_owner on public.price_watches for select to authenticated using (user_id = auth.uid());
create policy alerts_owner on public.alerts for select to authenticated using (user_id = auth.uid());
create policy expenses_owner on public.expense_lines for select to authenticated using (user_id = auth.uid());
create policy transactions_party on public.transactions for select to authenticated using (
  customer_id = auth.uid() or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
);
create policy ledger_owner on public.ledger_entries for select to authenticated using (user_id = auth.uid());

-- ─── Private document storage ────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 8388608, array['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain', 'text/csv'])
on conflict (id) do nothing;

create policy documents_owner_read on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
