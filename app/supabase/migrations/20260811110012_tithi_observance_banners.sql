-- Ekadashi/Dwadashi/Trayodashi/Purnima same-day observance banners.
-- Requested 2026-08-11: these 4 tithis were completely silent (no banner, no
-- push) despite the panchangam box already naming them correctly - only
-- Amavasya (via monthly_amavasya) triggered anything. Wording is identical
-- for both traditions on purpose, unlike the panchangam box's own
-- Tamil/Malayalam split.
--
-- advance_notify = false on all 7, matching the monthly_amavasya precedent:
-- Ekadashi/Dwadashi/Trayodashi each recur ~24x/year (twice per lunar month,
-- once per paksha) and Purnima ~12x/year, too routine for a 3-day-advance
-- push.
--
-- No generic Amavasya row is added here - it already has its own,
-- more-specific monthly_amavasya/karkidaka_vaavu tharpanam messaging, and a
-- second "Amavasya today" observance banner alongside it would be redundant.
--
-- The Purnima row's priority (-1) is deliberately BELOW avani_avittam's
-- (0, from the 2026-08-02 migration): both match on Purnima, but
-- avani_avittam also requires Shravana nakshatra, so on the one day a year
-- they coincide, bestMatch() must keep favouring the more specific occasion
-- over this generic "Purnima today" banner.
insert into public.panchangam_observances
  (key, category, title, message, match_thithi, match_tamil_month, match_tamil_day, match_malayalam_month, match_malayalam_day, match_nakshatra, day_offset, priority, advance_notify)
values
  ('shukla_ekadashi', 'observance', 'Ekadashi',
   'Today is Ekadashi - a day of fasting (vratam) for Vishnu.',
   'Shukla Ekadashi', null, null, null, null, null, 0, 0, false),
  ('krishna_ekadashi', 'observance', 'Ekadashi',
   'Today is Ekadashi - a day of fasting (vratam) for Vishnu.',
   'Krishna Ekadashi', null, null, null, null, null, 0, 0, false),
  ('shukla_dwadashi', 'observance', 'Dwadashi',
   'Today is Dwadashi - the day to break yesterday''s Ekadashi fast (Parana), also auspicious for Vishnu.',
   'Shukla Dwadashi', null, null, null, null, null, 0, 0, false),
  ('krishna_dwadashi', 'observance', 'Dwadashi',
   'Today is Dwadashi - the day to break yesterday''s Ekadashi fast (Parana), also auspicious for Vishnu.',
   'Krishna Dwadashi', null, null, null, null, null, 0, 0, false),
  ('shukla_trayodashi', 'observance', 'Trayodashi (Pradosham)',
   'Today is Trayodashi - Pradosham, the evening twilight period for Shiva worship.',
   'Shukla Trayodashi', null, null, null, null, null, 0, 0, false),
  ('krishna_trayodashi', 'observance', 'Trayodashi (Pradosham)',
   'Today is Trayodashi - Pradosham, the evening twilight period for Shiva worship.',
   'Krishna Trayodashi', null, null, null, null, null, 0, 0, false),
  ('monthly_purnima', 'observance', 'Purnima',
   'Today is Purnima - the full moon day.',
   'Purnima', null, null, null, null, null, 0, -1, false);
