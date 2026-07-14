-- endpoint was globally unique, so upserting the same device/browser endpoint
-- under a second account silently failed RLS (row still owned by the first
-- account) and both clients ignored the error. Scope uniqueness to the user.
alter table public.push_subscriptions drop constraint push_subscriptions_endpoint_key;
alter table public.push_subscriptions add constraint push_subscriptions_user_endpoint_key unique (user_id, endpoint);
