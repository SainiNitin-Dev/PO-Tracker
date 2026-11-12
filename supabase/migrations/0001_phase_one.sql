-- Phase 1: identity, roles, catalog management, and private-data boundaries.
create type public.app_role as enum ('user', 'admin');
create type public.exercise_tracking_type as enum ('reps', 'bodyweight_reps', 'time', 'weighted_time');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'user',
  display_name text not null default '',
  created_at timestamptz not null default now()
);

create table public.gyms (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  weight_increment_kg numeric(5,2) not null check (weight_increment_kg > 0),
  created_at timestamptz not null default now()
);

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  tracking_type public.exercise_tracking_type not null,
  created_at timestamptz not null default now()
);

-- These private roots are created now so their RLS contract is tested before later phases add details.
create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  gym_id uuid references public.gyms(id), performed_at timestamptz not null default now(), notes text
);
create table public.body_metrics (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  recorded_at date not null default current_date, bodyweight_kg numeric(5,2)
);
create table public.coach_conversations (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table public.progress_photos (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique, taken_at date not null, created_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public) values ('progress-photos', 'progress-photos', false)
on conflict (id) do update set public = false;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Auth metadata is copied only at creation. Role is deliberately hard-coded to user.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''), 'user');
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
create policy "users read own profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "users update own display name only" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

alter table public.gyms enable row level security;
alter table public.gyms force row level security;
alter table public.exercises enable row level security;
alter table public.exercises force row level security;
create policy "authenticated read gyms" on public.gyms for select to authenticated using (true);
create policy "admins manage gyms" on public.gyms for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "authenticated read exercises" on public.exercises for select to authenticated using (true);
create policy "admins manage exercises" on public.exercises for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.workout_sessions enable row level security;
alter table public.workout_sessions force row level security;
alter table public.body_metrics enable row level security;
alter table public.body_metrics force row level security;
alter table public.coach_conversations enable row level security;
alter table public.coach_conversations force row level security;
alter table public.progress_photos enable row level security;
alter table public.progress_photos force row level security;

create policy "owners manage workout sessions" on public.workout_sessions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owners manage body metrics" on public.body_metrics for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owners manage conversations" on public.coach_conversations for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owners manage photo metadata" on public.progress_photos for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Storage objects are owned by the UUID first path segment: <user-id>/<file-name>.
create policy "owners manage private photos" on storage.objects for all to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
