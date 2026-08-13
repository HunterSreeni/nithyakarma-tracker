-- A notification is deduplicated only after the push provider accepts it.
-- Previously the sender inserted notification_deliveries before calling the
-- provider; one transient FCM/Web Push failure therefore suppressed every
-- later 15-minute retry for that slot.

alter table public.notification_deliveries
  add column status text not null default 'delivered'
    check (status in ('sending', 'delivered', 'failed')),
  add column attempt_count integer not null default 1 check (attempt_count > 0),
  add column last_attempt_at timestamptz not null default now(),
  add column delivered_at timestamptz,
  add column last_error text;

-- Existing rows predate status tracking and represented completed dedupe rows.
update public.notification_deliveries set delivered_at = sent_at;

create or replace function public.claim_notification_delivery(
  p_user_id uuid,
  p_reminder_date date,
  p_slot text,
  p_endpoint text,
  p_event_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  begin
    insert into notification_deliveries (
      user_id, reminder_date, slot, endpoint, event_id,
      status, attempt_count, last_attempt_at, delivered_at, last_error
    ) values (
      p_user_id, p_reminder_date, p_slot, p_endpoint, p_event_id,
      'sending', 1, now(), null, null
    ) returning id into v_id;
    return v_id;
  exception when unique_violation then
    -- The unique indexes differ for scheduled and event notifications.
    if p_event_id is null then
      select id into v_id from notification_deliveries
       where user_id = p_user_id and reminder_date = p_reminder_date
         and slot = p_slot and endpoint = p_endpoint and event_id is null;
    else
      select id into v_id from notification_deliveries
       where event_id = p_event_id and endpoint = p_endpoint;
    end if;
  end;

  -- A failed attempt can retry on the next cron. A process that died while
  -- sending releases its claim after five minutes. Delivered rows stay final.
  update notification_deliveries
     set status = 'sending', attempt_count = attempt_count + 1,
         last_attempt_at = now(), last_error = null
   where id = v_id
     and (status = 'failed' or (status = 'sending' and last_attempt_at < now() - interval '5 minutes'))
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.claim_notification_delivery(uuid, date, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_notification_delivery(uuid, date, text, text, uuid)
  to service_role;
