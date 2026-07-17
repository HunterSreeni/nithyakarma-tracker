-- B8: 'Asia/Calcutta' is a deprecated IANA alias for 'Asia/Kolkata'. The client
-- now normalizes it at write time (see useNotifications.js); backfill any rows
-- already stored under the old alias.
update public.notification_preferences set timezone = 'Asia/Kolkata' where timezone = 'Asia/Calcutta';
