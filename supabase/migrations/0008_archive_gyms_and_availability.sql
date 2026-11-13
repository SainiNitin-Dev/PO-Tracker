-- Preserve completed workout references while allowing active gym setup to be cleared.
alter table public.gyms add column if not exists archived_at timestamptz;
alter table public.gym_exercises add column if not exists archived_at timestamptz;
