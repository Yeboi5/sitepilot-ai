-- SYNTHETIC demo data only. Every person, organisation, address, lot/DP and URL below is
-- fictional. Never load real client documents into a non-production environment.
--
-- Demo password for every account: SitePilotDemo!2026
--
-- Fixed UUIDs are referenced by the RLS test-suite (tests/db/fixtures.ts).

-- ─── Auth users (profiles are created by the on_auth_user_created trigger) ────
-- Token columns are '' rather than NULL, as Supabase Auth expects for password sign-in.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('a0000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'ivy.investor@demo.sitepilot.test', extensions.crypt('SitePilotDemo!2026', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Ivy Investor"}', now(), now(), '', '', '', ''),
  ('a0000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'connie.conveyancer@demo.sitepilot.test', extensions.crypt('SitePilotDemo!2026', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Connie Conveyancer"}', now(), now(), '', '', '', ''),
  ('a0000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'sam.staff@demo.sitepilot.test', extensions.crypt('SitePilotDemo!2026', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Sam Staff"}', now(), now(), '', '', '', ''),
  ('a0000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'oscar.other@demo.sitepilot.test', extensions.crypt('SitePilotDemo!2026', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Oscar Other"}', now(), now(), '', '', '', ''),
  ('a0000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'pat.platform@demo.sitepilot.test', extensions.crypt('SitePilotDemo!2026', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Pat Platform"}', now(), now(), '', '', '', ''),
  ('a0000000-0000-4000-8000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'nina.newbuyer@demo.sitepilot.test', extensions.crypt('SitePilotDemo!2026', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Nina Newbuyer"}', now(), now(), '', '', '', ''),
  ('a0000000-0000-4000-8000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'vera.verifier@demo.sitepilot.test', extensions.crypt('SitePilotDemo!2026', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Vera Verifier"}', now(), now(), '', '', '', '');

-- One email identity per user (required by Supabase Auth).
insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', now(), now(), now()
from auth.users u where u.email like '%@demo.sitepilot.test';

-- Pin profile ids so fixtures are stable.
update public.users set id = 'b0000000-0000-4000-8000-000000000001' where auth_id = 'a0000000-0000-4000-8000-000000000001';
update public.users set id = 'b0000000-0000-4000-8000-000000000002' where auth_id = 'a0000000-0000-4000-8000-000000000002';
update public.users set id = 'b0000000-0000-4000-8000-000000000003' where auth_id = 'a0000000-0000-4000-8000-000000000003';
update public.users set id = 'b0000000-0000-4000-8000-000000000004' where auth_id = 'a0000000-0000-4000-8000-000000000004';
update public.users set id = 'b0000000-0000-4000-8000-000000000005' where auth_id = 'a0000000-0000-4000-8000-000000000005';
-- Nina is a new home buyer with no workspace yet (first sign-in creates one).
update public.users set id = 'b0000000-0000-4000-8000-000000000006' where auth_id = 'a0000000-0000-4000-8000-000000000006';
-- Vera reviews homeowner claims (restricted verifier role; no other special access).
update public.users set id = 'b0000000-0000-4000-8000-000000000007' where auth_id = 'a0000000-0000-4000-8000-000000000007';

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
-- Every property and evidence row here is is_demo = true: a database constraint stops demo
-- evidence from ever being marked verified. No lot/DP, zoning, planning control or valuation figure
-- is recorded, because none has been obtained from an official source. Source URLs use the
-- reserved `.invalid` domain so they can never resolve to a real record.
insert into public.properties (id, owner_org_id, address, suburb, postcode, lot_dp, is_demo, created_by) values
  -- Primary demo property (shared with the demo conveyancer on an active matter).
  ('d0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001',
   '76 Sunrise Avenue', 'Halekulani', '2262', null, true, 'b0000000-0000-4000-8000-000000000001'),
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   '12 Example Street', 'Parramatta', '2150', null, true, 'b0000000-0000-4000-8000-000000000001'),
  ('d0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000003',
   '3 Placeholder Road', 'Blacktown', '2148', null, true, 'b0000000-0000-4000-8000-000000000004');

insert into public.evidence (id, property_id, title, source_type, source_url, fetched_at, verification_status, notes, is_demo, created_by) values
  ('e0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000002',
   'DEMO placeholder: planning certificate (not obtained)', 'planning_certificate',
   'https://demo.sitepilot.invalid/evidence/76-sunrise-ave/planning-certificate',
   '2026-10-20', 'unverified',
   'UNVERIFIED DEMO DATA. No planning certificate has been requested or issued. Obtain the real certificate from the issuing council before relying on any planning control.',
   true, 'b0000000-0000-4000-8000-000000000001'),
  ('e0000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000002',
   'DEMO placeholder: Planning Portal property report (not retrieved)', 'planning_portal',
   'https://demo.sitepilot.invalid/evidence/76-sunrise-ave/planning-portal-report',
   '2026-10-20', 'unverified',
   'UNVERIFIED DEMO DATA. Zoning, height, FSR and minimum lot size are intentionally not recorded.',
   true, 'b0000000-0000-4000-8000-000000000001'),
  ('e0000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000002',
   'DEMO placeholder: valuation (no figure recorded)', 'valuation',
   'https://demo.sitepilot.invalid/evidence/76-sunrise-ave/valuation',
   '2026-10-20', 'unverified',
   'UNVERIFIED DEMO DATA. No valuation has been performed. A value must come from a registered valuer or be entered as an investor assumption.',
   true, 'b0000000-0000-4000-8000-000000000001'),
  ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
   'DEMO placeholder: planning certificate', 'planning_certificate',
   'https://demo.sitepilot.invalid/evidence/12-example-st/planning-certificate',
   '2026-10-01', 'unverified', 'UNVERIFIED DEMO DATA.', true, 'b0000000-0000-4000-8000-000000000001'),
  ('e0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001',
   'DEMO placeholder: Planning Portal report', 'planning_portal',
   'https://demo.sitepilot.invalid/evidence/12-example-st/planning-portal-report',
   '2026-10-12', 'unverified', 'UNVERIFIED DEMO DATA.', true, 'b0000000-0000-4000-8000-000000000001'),
  ('e0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000003',
   'DEMO placeholder: council record', 'council_record',
   'https://demo.sitepilot.invalid/evidence/3-placeholder-rd/council-record',
   '2026-09-20', 'unverified', 'UNVERIFIED DEMO DATA.', true, 'b0000000-0000-4000-8000-000000000004');

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
   'f0000000-0000-4000-8000-000000000002', 'SYNTHETIC-demo-contract-76-sunrise-ave.pdf',
   'c0000000-0000-4000-8000-000000000001/10000000-0000-4000-8000-000000000001.pdf', 'application/pdf', 182044,
   'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'contract_for_sale', 'clean', 'b0000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
   null, 'internal-notes-12-example-st.pdf',
   'c0000000-0000-4000-8000-000000000001/10000000-0000-4000-8000-000000000002.pdf', 'application/pdf', 20480,
   'a3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'other', 'clean', 'b0000000-0000-4000-8000-000000000001');

insert into public.findings (id, document_id, category, extracted_text, page_ref, span_start, span_end, confidence, status, ai_model) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'settlement_period',
   '[SYNTHETIC TEST TEXT] Completion is to take place 42 days after the contract date.', 3, 120, 181, 0.910, 'unreviewed', 'fixture'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'special_condition',
   '[SYNTHETIC TEST TEXT] The purchaser acknowledges an easement for drainage 1.5 wide affects the property.', 11, 40, 123, 0.640, 'unreviewed', 'fixture');

