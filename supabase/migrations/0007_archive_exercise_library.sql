-- Keep historical workout references intact while allowing an admin to replace the active catalog.
alter table public.exercises add column if not exists archived_at timestamptz;
alter table public.exercises drop constraint if exists exercises_name_key;
create unique index if not exists active_exercise_names on public.exercises (name) where archived_at is null;
