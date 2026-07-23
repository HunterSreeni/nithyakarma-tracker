-- Sai Baba Aarti ("Aarti Sai Baba, saukhyadaataara jeeva") - the Madhyaanha
-- (mid-day) aarti composed 1903-04 by Madhavrao Adkar, a contemporary
-- devotee of Sai Baba of Shirdi. Thursday (Guruvar) is Sai Baba's day - the
-- aarti itself names this ("Aattan divasaan guruwaaree bhakta karitee
-- waaree" - "on Thursdays every week, devotees make the trip [to Shirdi]"),
-- same pattern as the existing Dakshinamurthy Stotram weekly practice.
-- has_learning_content mirrors hanuman-chalisa/vishnu-sahasranamam - the
-- matching verse JSON is uploaded separately to the learning-content
-- Storage bucket as sai-baba-aarti.json (not something a SQL migration can
-- do - Storage objects live outside Postgres).
insert into public.practices (slug, name, icon, cadence, weekday, is_sandhyavandhanam, punya_value, affects_streak, has_learning_content)
values ('sai-baba-aarti', 'Sai Baba Aarti', '🪔', 'weekly', 4, false, 5, true, true);
