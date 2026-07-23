-- More auspicious-day rules, verified against loaded panchangam_days (2026)
-- against external cited sources before seeding:
--
--   Krishna Janmashtami  4 Sep 2026: our Krishna Ashtami row lands exactly on
--     that date (Chingam 19) - no offset needed.
--   Vinayaka Chaturthi   14 Sep 2026: Shukla Chaturthi row lands exactly on
--     that date (Chingam 29) - no offset needed.
--   Vijayadashami        20 Oct 2026 per source, but our noon-sampled Shukla
--     Dashami row lands on 21 Oct (Aippasi 4) - the tithi begins in the
--     evening of the 20th, same class of issue as Maha Sivarathri. day_offset
--     = +1 (tomorrow's row must be Dashami) correctly reproduces 20 Oct.
--   Naraka Chaturdashi   8 Nov 2026 per source (Choti Diwali / Deepavali),
--     but our noon-sampled Krishna Chaturdashi row lands on 7 Nov (Aippasi
--     21). This is a pre-dawn observance (Abhyanga Snanam before sunrise),
--     the OPPOSITE direction from Sivarathri: the tithi is still active at
--     dawn on the 8th even though noon-sample has already rolled to Amavasya
--     by then. day_offset = -1 (yesterday's row must be Chaturdashi)
--     correctly reproduces 8 Nov - this is why day_offset now supports
--     negative values, see send-reminders/index.ts's 3-day fetch window.
--   Karthigai Deepam     24 Nov 2026 per source: matched the same way as Onam
--     (month + nakshatra, not thithi) - Krittika nakshatra in Karthikai
--     lands exactly on 24 Nov, Purnima the same day (coincidental, not relied
--     on).
--   Skanda Sashti        no offset needed - Shukla Shashti falls within
--     Aippasi at 15 Nov 2026 directly from the computation, the same
--     thithi+month pattern already used for Vinayaka Chaturthi/Janmashtami,
--     not a boundary-crossing case requiring external verification.
insert into public.panchangam_observances
  (key, category, title, message, match_thithi, match_tamil_month, match_tamil_day, match_malayalam_month, match_malayalam_day, match_nakshatra, day_offset, priority)
values
  ('krishna_janmashtami', 'observance', 'Krishna Janmashtami',
   'Krishna Janmashtami today - Lord Krishna''s birthday.',
   'Krishna Ashtami', null, null, 'Chingam', null, null, 0, 0),
  ('vinayaka_chaturthi', 'observance', 'Vinayaka Chaturthi',
   'Vinayaka Chaturthi today.',
   'Shukla Chaturthi', null, null, 'Chingam', null, null, 0, 0),
  ('vijayadashami', 'observance', 'Vijayadashami',
   'Vijayadashami (Dussehra) today - the culmination of Navaratri.',
   'Shukla Dashami', 'Aippasi', null, null, null, null, 1, 0),
  ('naraka_chaturdashi', 'observance', 'Naraka Chaturdashi (Deepavali)',
   'Naraka Chaturdashi today - Deepavali begins.',
   'Krishna Chaturdashi', 'Aippasi', null, null, null, null, -1, 0),
  ('karthigai_deepam', 'observance', 'Karthigai Deepam',
   'Karthigai Deepam today.',
   null, 'Karthikai', null, null, null, 'Krittika', 0, 0),
  ('skanda_sashti', 'observance', 'Skanda Sashti',
   'Skanda Sashti (Soorasamharam) today.',
   'Shukla Shashthi', 'Aippasi', null, null, null, null, 0, 0);
