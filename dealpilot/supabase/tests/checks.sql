-- Integrity and RLS checks, run by scripts/test-migrations.sh after migrations + seed.
\set ON_ERROR_STOP 1

create or replace function pg_temp.expect_error(sql text, label text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    raise notice 'ok: % (%)', label, sqlerrm;
    return;
  end;
  raise exception 'expected failure: %', label;
end $$;

create or replace function pg_temp.expect_eq(actual bigint, expected bigint, label text) returns void language plpgsql as $$
begin
  if actual is distinct from expected then raise exception '%: expected %, got %', label, expected, actual; end if;
  raise notice 'ok: %', label;
end $$;

-- Seed loaded
select pg_temp.expect_eq((select count(*) from public.categories), 10, 'ten categories');
select pg_temp.expect_eq((select count(*) from public.profiles where is_demo), 7, 'seven demo profiles');
select pg_temp.expect_eq((select count(*) from public.offers where request_id = '00000000-0000-4000-8000-000000000301'), 3, 'three fencing offers');

-- Savings & fee integrity
select pg_temp.expect_error($q$
  insert into public.transactions (customer_id, category_id, description, baseline_cents, final_cents, recurrence, period_savings_cents, annual_savings_cents, status, fee_status)
  values ('00000000-0000-4000-8000-000000000001', 'trades', 'x', 1000, 800, 'one_off', 500, 500, 'pending_verification', 'pending')
$q$, 'overstated savings rejected');
select pg_temp.expect_error($q$
  insert into public.transactions (customer_id, category_id, description, baseline_cents, final_cents, recurrence, period_savings_cents, annual_savings_cents, status, fee_cents, fee_status)
  values ('00000000-0000-4000-8000-000000000001', 'trades', 'x', 1000, 800, 'one_off', 200, 200, 'pending_verification', 150, 'pending')
$q$, 'fee on unverified transaction rejected');
select pg_temp.expect_error($q$
  insert into public.transactions (customer_id, category_id, description, baseline_cents, final_cents, recurrence, period_savings_cents, annual_savings_cents, status, fee_cents, fee_status, verified_at, verified_by, verification_method)
  values ('00000000-0000-4000-8000-000000000001', 'trades', 'x', 1000, 900, 'one_off', 100, 100, 'verified', 150, 'charged_simulated', now(), '00000000-0000-4000-8000-000000000001', 'customer_confirmed_invoice')
$q$, 'fee above saving rejected');
select pg_temp.expect_error($q$
  insert into public.transactions (customer_id, category_id, description, baseline_cents, final_cents, recurrence, period_savings_cents, annual_savings_cents, status, fee_status)
  values ('00000000-0000-4000-8000-000000000001', 'telco', 'x', 12000, 9000, 'monthly', 3000, 3000, 'pending_verification', 'pending')
$q$, 'annual savings must be annualised');

-- Ledger & audit are append-only and idempotent
select pg_temp.expect_error($q$ update public.ledger_entries set amount_cents = 0 $q$, 'ledger update blocked');
select pg_temp.expect_error($q$ delete from public.ledger_entries $q$, 'ledger delete blocked');
select pg_temp.expect_error($q$
  insert into public.ledger_entries (transaction_id, user_id, type, amount_cents, idempotency_key)
  values ('00000000-0000-4000-8000-000000000801', '00000000-0000-4000-8000-000000000001', 'fee_charged', 150, 'fee:00000000-0000-4000-8000-000000000801')
$q$, 'duplicate fee rejected by idempotency key');
insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id) values ('system', 'system', 'test', 'test', '1');
select pg_temp.expect_error($q$ delete from public.audit_logs $q$, 'audit delete blocked');

-- Human approval required for real business offers
select pg_temp.expect_error($q$
  insert into public.offers (request_id, business_id, status, price_cents, recurrence, scope, valid_until)
  values ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000104', 'submitted', 100, 'one_off', 'x', now())
$q$, 'unapproved real offer rejected');

-- No scraping data source
select pg_temp.expect_error($q$ update public.price_watches set data_source = 'scraped' $q$, 'unknown data source rejected');

-- ─── RLS as signed-in users ──────────────────────────────────────────────────
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001"}', false);
select pg_temp.expect_eq((select count(*) from public.purchase_requests), 1, 'alex sees own request');
select pg_temp.expect_eq((select count(*) from public.documents), 2, 'alex sees own documents');
select pg_temp.expect_eq((select count(*) from public.profiles), 1, 'alex sees only own profile');
select pg_temp.expect_error($q$ select password_hash from public.profiles $q$, 'password hash not readable');
select pg_temp.expect_error($q$ select * from public.negotiations $q$, 'negotiations not directly readable');
select pg_temp.expect_error($q$ update public.purchase_requests set status = 'completed' $q$, 'clients cannot write');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002"}', false);
select pg_temp.expect_eq((select count(*) from public.purchase_requests), 0, 'priya cannot see alex request');
select pg_temp.expect_eq((select count(*) from public.ledger_entries), 0, 'priya cannot see alex ledger');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000005"}', false);
select pg_temp.expect_eq((select count(*) from public.offers), 1, 'ben sees only his own offer');
select pg_temp.expect_eq((select count(*) from public.transactions), 0, 'ben sees no customer transactions yet');
reset role;

-- Storage folder policy
insert into storage.objects (bucket_id, name) values ('documents', '00000000-0000-4000-8000-000000000001/doc1'), ('documents', '00000000-0000-4000-8000-000000000002/doc2');
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001"}', false);
select pg_temp.expect_eq((select count(*) from storage.objects), 1, 'storage: only own folder visible');
reset role;
