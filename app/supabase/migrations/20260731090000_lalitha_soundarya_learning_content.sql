-- Female-significant Learning-tab content, batch 1 of 2 (Devi Mahatmyam
-- follows separately as a chapter/PDF reader, not a flat verse list).
-- Content: app/scripts/content/lalitha-sahasranamam.json and
-- app/scripts/content/soundarya-lahari.json, uploaded to the
-- learning-content Storage bucket under those filenames.

update public.practices set has_learning_content = true where slug in ('lalitha-sahasranamam', 'soundarya-lahari');
