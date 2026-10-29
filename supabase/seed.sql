-- SYNTHETIC demo data only. Every person, organisation, address, lot/DP and URL below is
-- fictional. Never load real client documents into a non-production environment.
--
-- Demo password for every account: SitePilotDemo!2026
--
-- Fixed UUIDs are referenced by the RLS test-suite (tests/db/fixtures.ts).

-- ─── Auth users (profiles are created by the on_auth_user_created trigger) ────
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('a0000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'ivy.investor@demo.sitepilot.test', extensions.crypt('SitePilotDemo!2026', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Ivy Investor"}', now(), now()),
  ('a0000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'connie.conveyancer@demo.sitepilot.test', extensions.crypt('SitePilotDemo!2026', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Connie Conveyancer"}', now(), now()),
  ('a0000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'sam.staff@demo.sitepilot.test', extensions.crypt('SitePilotDemo!2026', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Sam Staff"}', now(), now()),
  ('a0000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'oscar.other@demo.sitepilot.test', extensions.crypt('SitePilotDemo!2026', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Oscar Other"}', now(), now()),
  ('a0000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'pat.platform@demo.sitepilot.test', extensions.crypt('SitePilotDemo!2026', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Pat Platform"}', now(), now());

-- Pin profile ids so fixtures are stable.
update public.users set id = 'b0000000-0000-4000-8000-000000000001' where auth_id = 'a0000000-0000-4000-8000-000000000001';
update public.users set id = 'b0000000-0000-4000-8000-000000000002' where auth_id = 'a0000000-0000-4000-8000-000000000002';
update public.users set id = 'b0000000-0000-4000-8000-000000000003' where auth_id = 'a0000000-0000-4000-8000-000000000003';
update public.users set id = 'b0000000-0000-4000-8000-000000000004' where auth_id = 'a0000000-0000-4000-8000-000000000004';
update public.users set id = 'b0000000-0000-4000-8000-000000000005' where auth_id = 'a0000000-0000-4000-8000-000000000005';

insert into public.platform_admins (user_id) values ('b0000000-0000-4000-8000-000000000005');

-- ─── Organisations ──────────────────────────────────────────────────────────
insert into public.organisations (id, name, type, verification_status) values
  ('c0000000-0000-4000-8000-000000000001', 'Harbourview Demo Developments (synthetic)', 'investor', 'unverified'),
  ('c0000000-0000-4000-8000-000000000002', 'Demo Conveyancing Pty Ltd (synthetic)', 'professional', 'pending'),
  ('c0000000-0000-4000-8000-000000000003', 'Westside Demo Holdings (synthetic)', 'investor', 'unverified');

insert into public.memberships (user_id, organisation_id, role) values
  ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'admin'),
  ('b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', 'admin'),
  ('b0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000002', 'member'),
  ('b0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000003', 'admin');

insert into public.subscriptions (organisation_id, plan, status) values
  ('c0000000-0000-4000-8000-000000000001', 'investor_pro', 'trialing'),
  ('c0000000-0000-4000-8000-000000000002', 'conveyancer', 'trialing'),
  ('c0000000-0000-4000-8000-000000000003', 'explorer', 'trialing');

-- ─── Properties & evidence ──────────────────────────────────────────────────
insert into public.properties (id, owner_org_id, address, suburb, postcode, lot_dp, created_by) values
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   '12 Example Street', 'Parramatta', '2150', 'Lot 1 DP 0000001 (synthetic)', 'b0000000-0000-4000-8000-000000000001'),
  ('d0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001',
   '48 Sample Avenue', 'Penrith', '2750', 'Lot 7 DP 0000002 (synthetic)', 'b0000000-0000-4000-8000-000000000001'),
  ('d0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000003',
   '3 Placeholder Road', 'Blacktown', '2148', 'Lot 3 DP 0000003 (synthetic)', 'b0000000-0000-4000-8000-000000000004');

insert into public.evidence (id, property_id, title, source_type, source_url, fetched_at, verification_status, verified_by, verified_at, notes, created_by) values
  ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
   'Planning certificate (synthetic sample)', 'planning_certificate', 'https://example.com/synthetic/planning-certificate-12-example-st.pdf',
   '2026-10-01', 'verified', 'b0000000-0000-4000-8000-000000000001', now(),
   'Synthetic fixture. Real certificates must be obtained from the issuing council.', 'b0000000-0000-4000-8000-000000000001'),
  ('e0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001',
   'Planning Portal property report (synthetic sample)', 'planning_portal', 'https://example.com/synthetic/portal-report-12-example-st',
   '2026-10-12', 'unverified', null, null, null, 'b0000000-0000-4000-8000-000000000001'),
  ('e0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000003',
   'Council record (synthetic sample)', 'council_record', 'https://example.com/synthetic/council-3-placeholder-rd',
   '2026-09-20', 'unverified', null, null, null, 'b0000000-0000-4000-8000-000000000004');

-- ─── Matters ────────────────────────────────────────────────────────────────
-- f…01: invitation awaiting the firm. f…02: active matter with Connie granted edit access.
insert into public.matters (id, property_id, investor_org_id, professional_org_id, status, created_by) values
  ('f0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'invited', 'b0000000-0000-4000-8000-000000000001'),
  ('f0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000002',
   'c0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'active', 'b0000000-0000-4000-8000-000000000001');

insert into public.matter_access (matter_id, user_id, permission, granted_by) values
  ('f0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'edit', 'b0000000-0000-4000-8000-000000000001');

-- ─── Documents & findings (synthetic contract, no real content) ─────────────
insert into public.documents (id, owner_org_id, property_id, matter_id, file_name, storage_key, mime, size_bytes, checksum, classification, scan_status, uploaded_by) values
  ('10000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002',
   'f0000000-0000-4000-8000-000000000002', 'synthetic-contract-48-sample-ave.pdf',
   'c0000000-0000-4000-8000-000000000001/10000000-0000-4000-8000-000000000001.pdf', 'application/pdf', 182044,
   'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'contract_for_sale', 'clean', 'b0000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
   null, 'internal-notes-12-example-st.pdf',
   'c0000000-0000-4000-8000-000000000001/10000000-0000-4000-8000-000000000002.pdf', 'application/pdf', 20480,
   'a3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'other', 'clean', 'b0000000-0000-4000-8000-000000000001');

insert into public.findings (id, document_id, category, extracted_text, page_ref, span_start, span_end, confidence, status, ai_model) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'settlement_period',
   'Completion is to take place 42 days after the contract date.', 3, 120, 181, 0.910, 'unreviewed', 'fixture'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'special_condition',
   'The purchaser acknowledges an easement for drainage 1.5 wide affects the property.', 11, 40, 123, 0.640, 'unreviewed', 'fixture');

insert into public.tasks (matter_id, title, assignee_id, due_at, status) values
  ('f0000000-0000-4000-8000-000000000002', 'Review drainage easement on title (synthetic)', 'b0000000-0000-4000-8000-000000000002', now() + interval '5 days', 'open'),
  ('f0000000-0000-4000-8000-000000000002', 'Confirm engagement checklist (synthetic)', 'b0000000-0000-4000-8000-000000000002', now() + interval '2 days', 'in_progress');
