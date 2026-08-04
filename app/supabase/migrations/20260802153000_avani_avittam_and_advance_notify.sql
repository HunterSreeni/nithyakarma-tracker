-- Adds Avani Avittam (Yajurveda: Shravana Purnima - the full moon day whose
-- nakshatra is Shravana) and the "3 days before" advance-notification flag.
--
-- advance_notify marks which observances are worth an early heads-up. false
-- only for monthly_amavasya - that fires ~12x/year and a 3-day-advance push
-- for a routine monthly tithi would be noise, unlike the named yearly
-- occasions. Everything else (including the specific karkidaka_vaavu/sankranti
-- tharpanam rows and the new Avani Avittam row) defaults true.
alter table public.panchangam_observances
  add column advance_notify boolean not null default true;

update public.panchangam_observances set advance_notify = false where key = 'monthly_amavasya';

insert into public.panchangam_observances
  (key, category, title, message, match_thithi, match_tamil_month, match_tamil_day, match_malayalam_month, match_malayalam_day, match_nakshatra, day_offset, priority)
values
  ('avani_avittam', 'observance', 'Avani Avittam',
   'Avani Avittam (Yajurveda Upakarma) today - renewal of the sacred thread.',
   'Purnima', null, null, null, null, 'Shravana', 0, 0);

alter table public.notification_deliveries
  drop constraint notification_deliveries_slot_check;

alter table public.notification_deliveries
  add constraint notification_deliveries_slot_check
  check (slot = any (array['morning'::text, 'afternoon'::text, 'evening'::text, 'nudge'::text, 'nudge_morning'::text, 'tharpanam'::text, 'observance'::text, 'observance_advance'::text]));
