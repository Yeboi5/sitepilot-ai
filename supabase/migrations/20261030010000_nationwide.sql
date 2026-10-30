-- Master Blueprint v2.0 (V2-1): property workspaces cover every Australian state and territory.
--
-- Additive: existing NSW rows are unaffected and NSW stays the default. Postcode-in-state checks
-- live in the application (src/lib/jurisdictions.ts) because border postcodes make a strict
-- database rule unreliable.

alter table public.properties drop constraint properties_jurisdiction_check;
alter table public.properties
  add constraint properties_jurisdiction_check
  check (jurisdiction in ('NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'));

comment on column public.properties.jurisdiction is 'State or territory code (NSW, VIC, QLD, WA, SA, TAS, ACT, NT).';
