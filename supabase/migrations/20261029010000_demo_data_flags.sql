-- Demo-data safeguards.
--
-- All seeded planning and valuation information is synthetic and must never be presented as an
-- official or verified result. Rows flagged `is_demo` can never be marked verified, and end users
-- cannot set or clear the flag. Only trusted server contexts (seed / service role) can create
-- demo rows.

alter type public.evidence_source_type add value if not exists 'valuation';

alter table public.properties add column is_demo boolean not null default false;
alter table public.evidence add column is_demo boolean not null default false;

alter table public.evidence
  add constraint evidence_demo_never_verified check (not (is_demo and verification_status = 'verified'));

create or replace function app.guard_demo_flag()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    return new; -- trusted server context (seed / service role)
  end if;

  if tg_op = 'UPDATE' then
    new.is_demo = old.is_demo; -- immutable for end users
  else
    new.is_demo = false;
  end if;

  -- Evidence attached to a demo property is always demo evidence.
  if tg_table_name = 'evidence' and not new.is_demo then
    new.is_demo = coalesce(
      (select p.is_demo from public.properties p where p.id = new.property_id),
      false
    );
  end if;
  return new;
end;
$$;

-- Named to sort before `evidence_verification` so the demo flag is settled first.
create trigger evidence_demo_guard before insert or update on public.evidence
  for each row execute function app.guard_demo_flag();
create trigger properties_demo_guard before insert or update on public.properties
  for each row execute function app.guard_demo_flag();
