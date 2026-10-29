-- Revoked sessions lose database access immediately.
--
-- PostgREST only checks the JWT signature, so before this migration an access token copied
-- before sign-out kept working until it expired (up to `jwt_expiry`). Now a request counts
-- as authenticated only while the JWT's `session_id` still exists in `auth.sessions` (Supabase
-- Auth deletes the row on sign-out, revocation and password change) and has not passed its
-- `not_after` limit. Every RLS policy resolves the caller through `app.current_user_id()`, so
-- a dead session is denied everywhere, the same as an anonymous request.

create or replace function app.session_is_active()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.sessions s
    where s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid
      and s.user_id = auth.uid()
      and (s.not_after is null or s.not_after > now())
  )
$$;

create or replace function app.current_user_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select u.id from public.users u where u.auth_id = auth.uid() and app.session_is_active()
$$;

grant execute on function app.session_is_active() to authenticated, service_role;

-- The two policies that compared auth.uid() directly now go through current_user_id().
drop policy users_select on public.users;
create policy users_select on public.users for select to authenticated using (
  id = app.current_user_id()
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

drop policy users_update_self on public.users;
create policy users_update_self on public.users for update to authenticated
  using (id = app.current_user_id()) with check (id = app.current_user_id());
