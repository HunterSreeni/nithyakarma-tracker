-- Sundara Kandam's Learning entry now covers the whole Ramayanam (6
-- kandams: Bala, Ayodhya, Aranya, Kishkindha, Sundara, Yuddha - see
-- src/utils/ramayanam.js), read via a kandam picker (RamayanamPage) then a
-- per-sarga PDF reader (KandamPage), rather than a dedicated per-kandam
-- practice row each. One practice row for the whole thing, as before -
-- affects_streak stays false, this is read-only reference content.
update public.practices
set slug = 'ramayanam', name = 'Ramayanam', icon = '🏹'
where slug = 'ramayana-sundara-kandam';