insert into public.tasks (matter_id, title, assignee_id, due_at, status) values
  ('f0000000-0000-4000-8000-000000000002', 'Review drainage easement on title (synthetic)', 'b0000000-0000-4000-8000-000000000002', now() + interval '5 days', 'open'),
  ('f0000000-0000-4000-8000-000000000002', 'Confirm engagement checklist (synthetic)', 'b0000000-0000-4000-8000-000000000002', now() + interval '2 days', 'in_progress');

-- BEGIN GENERATED DEMO LISTINGS (scripts/gen-demo-listings.ts)
-- 48 fictional listings across all states and territories. Illustrative only.
insert into public.property_records (id, state, suburb, postcode, street_address, source, is_demo) values
  ('31000000-0000-4000-8000-000000000001', 'NSW', 'Halekulani', '2262', '[DEMO] 11 Example Lane', 'demo', true),
  ('31000000-0000-4000-8000-000000000002', 'NSW', 'Parramatta', '2150', '[DEMO] 12 Example Lane', 'demo', true),
  ('31000000-0000-4000-8000-000000000003', 'NSW', 'Newcastle', '2300', null, 'demo', true),
  ('31000000-0000-4000-8000-000000000004', 'NSW', 'Wollongong', '2500', '[DEMO] 14 Example Lane', 'demo', true),
  ('31000000-0000-4000-8000-000000000005', 'NSW', 'Orange', '2800', '[DEMO] 15 Example Lane', 'demo', true),
  ('31000000-0000-4000-8000-000000000006', 'NSW', 'Tamworth', '2340', null, 'demo', true),
  ('31000000-0000-4000-8000-000000000007', 'VIC', 'Ballarat', '3350', '[DEMO] 17 Example Lane', 'demo', true),
  ('31000000-0000-4000-8000-000000000008', 'VIC', 'Geelong', '3220', '[DEMO] 18 Example Lane', 'demo', true),
  ('31000000-0000-4000-8000-000000000009', 'VIC', 'Brunswick', '3056', null, 'demo', true),
  ('31000000-0000-4000-8000-000000000010', 'VIC', 'Bendigo', '3550', '[DEMO] 20 Example Lane', 'demo', true),
  ('31000000-0000-4000-8000-000000000011', 'VIC', 'Frankston', '3199', '[DEMO] 21 Example Lane', 'demo', true),
  ('31000000-0000-4000-8000-000000000012', 'VIC', 'Shepparton', '3630', null, 'demo', true),
  ('31000000-0000-4000-8000-000000000013', 'QLD', 'Townsville', '4810', '[DEMO] 23 Example Lane', 'demo', true),
  ('31000000-0000-4000-8000-000000000014', 'QLD', 'Toowoomba', '4350', '[DEMO] 24 Example Lane', 'demo', true),
  ('31000000-0000-4000-8000-000000000015', 'QLD', 'Southport', '4215', null, 'demo', true),
  ('31000000-0000-4000-8000-000000000016', 'QLD', 'Cairns', '4870', '[DEMO] 26 Example Lane', 'demo', true),
  ('31000000-0000-4000-8000-000000000017', 'QLD', 'Ipswich', '4305', '[DEMO] 27 Example Lane', 'demo', true),
  ('31000000-0000-4000-8000-000000000018', 'QLD', 'Mackay', '4740', null, 'demo', true),
  ('31000000-0000-4000-8000-000000000019', 'WA', 'Fremantle', '6160', '[DEMO] 29 Example Lane', 'demo', true),
  ('31000000-0000-4000-8000-000000000020', 'WA', 'Joondalup', '6027', '[DEMO] 30 Example Lane', 'demo', true),
  ('31000000-0000-4000-8000-000000000021', 'WA', 'Bunbury', '6230', null, 'demo', true),
  ('31000000-0000-4000-8000-000000000022', 'WA', 'Midland', '6056', '[DEMO] 32 Example Lane', 'demo', true),
  ('31000000-0000-4000-8000-000000000023', 'WA', 'Geraldton', '6530', '[DEMO] 33 Example Lane', 'demo', true),
  ('31000000-0000-4000-8000-000000000024', 'WA', 'Mandurah', '6210', null, 'demo', true),
  ('31000000-0000-4000-8000-000000000025', 'SA', 'Glenelg', '5045', '[DEMO] 35 Example Lane', 'demo', true),
  ('31000000-0000-4000-8000-000000000026', 'SA', 'Mount Barker', '5251', '[DEMO] 36 Example Lane', 'demo', true),
  ('31000000-0000-4000-8000-000000000027', 'SA', 'Elizabeth', '5112', null, 'demo', true),
  ('31000000-0000-4000-8000-000000000028', 'SA', 'Port Lincoln', '5606', '[DEMO] 38 Example Lane', 'demo', true),
  ('31000000-0000-4000-8000-000000000029', 'SA', 'Norwood', '5067', '[DEMO] 39 Example Lane', 'demo', true),
  ('31000000-0000-4000-8000-000000000030', 'SA', 'Murray Bridge', '5253', null, 'demo', true),
  ('31000000-0000-4000-8000-000000000031', 'TAS', 'Launceston', '7250', '[DEMO] 41 Example Lane', 'demo', true),
  ('31000000-0000-4000-8000-000000000032', 'TAS', 'Sandy Bay', '7005', '[DEMO] 42 Example Lane', 'demo', true),
  ('31000000-0000-4000-8000-000000000033', 'TAS', 'Devonport', '7310', null, 'demo', true),
  ('31000000-0000-4000-8000-000000000034', 'TAS', 'Kingston', '7050', '[DEMO] 44 Example Lane', 'demo', true),
  ('31000000-0000-4000-8000-000000000035', 'TAS', 'Burnie', '7320', '[DEMO] 45 Example Lane', 'demo', true),
  ('31000000-0000-4000-8000-000000000036', 'TAS', 'Glenorchy', '7010', null, 'demo', true),
  ('31000000-0000-4000-8000-000000000037', 'ACT', 'Belconnen', '2617', '[DEMO] 47 Example Lane', 'demo', true),
  ('31000000-0000-4000-8000-000000000038', 'ACT', 'Tuggeranong', '2900', '[DEMO] 48 Example Lane', 'demo', true),
  ('31000000-0000-4000-8000-000000000039', 'ACT', 'Gungahlin', '2912', null, 'demo', true),
  ('31000000-0000-4000-8000-000000000040', 'ACT', 'Kingston', '2604', '[DEMO] 50 Example Lane', 'demo', true),
  ('31000000-0000-4000-8000-000000000041', 'ACT', 'Weston', '2611', '[DEMO] 51 Example Lane', 'demo', true),
  ('31000000-0000-4000-8000-000000000042', 'ACT', 'Bruce', '2617', null, 'demo', true),
  ('31000000-0000-4000-8000-000000000043', 'NT', 'Darwin City', '0800', '[DEMO] 53 Example Lane', 'demo', true),
  ('31000000-0000-4000-8000-000000000044', 'NT', 'Palmerston', '0830', '[DEMO] 54 Example Lane', 'demo', true),
  ('31000000-0000-4000-8000-000000000045', 'NT', 'Alice Springs', '0870', null, 'demo', true),
  ('31000000-0000-4000-8000-000000000046', 'NT', 'Nightcliff', '0810', '[DEMO] 56 Example Lane', 'demo', true),
  ('31000000-0000-4000-8000-000000000047', 'NT', 'Katherine', '0850', '[DEMO] 57 Example Lane', 'demo', true),
  ('31000000-0000-4000-8000-000000000048', 'NT', 'Stuart Park', '0820', null, 'demo', true);

