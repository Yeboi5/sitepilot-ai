-- Update Pack 1.1, Phase B: consumers get a personal workspace automatically.
--
-- Home buyers and investors shouldn't have to "create an organisation" before exploring.
-- This idempotent RPC gives a signed-in user with no memberships a personal investor
-- organisation (they become its admin, on the free plan). Tenancy and RLS are unchanged:
-- the personal workspace is an ordinary investor organisation. Firms still onboard explicitly.

create or replace function public.ensure_personal_workspace()
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid  uuid := app.current_user_id();
  name text;
  org  uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- Serialise concurrent first sign-ins for the same user so only one workspace is created.
  perform pg_advisory_xact_lock(hashtextextended('personal_workspace:' || uid::text, 0));

  select m.organisation_id into org
  from public.memberships m
  where m.user_id = uid
  order by m.created_at
  limit 1;

  if org is not null then
    return org;
  end if;

  select u.display_name into name from public.users u where u.id = uid;
  return public.create_organisation(left(name, 140) || '''s workspace', 'investor');
end;
$$;

revoke all on function public.ensure_personal_workspace() from public, anon;
grant execute on function public.ensure_personal_workspace() to authenticated;
