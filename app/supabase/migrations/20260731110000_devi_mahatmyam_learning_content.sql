-- Female-significant Learning-tab content, batch 2 of 2 (Lalitha Sahasranamam
-- and Soundarya Lahari shipped separately as flat-list readers).
-- Content: 39 chapter PDFs (13 chapters x english/malayalam/tamil) under
-- app/scripts/content/devimahatmyam-pdfs/{chapter}/{language}.pdf, uploaded
-- to the learning-content Storage bucket as devimahatmyam-pdfs/... Sanskrit
-- is not yet included - no genuine full-text Devanagari edition was found.

update public.practices set has_learning_content = true where slug = 'devi-mahatmyam';
