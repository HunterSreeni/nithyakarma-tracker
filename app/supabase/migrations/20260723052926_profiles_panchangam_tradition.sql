alter table public.profiles
  add column panchangam_tradition text not null default 'tamil'
  check (panchangam_tradition in ('tamil', 'malayalam'));
