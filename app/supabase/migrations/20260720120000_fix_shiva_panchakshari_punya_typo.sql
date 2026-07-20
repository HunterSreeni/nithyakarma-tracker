-- 20260717090000_punya_weighting_and_streak_exempt_logs.sql intended to weight
-- shiva-panchakshari at punya_value = 8 alongside the other longer japams/parayanams,
-- but its slug list said 'shiva-panchakshari-japam' - that slug doesn't exist (the
-- real one, from the seed migration, is 'shiva-panchakshari'). The update silently
-- matched zero rows, leaving it at the default punya_value = 5 ever since.

update public.practices set punya_value = 8
  where slug = 'shiva-panchakshari' and punya_value = 5;