insert into public.listings (id, property_record_id, kind, market, is_demo, headline, description, property_type, state, suburb, postcode, street_address, bedrooms, bathrooms, car_spaces, land_area_sqm, asking_price, price_display, indicative_weekly_rent, development_idea, risk_flags, lifestyle_tags, illustration_seed, provenance, listed_on) values
  ('30000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', 'home', 'for_sale', true, 'Sunny 2-bedroom house in Halekulani', 'A fictional 2-bedroom house created for SitePilot''s demo. The price and details are illustrative only and do not describe a real property.', 'house', 'NSW', 'Halekulani', '2262', '[DEMO] 11 Example Lane', 2, 1, 1, 280, 980000, '$980,000', null, null, '{}'::text[], array['North-facing backyard', 'Renovated kitchen', 'Walk to shops'], 37, '{"source":"SitePilot synthetic demo data","licence":"fictional, no third-party data","as_of":"2026-10-30","verification":"unverified"}', '2026-10-04'),
  ('30000000-0000-4000-8000-000000000002', '31000000-0000-4000-8000-000000000002', 'home', 'for_sale', true, 'Sunny 3-bedroom townhouse in Parramatta', 'A fictional 3-bedroom townhouse created for SitePilot''s demo. The price and details are illustrative only and do not describe a real property.', 'townhouse', 'NSW', 'Parramatta', '2150', '[DEMO] 12 Example Lane', 3, 2, 2, 333, 1135000, '$1,135,000', null, null, '{}'::text[], array['Open-plan living', 'Solar panels', 'Room for a veggie patch'], 74, '{"source":"SitePilot synthetic demo data","licence":"fictional, no third-party data","as_of":"2026-10-30","verification":"unverified"}', '2026-10-07'),
  ('30000000-0000-4000-8000-000000000003', '31000000-0000-4000-8000-000000000003', 'home', 'off_market', true, 'Newcastle 2-bedroom apartment with potential', 'A fictional apartment shown to illustrate off-market screening. It is NOT FOR SALE, and nothing suggests the owner wants to sell.', 'apartment', 'NSW', 'Newcastle', '2300', null, 2, 1, 1, null, null, null, null, null, '{}'::text[], array['Quiet street', 'Second living area', 'Off-street parking'], 111, '{"source":"SitePilot synthetic demo data","licence":"fictional, no third-party data","as_of":"2026-10-30","verification":"unverified"}', null),
  ('30000000-0000-4000-8000-000000000004', '31000000-0000-4000-8000-000000000004', 'investment', 'for_sale', true, 'Wollongong 2-bedroom duplex: add a bedroom', 'A fictional 2-bedroom duplex created for SitePilot''s demo. The price and details are illustrative only and do not describe a real property.', 'duplex', 'NSW', 'Wollongong', '2500', '[DEMO] 14 Example Lane', 2, 2, 2, 439, 980000, '$980,000', 810, 'Add a bedroom: extension concept', array['Bushfire-prone area? Check state mapping'], '{}'::text[], 148, '{"source":"SitePilot synthetic demo data","licence":"fictional, no third-party data","as_of":"2026-10-30","verification":"unverified"}', '2026-10-13'),
  ('30000000-0000-4000-8000-000000000005', '31000000-0000-4000-8000-000000000005', 'investment', 'for_sale', true, 'Orange land: new home build concept', 'A fictional land created for SitePilot''s demo. The price and details are illustrative only and do not describe a real property.', 'land', 'NSW', 'Orange', '2800', '[DEMO] 15 Example Lane', 0, 0, 0, 492, 800000, '$800,000', null, 'New home build concept: check council rules', array['Heritage controls may apply: check with council'], '{}'::text[], 185, '{"source":"SitePilot synthetic demo data","licence":"fictional, no third-party data","as_of":"2026-10-30","verification":"unverified"}', '2026-10-16'),
  ('30000000-0000-4000-8000-000000000006', '31000000-0000-4000-8000-000000000006', 'investment', 'off_market', true, 'Off-market potential: Tamworth house', 'A fictional house shown to illustrate off-market screening. It is NOT FOR SALE, and nothing suggests the owner wants to sell.', 'house', 'NSW', 'Tamworth', '2340', null, 4, 2, 2, 545, null, null, null, 'Granny flat concept: check council rules for secondary dwellings', array['Tenanted: confirm lease terms'], '{}'::text[], 222, '{"source":"SitePilot synthetic demo data","licence":"fictional, no third-party data","as_of":"2026-10-30","verification":"unverified"}', null),
  ('30000000-0000-4000-8000-000000000007', '31000000-0000-4000-8000-000000000007', 'home', 'for_sale', true, 'Sunny 3-bedroom townhouse in Ballarat', 'A fictional 3-bedroom townhouse created for SitePilot''s demo. The price and details are illustrative only and do not describe a real property.', 'townhouse', 'VIC', 'Ballarat', '3350', '[DEMO] 17 Example Lane', 3, 2, 2, 377, 945000, '$945,000', null, null, '{}'::text[], array['Open-plan living', 'Solar panels', 'Room for a veggie patch'], 259, '{"source":"SitePilot synthetic demo data","licence":"fictional, no third-party data","as_of":"2026-10-30","verification":"unverified"}', '2026-10-22'),
  ('30000000-0000-4000-8000-000000000008', '31000000-0000-4000-8000-000000000008', 'home', 'for_sale', true, 'Sunny 2-bedroom apartment in Geelong', 'A fictional 2-bedroom apartment created for SitePilot''s demo. The price and details are illustrative only and do not describe a real property.', 'apartment', 'VIC', 'Geelong', '3220', '[DEMO] 18 Example Lane', 2, 1, 1, null, 890000, '$890,000', null, null, '{}'::text[], array['Quiet street', 'Second living area', 'Off-street parking'], 296, '{"source":"SitePilot synthetic demo data","licence":"fictional, no third-party data","as_of":"2026-10-30","verification":"unverified"}', '2026-10-25'),
  ('30000000-0000-4000-8000-000000000009', '31000000-0000-4000-8000-000000000009', 'home', 'off_market', true, 'Brunswick 2-bedroom duplex with potential', 'A fictional duplex shown to illustrate off-market screening. It is NOT FOR SALE, and nothing suggests the owner wants to sell.', 'duplex', 'VIC', 'Brunswick', '3056', null, 2, 2, 2, 483, null, null, null, null, '{}'::text[], array['Big windows, lots of light', 'Covered deck', 'Low-maintenance garden'], 333, '{"source":"SitePilot synthetic demo data","licence":"fictional, no third-party data","as_of":"2026-10-30","verification":"unverified"}', null),
  ('30000000-0000-4000-8000-000000000010', '31000000-0000-4000-8000-000000000010', 'investment', 'for_sale', true, 'Bendigo land: new home build concept', 'A fictional land created for SitePilot''s demo. The price and details are illustrative only and do not describe a real property.', 'land', 'VIC', 'Bendigo', '3550', '[DEMO] 20 Example Lane', 0, 0, 0, 536, 665000, '$665,000', null, 'New home build concept: check council rules', array['Heritage controls may apply: check with council'], '{}'::text[], 370, '{"source":"SitePilot synthetic demo data","licence":"fictional, no third-party data","as_of":"2026-10-30","verification":"unverified"}', '2026-10-03'),
  ('30000000-0000-4000-8000-000000000011', '31000000-0000-4000-8000-000000000011', 'investment', 'for_sale', true, 'Frankston 4-bedroom house: granny flat concept', 'A fictional 4-bedroom house created for SitePilot''s demo. The price and details are illustrative only and do not describe a real property.', 'house', 'VIC', 'Frankston', '3199', '[DEMO] 21 Example Lane', 4, 2, 2, 589, 1075000, '$1,075,000', 1100, 'Granny flat concept: check council rules for secondary dwellings', array['Tenanted: confirm lease terms'], '{}'::text[], 407, '{"source":"SitePilot synthetic demo data","licence":"fictional, no third-party data","as_of":"2026-10-30","verification":"unverified"}', '2026-10-06'),
  ('30000000-0000-4000-8000-000000000012', '31000000-0000-4000-8000-000000000012', 'investment', 'off_market', true, 'Off-market potential: Shepparton townhouse', 'A fictional townhouse shown to illustrate off-market screening. It is NOT FOR SALE, and nothing suggests the owner wants to sell.', 'townhouse', 'VIC', 'Shepparton', '3630', null, 2, 1, 1, 642, null, null, null, 'Renovate and rent: kitchen and bathroom refresh', array['Older wiring: building inspection advised'], '{}'::text[], 444, '{"source":"SitePilot synthetic demo data","licence":"fictional, no third-party data","as_of":"2026-10-30","verification":"unverified"}', null),
  ('30000000-0000-4000-8000-000000000013', '31000000-0000-4000-8000-000000000013', 'home', 'for_sale', true, 'Sunny 2-bedroom apartment in Townsville', 'A fictional 2-bedroom apartment created for SitePilot''s demo. The price and details are illustrative only and do not describe a real property.', 'apartment', 'QLD', 'Townsville', '4810', '[DEMO] 23 Example Lane', 2, 1, 1, null, 785000, '$785,000', null, null, '{}'::text[], array['Quiet street', 'Second living area', 'Off-street parking'], 481, '{"source":"SitePilot synthetic demo data","licence":"fictional, no third-party data","as_of":"2026-10-30","verification":"unverified"}', '2026-10-12'),
  ('30000000-0000-4000-8000-000000000014', '31000000-0000-4000-8000-000000000014', 'home', 'for_sale', true, 'Sunny 2-bedroom duplex in Toowoomba', 'A fictional 2-bedroom duplex created for SitePilot''s demo. The price and details are illustrative only and do not describe a real property.', 'duplex', 'QLD', 'Toowoomba', '4350', '[DEMO] 24 Example Lane', 2, 2, 2, 527, 720000, '$720,000', null, null, '{}'::text[], array['Big windows, lots of light', 'Covered deck', 'Low-maintenance garden'], 518, '{"source":"SitePilot synthetic demo data","licence":"fictional, no third-party data","as_of":"2026-10-30","verification":"unverified"}', '2026-10-15'),
  ('30000000-0000-4000-8000-000000000015', '31000000-0000-4000-8000-000000000015', 'home', 'off_market', true, 'Southport 3-bedroom house with potential', 'A fictional house shown to illustrate off-market screening. It is NOT FOR SALE, and nothing suggests the owner wants to sell.', 'house', 'QLD', 'Southport', '4215', null, 3, 1, 1, 580, null, null, null, null, '{}'::text[], array['Home office nook', 'Ducted heating and cooling', 'Pet-friendly yard'], 555, '{"source":"SitePilot synthetic demo data","licence":"fictional, no third-party data","as_of":"2026-10-30","verification":"unverified"}', null),
  ('30000000-0000-4000-8000-000000000016', '31000000-0000-4000-8000-000000000016', 'investment', 'for_sale', true, 'Cairns 4-bedroom house: granny flat concept', 'A fictional 4-bedroom house created for SitePilot''s demo. The price and details are illustrative only and do not describe a real property.', 'house', 'QLD', 'Cairns', '4870', '[DEMO] 26 Example Lane', 4, 2, 2, 633, 950000, '$950,000', 1040, 'Granny flat concept: check council rules for secondary dwellings', array['Tenanted: confirm lease terms'], '{}'::text[], 592, '{"source":"SitePilot synthetic demo data","licence":"fictional, no third-party data","as_of":"2026-10-30","verification":"unverified"}', '2026-10-21'),
  ('30000000-0000-4000-8000-000000000017', '31000000-0000-4000-8000-000000000017', 'investment', 'for_sale', true, 'Ipswich 2-bedroom townhouse: renovate and rent', 'A fictional 2-bedroom townhouse created for SitePilot''s demo. The price and details are illustrative only and do not describe a real property.', 'townhouse', 'QLD', 'Ipswich', '4305', '[DEMO] 27 Example Lane', 2, 1, 1, 686, 720000, '$720,000', 480, 'Renovate and rent: kitchen and bathroom refresh', array['Older wiring: building inspection advised'], '{}'::text[], 629, '{"source":"SitePilot synthetic demo data","licence":"fictional, no third-party data","as_of":"2026-10-30","verification":"unverified"}', '2026-10-24'),
  ('30000000-0000-4000-8000-000000000018', '31000000-0000-4000-8000-000000000018', 'investment', 'off_market', true, 'Off-market potential: Mackay apartment', 'A fictional apartment shown to illustrate off-market screening. It is NOT FOR SALE, and nothing suggests the owner wants to sell.', 'apartment', 'QLD', 'Mackay', '4740', null, 2, 2, 1, null, null, null, null, 'Cosmetic refresh and re-lease', array['Possible flood overlay: check council mapping'], '{}'::text[], 666, '{"source":"SitePilot synthetic demo data","licence":"fictional, no third-party data","as_of":"2026-10-30","verification":"unverified"}', null),
  ('30000000-0000-4000-8000-000000000019', '31000000-0000-4000-8000-000000000019', 'home', 'for_sale', true, 'Sunny 2-bedroom duplex in Fremantle', 'A fictional 2-bedroom duplex created for SitePilot''s demo. The price and details are illustrative only and do not describe a real property.', 'duplex', 'WA', 'Fremantle', '6160', '[DEMO] 29 Example Lane', 2, 2, 2, 571, 675000, '$675,000', null, null, '{}'::text[], array['Big windows, lots of light', 'Covered deck', 'Low-maintenance garden'], 703, '{"source":"SitePilot synthetic demo data","licence":"fictional, no third-party data","as_of":"2026-10-30","verification":"unverified"}', '2026-10-02'),
  ('30000000-0000-4000-8000-000000000020', '31000000-0000-4000-8000-000000000020', 'home', 'for_sale', true, 'Sunny 3-bedroom house in Joondalup', 'A fictional 3-bedroom house created for SitePilot''s demo. The price and details are illustrative only and do not describe a real property.', 'house', 'WA', 'Joondalup', '6027', '[DEMO] 30 Example Lane', 3, 1, 1, 624, 785000, '$785,000', null, null, '{}'::text[], array['Home office nook', 'Ducted heating and cooling', 'Pet-friendly yard'], 740, '{"source":"SitePilot synthetic demo data","licence":"fictional, no third-party data","as_of":"2026-10-30","verification":"unverified"}', '2026-10-05'),
  ('30000000-0000-4000-8000-000000000021', '31000000-0000-4000-8000-000000000021', 'home', 'off_market', true, 'Bunbury 4-bedroom townhouse with potential', 'A fictional townhouse shown to illustrate off-market screening. It is NOT FOR SALE, and nothing suggests the owner wants to sell.', 'townhouse', 'WA', 'Bunbury', '6230', null, 4, 2, 2, 677, null, null, null, null, '{}'::text[], array['Character features', 'High ceilings', 'Established trees'], 777, '{"source":"SitePilot synthetic demo data","licence":"fictional, no third-party data","as_of":"2026-10-30","verification":"unverified"}', null),
  ('30000000-0000-4000-8000-000000000022', '31000000-0000-4000-8000-000000000022', 'investment', 'for_sale', true, 'Midland 2-bedroom townhouse: renovate and rent', 'A fictional 2-bedroom townhouse created for SitePilot''s demo. The price and details are illustrative only and do not describe a real property.', 'townhouse', 'WA', 'Midland', '6056', '[DEMO] 32 Example Lane', 2, 1, 1, 730, 675000, '$675,000', 510, 'Renovate and rent: kitchen and bathroom refresh', array['Older wiring: building inspection advised'], '{}'::text[], 814, '{"source":"SitePilot synthetic demo data","licence":"fictional, no third-party data","as_of":"2026-10-30","verification":"unverified"}', '2026-10-11'),
  ('30000000-0000-4000-8000-000000000023', '31000000-0000-4000-8000-000000000023', 'investment', 'for_sale', true, 'Geraldton 2-bedroom apartment: cosmetic refresh and re-lease', 'A fictional 2-bedroom apartment created for SitePilot''s demo. The price and details are illustrative only and do not describe a real property.', 'apartment', 'WA', 'Geraldton', '6530', '[DEMO] 33 Example Lane', 2, 2, 1, null, 710000, '$710,000', 570, 'Cosmetic refresh and re-lease', array['Possible flood overlay: check council mapping'], '{}'::text[], 851, '{"source":"SitePilot synthetic demo data","licence":"fictional, no third-party data","as_of":"2026-10-30","verification":"unverified"}', '2026-10-14'),
  ('30000000-0000-4000-8000-000000000024', '31000000-0000-4000-8000-000000000024', 'investment', 'off_market', true, 'Off-market potential: Mandurah duplex', 'A fictional duplex shown to illustrate off-market screening. It is NOT FOR SALE, and nothing suggests the owner wants to sell.', 'duplex', 'WA', 'Mandurah', '6210', null, 4, 1, 1, 316, null, null, null, 'Add a bedroom: extension concept', array['Strata levies unknown: request records'], '{}'::text[], 888, '{"source":"SitePilot synthetic demo data","licence":"fictional, no third-party data","as_of":"2026-10-30","verification":"unverified"}', null),
  ('30000000-0000-4000-8000-000000000025', '31000000-0000-4000-8000-000000000025', 'home', 'for_sale', true, 'Sunny 3-bedroom house in Glenelg', 'A fictional 3-bedroom house created for SitePilot''s demo. The price and details are illustrative only and do not describe a real property.', 'house', 'SA', 'Glenelg', '5045', '[DEMO] 35 Example Lane', 3, 1, 1, 668, 750000, '$750,000', null, null, '{}'::text[], array['Home office nook', 'Ducted heating and cooling', 'Pet-friendly yard'], 925, '{"source":"SitePilot synthetic demo data","licence":"fictional, no third-party data","as_of":"2026-10-30","verification":"unverified"}', '2026-10-20'),
  ('30000000-0000-4000-8000-000000000026', '31000000-0000-4000-8000-000000000026', 'home', 'for_sale', true, 'Sunny 4-bedroom townhouse in Mount Barker', 'A fictional 4-bedroom townhouse created for SitePilot''s demo. The price and details are illustrative only and do not describe a real property.', 'townhouse', 'SA', 'Mount Barker', '5251', '[DEMO] 36 Example Lane', 4, 2, 2, 721, 855000, '$855,000', null, null, '{}'::text[], array['Character features', 'High ceilings', 'Established trees'], 962, '{"source":"SitePilot synthetic demo data","licence":"fictional, no third-party data","as_of":"2026-10-30","verification":"unverified"}', '2026-10-23'),
  ('30000000-0000-4000-8000-000000000027', '31000000-0000-4000-8000-000000000027', 'home', 'off_market', true, 'Elizabeth 2-bedroom apartment with potential', 'A fictional apartment shown to illustrate off-market screening. It is NOT FOR SALE, and nothing suggests the owner wants to sell.', 'apartment', 'SA', 'Elizabeth', '5112', null, 2, 1, 1, null, null, null, null, null, '{}'::text[], array['North-facing backyard', 'Renovated kitchen', 'Walk to shops'], 999, '{"source":"SitePilot synthetic demo data","licence":"fictional, no third-party data","as_of":"2026-10-30","verification":"unverified"}', null),
  ('30000000-0000-4000-8000-000000000028', '31000000-0000-4000-8000-000000000028', 'investment', 'for_sale', true, 'Port Lincoln 2-bedroom apartment: cosmetic refresh and re-lease', 'A fictional 2-bedroom apartment created for SitePilot''s demo. The price and details are illustrative only and do not describe a real property.', 'apartment', 'SA', 'Port Lincoln', '5606', '[DEMO] 38 Example Lane', 2, 2, 1, null, 675000, '$675,000', 600, 'Cosmetic refresh and re-lease', array['Possible flood overlay: check council mapping'], '{}'::text[], 1036, '{"source":"SitePilot synthetic demo data","licence":"fictional, no third-party data","as_of":"2026-10-30","verification":"unverified"}', '2026-10-01'),
  ('30000000-0000-4000-8000-000000000029', '31000000-0000-4000-8000-000000000029', 'investment', 'for_sale', true, 'Norwood 4-bedroom duplex: add a bedroom', 'A fictional 4-bedroom duplex created for SitePilot''s demo. The price and details are illustrative only and do not describe a real property.', 'duplex', 'SA', 'Norwood', '5067', '[DEMO] 39 Example Lane', 4, 1, 1, 360, 855000, '$855,000', 810, 'Add a bedroom: extension concept', array['Strata levies unknown: request records'], '{}'::text[], 1073, '{"source":"SitePilot synthetic demo data","licence":"fictional, no third-party data","as_of":"2026-10-30","verification":"unverified"}', '2026-10-04'),
  ('30000000-0000-4000-8000-000000000030', '31000000-0000-4000-8000-000000000030', 'investment', 'off_market', true, 'Off-market potential: Murray Bridge land', 'A fictional land shown to illustrate off-market screening. It is NOT FOR SALE, and nothing suggests the owner wants to sell.', 'land', 'SA', 'Murray Bridge', '5253', null, 0, 0, 0, 413, null, null, null, 'Subdivision concept: lot size and zoning must be checked', array['Bushfire-prone area? Check state mapping'], '{}'::text[], 1110, '{"source":"SitePilot synthetic demo data","licence":"fictional, no third-party data","as_of":"2026-10-30","verification":"unverified"}', null),
  ('30000000-0000-4000-8000-000000000031', '31000000-0000-4000-8000-000000000031', 'home', 'for_sale', true, 'Sunny 4-bedroom townhouse in Launceston', 'A fictional 4-bedroom townhouse created for SitePilot''s demo. The price and details are illustrative only and do not describe a real property.', 'townhouse', 'TAS', 'Launceston', '7250', '[DEMO] 41 Example Lane', 4, 2, 2, 765, 775000, '$775,000', null, null, '{}'::text[], array['Character features', 'High ceilings', 'Established trees'], 1147, '{"source":"SitePilot synthetic demo data","licence":"fictional, no third-party data","as_of":"2026-10-30","verification":"unverified"}', '2026-10-10'),
  ('30000000-0000-4000-8000-000000000032', '31000000-0000-4000-8000-000000000032', 'home', 'for_sale', true, 'Sunny 2-bedroom apartment in Sandy Bay', 'A fictional 2-bedroom apartment created for SitePilot''s demo. The price and details are illustrative only and do not describe a real property.', 'apartment', 'TAS', 'Sandy Bay', '7005', '[DEMO] 42 Example Lane', 2, 1, 1, null, 580000, '$580,000', null, null, '{}'::text[], array['North-facing backyard', 'Renovated kitchen', 'Walk to shops'], 1184, '{"source":"SitePilot synthetic demo data","licence":"fictional, no third-party data","as_of":"2026-10-30","verification":"unverified"}', '2026-10-13'),
  ('30000000-0000-4000-8000-000000000033', '31000000-0000-4000-8000-000000000033', 'home', 'off_market', true, 'Devonport 3-bedroom duplex with potential', 'A fictional duplex shown to illustrate off-market screening. It is NOT FOR SALE, and nothing suggests the owner wants to sell.', 'duplex', 'TAS', 'Devonport', '7310', null, 3, 2, 2, 351, null, null, null, null, '{}'::text[], array['Open-plan living', 'Solar panels', 'Room for a veggie patch'], 1221, '{"source":"SitePilot synthetic demo data","licence":"fictional, no third-party data","as_of":"2026-10-30","verification":"unverified"}', null),
  ('30000000-0000-4000-8000-000000000034', '31000000-0000-4000-8000-000000000034', 'investment', 'for_sale', true, 'Kingston 4-bedroom duplex: add a bedroom', 'A fictional 4-bedroom duplex created for SitePilot''s demo. The price and details are illustrative only and do not describe a real property.', 'duplex', 'TAS', 'Kingston', '7050', '[DEMO] 44 Example Lane', 4, 1, 1, 404, 775000, '$775,000', 790, 'Add a bedroom: extension concept', array['Strata levies unknown: request records'], '{}'::text[], 1258, '{"source":"SitePilot synthetic demo data","licence":"fictional, no third-party data","as_of":"2026-10-30","verification":"unverified"}', '2026-10-19'),
  ('30000000-0000-4000-8000-000000000035', '31000000-0000-4000-8000-000000000035', 'investment', 'for_sale', true, 'Burnie land: subdivision concept', 'A fictional land created for SitePilot''s demo. The price and details are illustrative only and do not describe a real property.', 'land', 'TAS', 'Burnie', '7320', '[DEMO] 45 Example Lane', 0, 0, 0, 457, 450000, '$450,000', null, 'Subdivision concept: lot size and zoning must be checked', array['Bushfire-prone area? Check state mapping'], '{}'::text[], 1295, '{"source":"SitePilot synthetic demo data","licence":"fictional, no third-party data","as_of":"2026-10-30","verification":"unverified"}', '2026-10-22'),
  ('30000000-0000-4000-8000-000000000036', '31000000-0000-4000-8000-000000000036', 'investment', 'off_market', true, 'Off-market potential: Glenorchy house', 'A fictional house shown to illustrate off-market screening. It is NOT FOR SALE, and nothing suggests the owner wants to sell.', 'house', 'TAS', 'Glenorchy', '7010', null, 3, 1, 1, 510, null, null, null, 'Granny flat concept: check council rules for secondary dwellings', array['Heritage controls may apply: check with council'], '{}'::text[], 1332, '{"source":"SitePilot synthetic demo data","licence":"fictional, no third-party data","as_of":"2026-10-30","verification":"unverified"}', null),
  ('30000000-0000-4000-8000-000000000037', '31000000-0000-4000-8000-000000000037', 'home', 'for_sale', true, 'Sunny 2-bedroom apartment in Belconnen', 'A fictional 2-bedroom apartment created for SitePilot''s demo. The price and details are illustrative only and do not describe a real property.', 'apartment', 'ACT', 'Belconnen', '2617', '[DEMO] 47 Example Lane', 2, 1, 1, null, 855000, '$855,000', null, null, '{}'::text[], array['North-facing backyard', 'Renovated kitchen', 'Walk to shops'], 1369, '{"source":"SitePilot synthetic demo data","licence":"fictional, no third-party data","as_of":"2026-10-30","verification":"unverified"}', '2026-10-28'),
  ('30000000-0000-4000-8000-000000000038', '31000000-0000-4000-8000-000000000038', 'home', 'for_sale', true, 'Sunny 3-bedroom duplex in Tuggeranong', 'A fictional 3-bedroom duplex created for SitePilot''s demo. The price and details are illustrative only and do not describe a real property.', 'duplex', 'ACT', 'Tuggeranong', '2900', '[DEMO] 48 Example Lane', 3, 2, 2, 395, 990000, '$990,000', null, null, '{}'::text[], array['Open-plan living', 'Solar panels', 'Room for a veggie patch'], 1406, '{"source":"SitePilot synthetic demo data","licence":"fictional, no third-party data","as_of":"2026-10-30","verification":"unverified"}', '2026-10-03'),
  ('30000000-0000-4000-8000-000000000039', '31000000-0000-4000-8000-000000000039', 'home', 'off_market', true, 'Gungahlin 4-bedroom house with potential', 'A fictional house shown to illustrate off-market screening. It is NOT FOR SALE, and nothing suggests the owner wants to sell.', 'house', 'ACT', 'Gungahlin', '2912', null, 4, 1, 1, 448, null, null, null, null, '{}'::text[], array['Quiet street', 'Second living area', 'Off-street parking'], 1443, '{"source":"SitePilot synthetic demo data","licence":"fictional, no third-party data","as_of":"2026-10-30","verification":"unverified"}', null),
  ('30000000-0000-4000-8000-000000000040', '31000000-0000-4000-8000-000000000040', 'investment', 'for_sale', true, 'Kingston land: subdivision concept', 'A fictional land created for SitePilot''s demo. The price and details are illustrative only and do not describe a real property.', 'land', 'ACT', 'Kingston', '2604', '[DEMO] 50 Example Lane', 0, 0, 0, 501, 655000, '$655,000', null, 'Subdivision concept: lot size and zoning must be checked', array['Bushfire-prone area? Check state mapping'], '{}'::text[], 1480, '{"source":"SitePilot synthetic demo data","licence":"fictional, no third-party data","as_of":"2026-10-30","verification":"unverified"}', '2026-10-09'),
  ('30000000-0000-4000-8000-000000000041', '31000000-0000-4000-8000-000000000041', 'investment', 'for_sale', true, 'Weston 3-bedroom house: granny flat concept', 'A fictional 3-bedroom house created for SitePilot''s demo. The price and details are illustrative only and do not describe a real property.', 'house', 'ACT', 'Weston', '2611', '[DEMO] 51 Example Lane', 3, 1, 1, 554, 990000, '$990,000', 720, 'Granny flat concept: check council rules for secondary dwellings', array['Heritage controls may apply: check with council'], '{}'::text[], 1517, '{"source":"SitePilot synthetic demo data","licence":"fictional, no third-party data","as_of":"2026-10-30","verification":"unverified"}', '2026-10-12'),
  ('30000000-0000-4000-8000-000000000042', '31000000-0000-4000-8000-000000000042', 'investment', 'off_market', true, 'Off-market potential: Bruce townhouse', 'A fictional townhouse shown to illustrate off-market screening. It is NOT FOR SALE, and nothing suggests the owner wants to sell.', 'townhouse', 'ACT', 'Bruce', '2617', null, 4, 2, 2, 607, null, null, null, 'Renovate and rent: kitchen and bathroom refresh', array['Tenanted: confirm lease terms'], '{}'::text[], 1554, '{"source":"SitePilot synthetic demo data","licence":"fictional, no third-party data","as_of":"2026-10-30","verification":"unverified"}', null),
  ('30000000-0000-4000-8000-000000000043', '31000000-0000-4000-8000-000000000043', 'home', 'for_sale', true, 'Sunny 3-bedroom duplex in Darwin City', 'A fictional 3-bedroom duplex created for SitePilot''s demo. The price and details are illustrative only and do not describe a real property.', 'duplex', 'NT', 'Darwin City', '0800', '[DEMO] 53 Example Lane', 3, 2, 2, 439, 630000, '$630,000', null, null, '{}'::text[], array['Open-plan living', 'Solar panels', 'Room for a veggie patch'], 1591, '{"source":"SitePilot synthetic demo data","licence":"fictional, no third-party data","as_of":"2026-10-30","verification":"unverified"}', '2026-10-18'),
  ('30000000-0000-4000-8000-000000000044', '31000000-0000-4000-8000-000000000044', 'home', 'for_sale', true, 'Sunny 4-bedroom house in Palmerston', 'A fictional 4-bedroom house created for SitePilot''s demo. The price and details are illustrative only and do not describe a real property.', 'house', 'NT', 'Palmerston', '0830', '[DEMO] 54 Example Lane', 4, 1, 1, 492, 720000, '$720,000', null, null, '{}'::text[], array['Quiet street', 'Second living area', 'Off-street parking'], 1628, '{"source":"SitePilot synthetic demo data","licence":"fictional, no third-party data","as_of":"2026-10-30","verification":"unverified"}', '2026-10-21'),
  ('30000000-0000-4000-8000-000000000045', '31000000-0000-4000-8000-000000000045', 'home', 'off_market', true, 'Alice Springs 2-bedroom townhouse with potential', 'A fictional townhouse shown to illustrate off-market screening. It is NOT FOR SALE, and nothing suggests the owner wants to sell.', 'townhouse', 'NT', 'Alice Springs', '0870', null, 2, 2, 2, 545, null, null, null, null, '{}'::text[], array['Big windows, lots of light', 'Covered deck', 'Low-maintenance garden'], 1665, '{"source":"SitePilot synthetic demo data","licence":"fictional, no third-party data","as_of":"2026-10-30","verification":"unverified"}', null),
  ('30000000-0000-4000-8000-000000000046', '31000000-0000-4000-8000-000000000046', 'investment', 'for_sale', true, 'Nightcliff 3-bedroom house: granny flat concept', 'A fictional 3-bedroom house created for SitePilot''s demo. The price and details are illustrative only and do not describe a real property.', 'house', 'NT', 'Nightcliff', '0810', '[DEMO] 56 Example Lane', 3, 1, 1, 598, 630000, '$630,000', 510, 'Granny flat concept: check council rules for secondary dwellings', array['Heritage controls may apply: check with council'], '{}'::text[], 1702, '{"source":"SitePilot synthetic demo data","licence":"fictional, no third-party data","as_of":"2026-10-30","verification":"unverified"}', '2026-10-27'),
  ('30000000-0000-4000-8000-000000000047', '31000000-0000-4000-8000-000000000047', 'investment', 'for_sale', true, 'Katherine 4-bedroom townhouse: renovate and rent', 'A fictional 4-bedroom townhouse created for SitePilot''s demo. The price and details are illustrative only and do not describe a real property.', 'townhouse', 'NT', 'Katherine', '0850', '[DEMO] 57 Example Lane', 4, 2, 2, 651, 720000, '$720,000', 620, 'Renovate and rent: kitchen and bathroom refresh', array['Tenanted: confirm lease terms'], '{}'::text[], 1739, '{"source":"SitePilot synthetic demo data","licence":"fictional, no third-party data","as_of":"2026-10-30","verification":"unverified"}', '2026-10-02'),
  ('30000000-0000-4000-8000-000000000048', '31000000-0000-4000-8000-000000000048', 'investment', 'off_market', true, 'Off-market potential: Stuart Park apartment', 'A fictional apartment shown to illustrate off-market screening. It is NOT FOR SALE, and nothing suggests the owner wants to sell.', 'apartment', 'NT', 'Stuart Park', '0820', null, 2, 1, 1, null, null, null, null, 'Renovate and rent: kitchen and bathroom refresh', array['Older wiring: building inspection advised'], '{}'::text[], 1776, '{"source":"SitePilot synthetic demo data","licence":"fictional, no third-party data","as_of":"2026-10-30","verification":"unverified"}', null);

