-- Rename the two least-recognizable tier names. Same thresholds, same
-- ascending arc (student -> practitioner -> yogi -> sage -> supreme sage),
-- just swapping Jijnasu -> Shishya and Tapasvi -> Yogi for terms a general
-- audience actually recognizes. Sadhaka/Rishi/Brahmarishi are unchanged.
create or replace function public.tier_for(p_punya int) returns text
language sql immutable as $$
  select case
    when p_punya >= 2500 then 'Brahmarishi'
    when p_punya >= 1000 then 'Rishi'
    when p_punya >= 400  then 'Yogi'
    when p_punya >= 100  then 'Sadhaka'
    else 'Shishya'
  end
$$;
