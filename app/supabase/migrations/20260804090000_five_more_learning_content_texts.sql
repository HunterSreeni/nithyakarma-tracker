-- Adds Learning-tab reading content for 5 of the practices that had none:
-- Dakshinamurthy Stotram (10 verses), Aditya Hrudayam (31 verses),
-- Subrahmanya Bhujangam (33 verses), Mukundamala (40 verses), Sri Rudram
-- Namakam+Chamakam (22 anuvakas, 164 mantras). Matching verse JSON is
-- uploaded separately to the learning-content Storage bucket, keyed by
-- practice slug ({slug}.json) - same pattern as sai-baba-aarti (see
-- 20260723190000). Samidhadhanam and the three larger texts (Sandhyavandhanam,
-- Bhagavad Gita, Narayaneeyam, Bhagavatam) are deliberately not included here -
-- Samidhadhanam has no single clean canonical source the way these five do,
-- the others were explicitly scoped out as a later batch (larger PDF-style
-- content, not flat JSON).
update public.practices set has_learning_content = true
where slug in (
  'dakshinamurthy-stotram',
  'aditya-hrudayam',
  'subrahmanya-bhujangam',
  'mukundamala',
  'sri-rudram'
);
