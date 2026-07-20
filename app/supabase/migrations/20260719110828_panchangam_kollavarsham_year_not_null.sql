-- All 365 rows backfilled and verified against scripts/panchangam-2026.json
-- (matching md5 over date|tamil|malayalam|varsham|kollavarsham), so the column
-- can now carry the same NOT NULL guarantee as every other panchangam field.
alter table public.panchangam_days
  alter column kollavarsham_year set not null;
