-- S5: tier_for lost its search_path when recreated in 20260715130000_rename_tiers.sql
-- (flagged by the Supabase advisor as function_search_path_mutable). Re-add it.
create or replace function public.tier_for(p_punya int) returns text
language sql immutable set search_path = public as $$
  select case
    when p_punya >= 2500 then 'Brahmarishi'
    when p_punya >= 1000 then 'Rishi'
    when p_punya >= 400  then 'Yogi'
    when p_punya >= 100  then 'Sadhaka'
    else 'Shishya'
  end
$$;
