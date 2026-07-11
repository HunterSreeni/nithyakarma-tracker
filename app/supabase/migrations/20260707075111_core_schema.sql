-- Profiles: one per auth user. Created at onboarding (client supplies gender).
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  gender text not null check (gender in ('male','female')),
  referral_code text unique not null default substr(md5(gen_random_uuid()::text), 1, 8),
  referred_by uuid references public.profiles(id),
  ad_free_until date,
  reminder_times jsonb not null default '{"morning":"09:00","afternoon":"12:30","evening":"18:30"}'::jsonb,
  punya int not null default 0,
  current_streak int not null default 0,
  best_streak int not null default 0,
  last_complete_date date,
  created_at timestamptz not null default now()
);

-- Children under 15, managed by parent, no logins.
create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  gender text not null check (gender in ('male','female')),
  upanayanam_done boolean not null default false,
  bala_sabha_opt_in boolean not null default false,
  punya int not null default 0,
  current_streak int not null default 0,
  best_streak int not null default 0,
  last_complete_date date,
  created_at timestamptz not null default now()
);

-- Practice catalog (admin-extendable without app updates).
create table public.practices (
  id serial primary key,
  slug text unique not null,
  name text not null,
  icon text not null default '🕉️',
  cadence text not null check (cadence in ('daily','daily_count','weekly','sequence')),
  weekday int check (weekday between 0 and 6), -- 0=Sunday, weekly only
  target_count int,      -- daily_count (e.g. 108)
  sequence_length int,   -- sequence cycle length (null = open-ended)
  is_sandhyavandhanam boolean not null default false,
  active boolean not null default true
);

-- Association: which subject (self or family member) tracks which practice.
create table public.user_practices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  family_member_id uuid references public.family_members(id) on delete cascade, -- null = self
  practice_id int not null references public.practices(id),
  current_streak int not null default 0,
  best_streak int not null default 0,
  last_log_date date,
  sequence_position int not null default 0,
  created_at timestamptz not null default now()
);
create unique index user_practices_unique
  on public.user_practices (owner_id, coalesce(family_member_id, '00000000-0000-0000-0000-000000000000'::uuid), practice_id);

create table public.practice_logs (
  id uuid primary key default gen_random_uuid(),
  user_practice_id uuid not null references public.user_practices(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  log_date date not null default current_date,
  slot text check (slot in ('morning','afternoon','evening')), -- sandhyavandhanam only
  count int,
  sequence_position int,
  created_at timestamptz not null default now()
);
create unique index practice_logs_unique
  on public.practice_logs (user_practice_id, log_date, coalesce(slot, 'day'));
create index practice_logs_date on public.practice_logs (log_date);

-- Referral grants: 1 ad-free month to both parties.
create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_id uuid not null unique references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.profiles enable row level security;
alter table public.family_members enable row level security;
alter table public.practices enable row level security;
alter table public.user_practices enable row level security;
alter table public.practice_logs enable row level security;
alter table public.referrals enable row level security;

create policy "own profile select" on public.profiles for select using (id = auth.uid());
create policy "own profile insert" on public.profiles for insert with check (id = auth.uid());
create policy "own profile update" on public.profiles for update using (id = auth.uid());
create policy "own profile delete" on public.profiles for delete using (id = auth.uid());

create policy "own family all" on public.family_members for all
  using (parent_id = auth.uid()) with check (parent_id = auth.uid());

create policy "catalog readable" on public.practices for select to authenticated using (active);

create policy "own user_practices all" on public.user_practices for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "own logs select" on public.practice_logs for select using (owner_id = auth.uid());
create policy "own logs delete" on public.practice_logs for delete using (owner_id = auth.uid());
-- inserts go through the submit_practice_log RPC (security definer)

create policy "own referrals select" on public.referrals for select
  using (referrer_id = auth.uid() or referred_id = auth.uid());