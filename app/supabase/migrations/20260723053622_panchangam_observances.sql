-- Calendar-driven tharpanam and auspicious-day ("observance") notifications.
-- A small static rule table, not per-date rows: every occasion reduces to a
-- pattern against a panchangam_days row (thithi/month/day/nakshatra), so this
-- table never needs annual regeneration the way panchangam_days does.
--
-- day_offset lets a rule match against a NEIGHBORING day's row instead of the
-- candidate day's own row. Needed for Maha Sivarathri: the printed Pambu
-- Panchangam attributes the observance to the Krishna Trayodashi calendar day
-- (the night that carries Chaturdashi tithi), not the noon-sampled Chaturdashi
-- day itself - a day_offset of 1 means "check tomorrow's row for this match,
-- fire on today if it matches" (see docs/architecture/08-PANCHANGAM.md known
-- limitation #2, solar-noon sampling doesn't capture evening tithi changes).
create table public.panchangam_observances (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  category text not null check (category in ('tharpanam', 'observance')),
  title text not null,
  message text not null,
  match_thithi text,
  match_tamil_month text,
  match_tamil_day int,
  match_malayalam_month text,
  match_malayalam_day int,
  match_nakshatra text,
  day_offset int not null default 0,
  priority int not null default 0
);

alter table public.panchangam_observances enable row level security;

create policy "panchangam observances readable" on public.panchangam_observances
  for select to authenticated using (true);

grant select on public.panchangam_observances to authenticated;

insert into public.panchangam_observances
  (key, category, title, message, match_thithi, match_tamil_month, match_tamil_day, match_malayalam_month, match_malayalam_day, match_nakshatra, day_offset, priority)
values
  ('monthly_amavasya', 'tharpanam', 'Amavasya Tharpanam',
   'Today is Amavasya - a day for ancestor tharpanam.',
   'Amavasya', null, null, null, null, null, 0, 0),
  ('karkidaka_vaavu', 'tharpanam', 'Karkidaka Vaavu',
   'Karkidaka Vaavu today - a especially significant day for ancestor tharpanam in the Malayalam calendar.',
   'Amavasya', null, null, 'Karkidakam', null, null, 0, 10),
  ('makara_sankranti_tharpanam', 'tharpanam', 'Uttarayana Punyakalam',
   'Makara Sankranti (Pongal) - Uttarayana Punyakalam, a traditional day for tharpanam.',
   null, 'Thai', 1, null, null, null, 0, 5),
  ('karkataka_sankranti_tharpanam', 'tharpanam', 'Dakshinayana Punyakalam',
   'Karkataka Sankranti - Dakshinayana Punyakalam, a traditional day for tharpanam.',
   null, 'Aadi', 1, null, null, null, 0, 5),
  ('pongal', 'observance', 'Pongal',
   'Happy Pongal! Uttarayana begins today.',
   null, 'Thai', 1, null, null, null, 0, 0),
  ('tamil_new_year', 'observance', 'Tamil New Year',
   'Puthandu Vazhthukal! The Tamil New Year begins today.',
   null, 'Chithirai', 1, null, null, null, 0, 0),
  ('vishu', 'observance', 'Vishu',
   'Vishu ashamsakal! The Malayalam solar new year begins today.',
   null, null, null, 'Medam', 1, null, 0, 0),
  ('onam_thiruvonam', 'observance', 'Onam (Thiruvonam)',
   'Onam ashamsakal! Today is Thiruvonam.',
   null, null, null, 'Chingam', null, 'Shravana', 0, 0),
  ('maha_sivarathri_makaram', 'observance', 'Maha Sivarathri',
   'Maha Sivarathri is tonight.',
   'Krishna Chaturdashi', null, null, 'Makaram', null, null, 1, 0),
  ('maha_sivarathri_kumbham', 'observance', 'Maha Sivarathri',
   'Maha Sivarathri is tonight.',
   'Krishna Chaturdashi', null, null, 'Kumbham', null, null, 1, 0);

alter table public.notification_preferences
  add column tharpanam_enabled boolean not null default false,
  add column observances_enabled boolean not null default false;

alter table public.notification_deliveries
  drop constraint notification_deliveries_slot_check;

alter table public.notification_deliveries
  add constraint notification_deliveries_slot_check
  check (slot = any (array['morning'::text, 'afternoon'::text, 'evening'::text, 'nudge'::text, 'nudge_morning'::text, 'tharpanam'::text, 'observance'::text]));
