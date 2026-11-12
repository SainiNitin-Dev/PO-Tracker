-- Phase 2: user programs, gym-specific exercise availability, and detailed set logging.
create type public.set_kind as enum ('warmup', 'working', 'drop');
create type public.session_status as enum ('in_progress', 'completed', 'abandoned');

create table public.gym_exercises (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  equipment_label text,
  unique (gym_id, exercise_id)
);

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index one_active_program_per_user on public.programs (user_id) where is_active;

create table public.program_days (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  name text not null,
  weekday smallint check (weekday between 0 and 6),
  sort_order smallint not null default 0,
  unique (program_id, sort_order)
);
create table public.program_exercises (
  id uuid primary key default gen_random_uuid(),
  program_day_id uuid not null references public.program_days(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  target_sets smallint not null default 2 check (target_sets between 1 and 12),
  rep_min smallint check (rep_min > 0), rep_max smallint check (rep_max >= rep_min),
  time_target_seconds integer check (time_target_seconds > 0),
  sort_order smallint not null default 0,
  notes text,
  unique (program_day_id, sort_order)
);

alter table public.workout_sessions add column program_day_id uuid references public.program_days(id) on delete set null;
alter table public.workout_sessions add column status public.session_status not null default 'in_progress';
alter table public.workout_sessions add column completed_at timestamptz;
alter table public.workout_sessions add column bodyweight_kg numeric(5,2) check (bodyweight_kg > 0);

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  gym_exercise_id uuid not null references public.gym_exercises(id) on delete restrict,
  program_exercise_id uuid references public.program_exercises(id) on delete set null,
  sort_order smallint not null default 0,
  pump_rating smallint check (pump_rating between 1 and 5),
  notes text,
  unique (session_id, sort_order)
);
create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references public.workout_exercises(id) on delete cascade,
  set_number smallint not null check (set_number > 0),
  set_kind public.set_kind not null default 'working',
  weight_kg numeric(6,2) check (weight_kg >= 0),
  reps smallint check (reps > 0),
  duration_seconds integer check (duration_seconds > 0),
  rir smallint check (rir between 0 and 10),
  created_at timestamptz not null default now(),
  unique (workout_exercise_id, set_number),
  check ((reps is not null and duration_seconds is null) or (reps is null and duration_seconds is not null))
);
create table public.exercise_soreness_feedback (
  id uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null unique references public.workout_exercises(id) on delete cascade,
  soreness_rating smallint not null check (soreness_rating between 1 and 5),
  recorded_at timestamptz not null default now()
);

alter table public.gym_exercises enable row level security;
alter table public.gym_exercises force row level security;
create policy "authenticated read gym exercises" on public.gym_exercises for select to authenticated using (true);
create policy "admins manage gym exercises" on public.gym_exercises for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.programs enable row level security; alter table public.programs force row level security;
alter table public.program_days enable row level security; alter table public.program_days force row level security;
alter table public.program_exercises enable row level security; alter table public.program_exercises force row level security;
alter table public.workout_exercises enable row level security; alter table public.workout_exercises force row level security;
alter table public.workout_sets enable row level security; alter table public.workout_sets force row level security;
alter table public.exercise_soreness_feedback enable row level security; alter table public.exercise_soreness_feedback force row level security;

create policy "owners manage programs" on public.programs for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owners manage program days" on public.program_days for all to authenticated using (exists (select 1 from public.programs p where p.id = program_id and p.user_id = auth.uid())) with check (exists (select 1 from public.programs p where p.id = program_id and p.user_id = auth.uid()));
create policy "owners manage program exercises" on public.program_exercises for all to authenticated using (exists (select 1 from public.program_days d join public.programs p on p.id = d.program_id where d.id = program_day_id and p.user_id = auth.uid())) with check (exists (select 1 from public.program_days d join public.programs p on p.id = d.program_id where d.id = program_day_id and p.user_id = auth.uid()));
create policy "owners manage workout exercises" on public.workout_exercises for all to authenticated using (exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = auth.uid())) with check (exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = auth.uid()));
create policy "owners manage workout sets" on public.workout_sets for all to authenticated using (exists (select 1 from public.workout_exercises we join public.workout_sessions s on s.id = we.session_id where we.id = workout_exercise_id and s.user_id = auth.uid())) with check (exists (select 1 from public.workout_exercises we join public.workout_sessions s on s.id = we.session_id where we.id = workout_exercise_id and s.user_id = auth.uid()));
create policy "owners manage soreness feedback" on public.exercise_soreness_feedback for all to authenticated using (exists (select 1 from public.workout_exercises we join public.workout_sessions s on s.id = we.session_id where we.id = workout_exercise_id and s.user_id = auth.uid())) with check (exists (select 1 from public.workout_exercises we join public.workout_sessions s on s.id = we.session_id where we.id = workout_exercise_id and s.user_id = auth.uid()));
