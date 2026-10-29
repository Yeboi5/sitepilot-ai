-- Audited report exports (blueprint §2: audited access).
--
-- Users cannot write audit_events directly, so exports are recorded through this function.
-- It only succeeds for members of the property's owning organisation with a live session.

create or replace function public.record_report_export(prop uuid, export_format text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  org uuid;
begin
  if export_format not in ('view', 'html') then
    raise exception 'unsupported export format' using errcode = '22023';
  end if;

  select p.owner_org_id into org
  from public.properties p
  where p.id = prop and app.is_member(p.owner_org_id);

  if org is null then
    raise exception 'not permitted' using errcode = '42501';
  end if;

  insert into public.audit_events (organisation_id, actor_id, resource_type, resource_id, action, metadata)
  values (org, app.current_user_id(), 'properties', prop, 'report.exported', jsonb_build_object('format', export_format));
end;
$$;

revoke all on function public.record_report_export(uuid, text) from public, anon;
grant execute on function public.record_report_export(uuid, text) to authenticated;
