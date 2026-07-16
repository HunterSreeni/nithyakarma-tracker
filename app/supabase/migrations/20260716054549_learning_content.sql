-- Learning page pilot (Intent 2.1a). Verse text lives in Storage (public
-- bucket "learning-content", one {slug}.json per stotram) - has_learning_content
-- just flags which practices have it, keyed by the practice's own slug.
alter table public.practices add column has_learning_content boolean not null default false;
update public.practices set has_learning_content = true where slug = 'hanuman-chalisa';

-- One row per verse a subject has marked learned. Same shape/RLS pattern as
-- practice_logs: append-only, owner-scoped, family_member_id null = self.
create table public.learning_progress (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  family_member_id uuid references public.family_members(id) on delete cascade,
  content_slug text not null,
  verse_id text not null,
  learned_at timestamptz not null default now()
);
create unique index learning_progress_unique on public.learning_progress
  (owner_id, coalesce(family_member_id, '00000000-0000-0000-0000-000000000000'::uuid), content_slug, verse_id);

alter table public.learning_progress enable row level security;

create policy "own learning progress select" on public.learning_progress for select
  using (owner_id = auth.uid());
create policy "own learning progress insert" on public.learning_progress for insert
  with check (owner_id = auth.uid());
create policy "own learning progress delete" on public.learning_progress for delete
  using (owner_id = auth.uid());

-- Public bucket for stotram verse content (English/Malayalam/Sanskrit JSON per
-- slug) - not user data, so no per-row RLS needed, just a public-read bucket.
insert into storage.buckets (id, name, public) values ('learning-content', 'learning-content', true);
create policy "learning content publicly readable" on storage.objects for select
  using (bucket_id = 'learning-content');
