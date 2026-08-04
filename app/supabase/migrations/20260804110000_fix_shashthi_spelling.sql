-- 'Shashthi' was the wrong English spelling for the 6th thithi (षष्ठी) -
-- the actual transliteration ends in "-ti", not "-thi": Sashti. Fixes both
-- the precomputed panchangam_days rows (48: 24 Krishna + 24 Shukla, matching
-- scripts/panchangam-2026.json and -2027.json, also corrected) and the
-- skanda_sashti observance rule's match_thithi, which must stay byte-identical
-- to what panchangam_days stores or the rule stops matching. The observance's
-- own key ('skanda_sashti') was already spelled correctly - only the
-- match_thithi value had the bug. scripts/generate-panchangam.cjs and
-- src/utils/panchangamScript.js (TAMIL_TITHI_SCRIPT / MALAYALAM_TITHI_SCRIPT
-- lookup keys) were also corrected in the same commit, so all four places
-- agree going forward.
update public.panchangam_days
set thithi = replace(thithi, 'Shashthi', 'Sashti')
where thithi like '%Shashthi%';

update public.panchangam_observances
set match_thithi = 'Shukla Sashti'
where key = 'skanda_sashti' and match_thithi = 'Shukla Shashthi';
