-- The send-reminders edge function emits slot name 'nudge_morning' for the 08:00
-- local window, but this CHECK never permitted it. Every insert failed the
-- constraint, and the sender's `if (dupErr) continue;` misread the failure as
-- "already sent" and skipped the user - so the 08:00 morning nudge has never been
-- delivered to anyone since launch. Confirmed: zero 'nudge_morning' rows exist,
-- while the four permitted slots each have 13-17 rows.
alter table public.notification_deliveries
  drop constraint notification_deliveries_slot_check;

alter table public.notification_deliveries
  add constraint notification_deliveries_slot_check
  check (slot = any (array['morning'::text, 'afternoon'::text, 'evening'::text,
                           'nudge'::text, 'nudge_morning'::text]));