insert into public.property_estimates (property_record_id, value_low, value_mid, value_high, rent_weekly_low, rent_weekly_mid, rent_weekly_high, confidence, source, as_of, is_demo) values
  ('31000000-0000-4000-8000-000000000001', 900000, 980000, 1060000, 580, 640, 700, 'low', 'SitePilot DEMO estimate (fictional)', '2026-10-30', true),
  ('31000000-0000-4000-8000-000000000002', 1045000, 1135000, 1225000, 730, 810, 890, 'medium', 'SitePilot DEMO estimate (fictional)', '2026-10-30', true),
  ('31000000-0000-4000-8000-000000000003', 1000000, 1085000, 1170000, 750, 830, 910, 'high', 'SitePilot DEMO estimate (fictional)', '2026-10-30', true),
  ('31000000-0000-4000-8000-000000000004', 900000, 980000, 1060000, 730, 810, 890, 'medium', 'SitePilot DEMO estimate (fictional)', '2026-10-30', true),
  ('31000000-0000-4000-8000-000000000005', 735000, 800000, 865000, null, null, null, 'low', 'SitePilot DEMO estimate (fictional)', '2026-10-30', true),
  ('31000000-0000-4000-8000-000000000006', 1175000, 1275000, 1375000, 1080, 1200, 1320, 'medium', 'SitePilot DEMO estimate (fictional)', '2026-10-30', true),
  ('31000000-0000-4000-8000-000000000007', 870000, 945000, 1020000, 680, 750, 830, 'high', 'SitePilot DEMO estimate (fictional)', '2026-10-30', true),
  ('31000000-0000-4000-8000-000000000008', 820000, 890000, 960000, 680, 750, 830, 'medium', 'SitePilot DEMO estimate (fictional)', '2026-10-30', true),
  ('31000000-0000-4000-8000-000000000009', 770000, 835000, 900000, 680, 750, 830, 'low', 'SitePilot DEMO estimate (fictional)', '2026-10-30', true),
  ('31000000-0000-4000-8000-000000000010', 610000, 665000, 720000, null, null, null, 'medium', 'SitePilot DEMO estimate (fictional)', '2026-10-30', true),
  ('31000000-0000-4000-8000-000000000011', 990000, 1075000, 1160000, 990, 1100, 1210, 'high', 'SitePilot DEMO estimate (fictional)', '2026-10-30', true),
  ('31000000-0000-4000-8000-000000000012', 745000, 810000, 875000, 780, 870, 960, 'medium', 'SitePilot DEMO estimate (fictional)', '2026-10-30', true),
  ('31000000-0000-4000-8000-000000000013', 720000, 785000, 850000, 650, 720, 790, 'low', 'SitePilot DEMO estimate (fictional)', '2026-10-30', true),
  ('31000000-0000-4000-8000-000000000014', 660000, 720000, 780000, 640, 710, 780, 'medium', 'SitePilot DEMO estimate (fictional)', '2026-10-30', true),
  ('31000000-0000-4000-8000-000000000015', 745000, 810000, 875000, 760, 840, 920, 'high', 'SitePilot DEMO estimate (fictional)', '2026-10-30', true),
  ('31000000-0000-4000-8000-000000000016', 875000, 950000, 1025000, 940, 1040, 1140, 'medium', 'SitePilot DEMO estimate (fictional)', '2026-10-30', true),
  ('31000000-0000-4000-8000-000000000017', 660000, 720000, 780000, 430, 480, 530, 'low', 'SitePilot DEMO estimate (fictional)', '2026-10-30', true),
  ('31000000-0000-4000-8000-000000000018', 700000, 760000, 820000, 500, 560, 620, 'medium', 'SitePilot DEMO estimate (fictional)', '2026-10-30', true),
  ('31000000-0000-4000-8000-000000000019', 620000, 675000, 730000, 640, 710, 780, 'high', 'SitePilot DEMO estimate (fictional)', '2026-10-30', true),
  ('31000000-0000-4000-8000-000000000020', 720000, 785000, 850000, 790, 880, 970, 'medium', 'SitePilot DEMO estimate (fictional)', '2026-10-30', true),
  ('31000000-0000-4000-8000-000000000021', 810000, 880000, 950000, 550, 610, 670, 'low', 'SitePilot DEMO estimate (fictional)', '2026-10-30', true),
  ('31000000-0000-4000-8000-000000000022', 620000, 675000, 730000, 460, 510, 560, 'medium', 'SitePilot DEMO estimate (fictional)', '2026-10-30', true),
  ('31000000-0000-4000-8000-000000000023', 655000, 710000, 765000, 510, 570, 630, 'high', 'SitePilot DEMO estimate (fictional)', '2026-10-30', true),
  ('31000000-0000-4000-8000-000000000024', 845000, 920000, 995000, 720, 800, 880, 'medium', 'SitePilot DEMO estimate (fictional)', '2026-10-30', true),
  ('31000000-0000-4000-8000-000000000025', 690000, 750000, 810000, 480, 530, 580, 'low', 'SitePilot DEMO estimate (fictional)', '2026-10-30', true),
  ('31000000-0000-4000-8000-000000000026', 785000, 855000, 925000, 590, 660, 730, 'medium', 'SitePilot DEMO estimate (fictional)', '2026-10-30', true),
  ('31000000-0000-4000-8000-000000000027', 595000, 645000, 695000, 480, 530, 580, 'high', 'SitePilot DEMO estimate (fictional)', '2026-10-30', true),
  ('31000000-0000-4000-8000-000000000028', 620000, 675000, 730000, 540, 600, 660, 'medium', 'SitePilot DEMO estimate (fictional)', '2026-10-30', true),
  ('31000000-0000-4000-8000-000000000029', 785000, 855000, 925000, 730, 810, 890, 'low', 'SitePilot DEMO estimate (fictional)', '2026-10-30', true),
  ('31000000-0000-4000-8000-000000000030', 440000, 480000, 520000, null, null, null, 'medium', 'SitePilot DEMO estimate (fictional)', '2026-10-30', true),
  ('31000000-0000-4000-8000-000000000031', 715000, 775000, 835000, 590, 660, 730, 'high', 'SitePilot DEMO estimate (fictional)', '2026-10-30', true),
  ('31000000-0000-4000-8000-000000000032', 535000, 580000, 625000, 470, 520, 570, 'medium', 'SitePilot DEMO estimate (fictional)', '2026-10-30', true),
  ('31000000-0000-4000-8000-000000000033', 635000, 690000, 745000, 590, 660, 730, 'low', 'SitePilot DEMO estimate (fictional)', '2026-10-30', true),
  ('31000000-0000-4000-8000-000000000034', 715000, 775000, 835000, 710, 790, 870, 'medium', 'SitePilot DEMO estimate (fictional)', '2026-10-30', true),
  ('31000000-0000-4000-8000-000000000035', 415000, 450000, 485000, null, null, null, 'high', 'SitePilot DEMO estimate (fictional)', '2026-10-30', true),
  ('31000000-0000-4000-8000-000000000036', 615000, 670000, 725000, 400, 440, 480, 'medium', 'SitePilot DEMO estimate (fictional)', '2026-10-30', true),
  ('31000000-0000-4000-8000-000000000037', 785000, 855000, 925000, 760, 840, 920, 'low', 'SitePilot DEMO estimate (fictional)', '2026-10-30', true),
  ('31000000-0000-4000-8000-000000000038', 910000, 990000, 1070000, 930, 1030, 1130, 'medium', 'SitePilot DEMO estimate (fictional)', '2026-10-30', true),
  ('31000000-0000-4000-8000-000000000039', 1070000, 1165000, 1260000, 1150, 1280, 1410, 'high', 'SitePilot DEMO estimate (fictional)', '2026-10-30', true),
  ('31000000-0000-4000-8000-000000000040', 605000, 655000, 705000, null, null, null, 'medium', 'SitePilot DEMO estimate (fictional)', '2026-10-30', true),
  ('31000000-0000-4000-8000-000000000041', 910000, 990000, 1070000, 650, 720, 790, 'low', 'SitePilot DEMO estimate (fictional)', '2026-10-30', true),
  ('31000000-0000-4000-8000-000000000042', 1040000, 1130000, 1220000, 800, 890, 980, 'medium', 'SitePilot DEMO estimate (fictional)', '2026-10-30', true),
  ('31000000-0000-4000-8000-000000000043', 580000, 630000, 680000, 630, 700, 770, 'high', 'SitePilot DEMO estimate (fictional)', '2026-10-30', true),
  ('31000000-0000-4000-8000-000000000044', 660000, 720000, 780000, 450, 500, 550, 'medium', 'SitePilot DEMO estimate (fictional)', '2026-10-30', true),
  ('31000000-0000-4000-8000-000000000045', 485000, 525000, 565000, 350, 390, 430, 'low', 'SitePilot DEMO estimate (fictional)', '2026-10-30', true),
  ('31000000-0000-4000-8000-000000000046', 580000, 630000, 680000, 460, 510, 560, 'medium', 'SitePilot DEMO estimate (fictional)', '2026-10-30', true),
  ('31000000-0000-4000-8000-000000000047', 660000, 720000, 780000, 560, 620, 680, 'high', 'SitePilot DEMO estimate (fictional)', '2026-10-30', true),
  ('31000000-0000-4000-8000-000000000048', 505000, 550000, 595000, 460, 510, 560, 'medium', 'SitePilot DEMO estimate (fictional)', '2026-10-30', true);
-- END GENERATED DEMO LISTINGS

-- ─── My Property (Blueprint v2.0 V2-3) ──────────────────────────────────────
insert into public.claim_verifiers (user_id) values ('b0000000-0000-4000-8000-000000000007');

-- Ivy owns the (fictional) Newcastle home behind the off-market demo listing n=3, has a verified
-- claim and accepts enquiries, so the buyer-enquiry flow can be demonstrated end to end.
insert into public.owned_properties (id, user_id, property_record_id, nickname, address, suburb, state, postcode, accepts_enquiries) values
  ('40000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000003',
   'Our place', '[DEMO] Ivy''s home', 'Newcastle', 'NSW', '2300', true);

insert into public.homeowner_claims (owned_property_id, claimant_id, status, method, decided_by, decided_at, decision_note) values
  ('40000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'verified', 'document',
   'b0000000-0000-4000-8000-000000000007', now(), 'Synthetic demo verification');

insert into public.maintenance_items (owned_property_id, title, due_on) values
  ('40000000-0000-4000-8000-000000000001', 'Clean gutters before storm season', current_date + 14),
  ('40000000-0000-4000-8000-000000000001', 'Test smoke alarms', current_date + 30);
