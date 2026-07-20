-- General "monthly special" framework - a data-driven nudge shown on the
-- Today page for a given Malayalam month, without needing new frontend code
-- to add a future month's special later. First (and currently only) row:
-- Karkidakam / Ramayana Masam.

create table public.monthly_specials (
  malayalam_month text primary key,
  title text not null,
  subtitle text not null,
  route text not null
);

alter table public.monthly_specials enable row level security;

create policy "monthly specials readable" on public.monthly_specials
  for select to authenticated using (true);

grant select on public.monthly_specials to authenticated;

insert into public.monthly_specials (malayalam_month, title, subtitle, route) values
  ('Karkidakam', 'Ramayana Masam',
   'Karkidakam is traditionally the month for reading the Ramayana in Kerala.',
   '/ramayana-masam');
