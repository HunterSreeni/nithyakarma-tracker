-- Community/Sabha (the social leaderboard) becomes opt-in rather than
-- default-on - comparing streaks/punya with others doesn't sit right with
-- everyone's practice, so it's hidden until a user chooses to unhide it.
-- Referrals lives on its own always-visible tab (unrelated to this flag).
alter table public.profiles add column if not exists community_enabled boolean not null default false;
