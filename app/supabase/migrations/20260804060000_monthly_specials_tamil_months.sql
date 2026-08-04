-- Tamil-calendar counterpart to the Malayalam rows seeded in
-- 20260802150000_monthly_specials_all_months. profiles.panchangam_tradition
-- defaults to 'tamil' - most users see the Tamil calendar, not the
-- Malayalam one - so these fill a real gap, not a nice-to-have.
-- MonthlySpecialBanner.jsx now branches on panchangam_tradition to query
-- ('tamil', day.tamil_month) or ('malayalam', day.malayalam_month),
-- mirroring the branch PanchangamBox.jsx already uses for the panchangam
-- info box. Month spellings verified against the distinct tamil_month
-- values actually loaded in panchangam_days (e.g. 'Karthikai', not
-- 'Karthigai') - the prior Malayalam seed had exactly this class of bug
-- ('Midhunam' vs the real 'Mithunam'), caught and fixed before this file
-- was written.
--
-- No existing tracked practice/reading page ties naturally to any of these
-- (unlike Kanni->Devi Mahatmyam), so route is null throughout - all render
-- as info-only banners, same as most of the Malayalam set.
insert into public.monthly_specials (calendar, month, title, subtitle, route) values
  ('tamil', 'Chithirai', 'Puthandu',
   'Chithirai 1 is Puthandu, the Tamil New Year, and Madurai''s Chithirai Thiruvizha temple festival runs through the month.',
   null),
  ('tamil', 'Vaikasi', 'Vaikasi Visakam',
   'Murugan''s birth star day, widely celebrated at Palani and Tiruchendur.',
   null),
  ('tamil', 'Aani', 'Aani Thirumanjanam',
   'Chidambaram''s ten-day Aani Thirumanjanam festival for Nataraja falls this month.',
   null),
  ('tamil', 'Aadi', 'Aadi Perukku',
   'Aadi Perukku, the river-worship festival on Aadi''s 18th day, and the month''s Fridays (Aadi Velli) are given to Amman worship.',
   null),
  ('tamil', 'Aavani', 'Avani Avittam',
   'Upakarma, the sacred-thread renewal, falls this month, alongside Krishna Janmashtami and Vinayaka Chaturthi.',
   null),
  ('tamil', 'Purattasi', 'Purattasi Sani',
   'A month held auspicious for Vishnu worship, with Saturdays (Purattasi Sani) especially significant at Perumal temples.',
   null),
  ('tamil', 'Aippasi', 'Aippasi Vishakam',
   'Skanda Sashti and Aippasi Vishakam fall this month, alongside Deepavali most years.',
   null),
  ('tamil', 'Karthikai', 'Karthigai Deepam',
   'Karthigai Deepam, the festival of lights, is marked with a great beacon lit atop Tiruvannamalai''s hill.',
   null),
  ('tamil', 'Margazhi', 'Margazhi',
   'The most sacred Tamil month - Thiruppavai is recited at dawn, and Vaikunta Ekadashi and Arudra Darisanam both fall within it.',
   null),
  ('tamil', 'Thai', 'Thai Pongal',
   'Thai Pongal opens the month, and Thaipusam follows - as the proverb goes, "Thai pirandhal vazhi pirakkum" (when Thai is born, a way opens).',
   null),
  ('tamil', 'Maasi', 'Maasi Magam',
   'Maasi Magam, when temple deities take a ceremonial dip, is widely observed - and Maha Sivarathri often falls in this month too.',
   null),
  ('tamil', 'Panguni', 'Panguni Uthiram',
   'Panguni Uthiram, marking several divine weddings including Murugan and Deivanai, is celebrated across Tamil Nadu.',
   null);
