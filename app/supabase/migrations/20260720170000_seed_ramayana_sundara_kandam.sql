-- Third Learning-tab practice: originally just a Sundara Kandam reader,
-- later renamed/repurposed to cover the whole Ramayanam (see the
-- rename_sundara_kandam_to_ramayanam migration) - kept as one practice row
-- rather than one per kandam. Content isn't verse JSON like the other two
-- Learning practices but PDF pages (Sanskrit + Malayalam, downloaded via
-- app/scripts/download-ramayanam-pdfs.cjs and uploaded to the
-- learning-content Storage bucket out-of-band). Read-only reference content
-- - affects_streak = false so it can neither advance nor block anyone's
-- streak (matching hanuman-chalisa; unlike vishnu-sahasranamam, which was
-- left at the affects_streak default of true).
insert into public.practices (slug, name, icon, cadence, is_sandhyavandhanam, affects_streak)
values ('ramayana-sundara-kandam', 'Sundara Kandam', '🐒', 'daily', false, false);

update public.practices set has_learning_content = true where slug = 'ramayana-sundara-kandam';
