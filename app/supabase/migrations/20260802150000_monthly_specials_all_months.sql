-- monthly_specials had exactly one row (Karkidakam/Ramayana Masam), keyed only
-- by malayalam_month. Filling in the other 11 Malayalam months, and reshaping
-- the table to also hold Tamil-calendar rows (seeded by the follow-on
-- migration) - profiles.panchangam_tradition already lets a user pick
-- Tamil or Malayalam (see PanchangamBox.jsx), but MonthlySpecialBanner
-- ignored it and always showed the Malayalam row regardless of that
-- preference. malayalam_month -> (calendar, month): calendar is
-- 'tamil'|'malayalam', month is the month name in that calendar. The
-- existing Karkidakam row becomes calendar='malayalam'.
--
-- Most months don't have an existing tracked practice/reading page to link
-- to (unlike Karkidakam->Ramayanam or Kanni->Devi Mahatmyam), so route
-- becomes nullable - MonthlySpecialBanner renders those as an info-only
-- banner with no link.
alter table public.monthly_specials add column calendar text;
update public.monthly_specials set calendar = 'malayalam';
alter table public.monthly_specials alter column calendar set not null;
alter table public.monthly_specials add constraint monthly_specials_calendar_check
  check (calendar in ('tamil', 'malayalam'));

alter table public.monthly_specials rename column malayalam_month to month;
alter table public.monthly_specials drop constraint monthly_specials_pkey;
alter table public.monthly_specials add primary key (calendar, month);

alter table public.monthly_specials alter column route drop not null;

insert into public.monthly_specials (calendar, month, title, subtitle, route) values
  ('malayalam', 'Chingam', 'Malayalam New Year',
   'Chingam 1 marks the Kollavarsham new year, and Onam (Thiruvonam) falls later this month.',
   null),
  ('malayalam', 'Kanni', 'Navaratri',
   'Nine nights of Devi worship, ending in Vijayadashami - a fitting month to read Devi Mahatmyam, Lalitha Sahasranamam or Soundarya Lahari.',
   '/learning/devi-mahatmyam'),
  ('malayalam', 'Thulam', 'Thulam',
   'A month of temple festivals and Thulapooja, when offerings are weighed against gold or grain.',
   null),
  ('malayalam', 'Vrischikam', 'Mandala Kalam Begins',
   'The 41-day Ayyappa vratham starts this month, leading up to the Sabarimala pilgrimage season.',
   null),
  ('malayalam', 'Dhanu', 'Thiruvathira',
   'Dhanu masam''s Thiruvathira is traditionally observed by women with a day-long vratham for marital wellbeing.',
   null),
  ('malayalam', 'Makaram', 'Makara Sankranti',
   'Makara Sankranti marks Uttarayana and the culmination of the Sabarimala pilgrimage season with Makara Vilakku.',
   null),
  ('malayalam', 'Kumbham', 'Maha Sivarathri',
   'Kumbham often carries Maha Sivarathri, a night of fasting and vigil for Shiva.',
   null),
  ('malayalam', 'Meenam', 'Meenam',
   'Known for the Kodungallur Bharani festival and the start of the temple pooram season.',
   null),
  ('malayalam', 'Medam', 'Vishu',
   'Medam 1 is Vishu, the Malayalam solar new year, marked with the Vishu Kani at dawn.',
   null),
  ('malayalam', 'Edavam', 'Edavappathy',
   'The traditional start of the monsoon and the paddy-sowing season in Kerala.',
   null),
  ('malayalam', 'Mithunam', 'Mithunam',
   'A quiet monsoon month of preparation, ahead of Karkidakam''s Ramayana reading.',
   null);
