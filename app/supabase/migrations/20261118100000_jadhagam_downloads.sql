-- Jadhagam downloads (authorized by Sreeni, 2026-11-18): one free download per
-- calendar month (in the user's own timezone), across both the chart image and
-- the full PDF. After that, each download needs a rewarded video whose completion
-- Google confirms server-side (AdMob SSV -> edge function admob-ssv). Users with
-- a future ad_free_until (referral reward) download free, without using the
-- monthly free one.
--
-- AI-DEV NOTE: birth details never reach the server. These tables hold only
-- "who downloaded which kind, when, and how it was paid for". Clients have no
-- table access at all; everything goes through the security definer functions
-- below. Both tables cascade on auth.users delete (AGENTS.md "Account deletion").

create table public.jadhagam_reward_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'verified', 'used')),
  -- AdMob's transaction id; unique so a replayed callback can never verify twice.
  transaction_id text unique,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  used_at timestamptz
);
create index jadhagam_reward_grants_user_idx on public.jadhagam_reward_grants (user_id, status);

create table public.jadhagam_downloads (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('jpg', 'pdf')),
  via text not null check (via in ('free', 'rewarded', 'adfree')),
  grant_id uuid references public.jadhagam_reward_grants(id) on delete set null,
  created_at timestamptz not null default now()
);
create index jadhagam_downloads_user_idx on public.jadhagam_downloads (user_id, created_at);

alter table public.jadhagam_reward_grants enable row level security;
alter table public.jadhagam_downloads enable row level security;
revoke all on public.jadhagam_reward_grants, public.jadhagam_downloads from anon, authenticated;
-- Edge functions read/write with service_role, which needs explicit grants
-- (memory edge-fn-service-role-grants: without them the function silently sees nothing).
grant select, insert, update, delete on public.jadhagam_reward_grants, public.jadhagam_downloads to service_role;

-- Start of the caller's current month and today's date, in their timezone.
create or replace function public.jadhagam_month_bounds(p_user uuid)
returns table (month_start timestamptz, local_today date)
language sql stable security definer set search_path = public as $$
  select date_trunc('month', now() at time zone tz) at time zone tz,
         (now() at time zone tz)::date
  from (select coalesce((select timezone from profiles where id = p_user), 'Asia/Kolkata') as tz) t
$$;
revoke all on function public.jadhagam_month_bounds(uuid) from public, anon, authenticated;

-- What the download card shows: ad-free?, is this month's free one left?,
-- verified videos not yet used, and when the next free one comes.
create or replace function public.jadhagam_download_status()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_start timestamptz; v_today date; v_ad_free date;
begin
  if v_uid is null then raise exception 'Not signed in'; end if;
  select month_start, local_today into v_start, v_today from jadhagam_month_bounds(v_uid);
  select ad_free_until into v_ad_free from profiles where id = v_uid;
  return jsonb_build_object(
    'ad_free', v_ad_free is not null and v_ad_free >= v_today,
    'ad_free_until', v_ad_free,
    'free_left', case when exists (
        select 1 from jadhagam_downloads
        where user_id = v_uid and via = 'free' and created_at >= v_start) then 0 else 1 end,
    'video_credits', (select count(*) from jadhagam_reward_grants where user_id = v_uid and status = 'verified'),
    'next_free', (date_trunc('month', v_today) + interval '1 month')::date
  );
end $$;

-- A pending grant whose id travels as the rewarded ad's SSV custom_data. Only
-- Google's signed callback (edge function admob-ssv) can turn it into 'verified',
-- and only within a day of creation. Pending grants older than that are deleted
-- here, so abandoned ad attempts never pile up.
create or replace function public.start_jadhagam_reward()
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_id uuid;
begin
  if v_uid is null then raise exception 'Not signed in'; end if;
  -- Same per-user lock as claims, so concurrent calls cannot race past the limit.
  perform pg_advisory_xact_lock(hashtextextended('jadhagam_download:' || v_uid::text, 0));
  delete from jadhagam_reward_grants
   where user_id = v_uid and status = 'pending' and created_at < now() - interval '1 day';
  -- Bound the pending rows one account can hold (each is one ad request).
  if (select count(*) from jadhagam_reward_grants where user_id = v_uid and status = 'pending') >= 30 then
    raise exception 'Too many video requests today - try again tomorrow';
  end if;
  insert into jadhagam_reward_grants (user_id) values (v_uid) returning id into v_id;
  return v_id;
end $$;

-- Record one download. Called after the file is built, so a failed build never
-- uses up the free download. Order: ad-free, then this month's free one, then the
-- oldest verified video. Serialized per user so two taps cannot both get the free one.
create or replace function public.claim_jadhagam_download(p_kind text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_start timestamptz; v_today date; v_grant uuid;
begin
  if v_uid is null then raise exception 'Not signed in'; end if;
  if p_kind not in ('jpg', 'pdf') then raise exception 'Unknown download kind'; end if;
  perform pg_advisory_xact_lock(hashtextextended('jadhagam_download:' || v_uid::text, 0));
  select month_start, local_today into v_start, v_today from jadhagam_month_bounds(v_uid);

  if exists (select 1 from profiles where id = v_uid and ad_free_until >= v_today) then
    insert into jadhagam_downloads (user_id, kind, via) values (v_uid, p_kind, 'adfree');
    return jsonb_build_object('allowed', true, 'via', 'adfree');
  end if;

  if not exists (select 1 from jadhagam_downloads
                 where user_id = v_uid and via = 'free' and created_at >= v_start) then
    insert into jadhagam_downloads (user_id, kind, via) values (v_uid, p_kind, 'free');
    return jsonb_build_object('allowed', true, 'via', 'free');
  end if;

  select id into v_grant from jadhagam_reward_grants
    where user_id = v_uid and status = 'verified' order by verified_at limit 1 for update;
  if v_grant is not null then
    update jadhagam_reward_grants set status = 'used', used_at = now() where id = v_grant;
    insert into jadhagam_downloads (user_id, kind, via, grant_id) values (v_uid, p_kind, 'rewarded', v_grant);
    return jsonb_build_object('allowed', true, 'via', 'rewarded');
  end if;

  return jsonb_build_object('allowed', false, 'reason', 'needs_video');
end $$;

-- Called only by the admob-ssv edge function (service_role) after it has checked
-- Google's signature. Verifies the pending grant named in custom_data, for the
-- user named in user_id; the unique transaction_id blocks replays.
create or replace function public.verify_jadhagam_reward(p_grant uuid, p_user uuid, p_transaction text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_rows int;
begin
  update jadhagam_reward_grants
     set status = 'verified', verified_at = now(), transaction_id = p_transaction
   where id = p_grant and user_id = p_user and status = 'pending'
     and created_at > now() - interval '1 day'
     and not exists (select 1 from jadhagam_reward_grants where transaction_id = p_transaction);
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end $$;

revoke all on function public.jadhagam_download_status(), public.start_jadhagam_reward(),
  public.claim_jadhagam_download(text), public.verify_jadhagam_reward(uuid, uuid, text) from public, anon;
grant execute on function public.jadhagam_download_status(), public.start_jadhagam_reward(),
  public.claim_jadhagam_download(text) to authenticated;
revoke execute on function public.verify_jadhagam_reward(uuid, uuid, text) from authenticated;
grant execute on function public.verify_jadhagam_reward(uuid, uuid, text) to service_role;
