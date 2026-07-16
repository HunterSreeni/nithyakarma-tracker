-- The learning-content bucket is public, so getPublicUrl()+fetch() (the only
-- access pattern the app uses) is served directly and needs no RLS policy.
-- The SELECT policy added in 20260716054549_learning_content.sql only
-- enabled bucket *listing*, which the app never does - drop it (flagged by
-- Supabase's advisor as public_bucket_allows_listing).
drop policy if exists "learning content publicly readable" on storage.objects;
