-- Today-page panchangam info box (Intent 2.7). Precomputed once (see
-- scripts/generate-panchangam.js), not calculated live per request - matches
-- the real-world publishing cadence (a full year's panchangam is fixed once
-- published). Best-effort v1 (drik ganita, Lahiri ayanamsa, South Indian
-- solar convention, Kochi reference location) - needs a manual validation
-- pass against a real Pambu Panchangam before being treated as authoritative.
create table public.panchangam_days (
  date date primary key,
  thithi text not null,
  nakshatra text not null,
  rahu_kalam_start text not null,
  rahu_kalam_end text not null,
  yamagandam_start text not null,
  yamagandam_end text not null,
  gulika_kalam_start text not null,
  gulika_kalam_end text not null,
  tamil_month text not null,
  tamil_day int not null,
  malayalam_month text not null,
  malayalam_day int not null,
  varsham_name text not null
);

alter table public.panchangam_days enable row level security;

-- Same data for every user (not owner-scoped) - any authenticated user may read.
create policy "panchangam readable" on public.panchangam_days for select
  to authenticated using (true);
