-- Phase 5: comparable private photo capture and future review records.
alter table public.progress_photos add column pose text;
alter table public.progress_photos add column conditions text;
create table public.photo_reviews (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  older_photo_id uuid references public.progress_photos(id) on delete set null,
  newer_photo_id uuid references public.progress_photos(id) on delete set null,
  review_text text not null, confidence text not null check (confidence in ('low','medium','high')),
  created_at timestamptz not null default now()
);
alter table public.photo_reviews enable row level security; alter table public.photo_reviews force row level security;
create policy "owners manage photo reviews" on public.photo_reviews for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
