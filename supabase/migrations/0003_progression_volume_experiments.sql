-- Phase 3: deterministic progression support and configurable volume experiments.
create table public.muscles (id uuid primary key default gen_random_uuid(), name text not null unique);
create table public.exercise_muscles (
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  muscle_id uuid not null references public.muscles(id) on delete cascade,
  contribution numeric(3,2) not null check (contribution in (0.5, 1.0)),
  primary key (exercise_id, muscle_id)
);
create table public.volume_targets (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  muscle_id uuid not null references public.muscles(id) on delete cascade,
  weekly_min smallint not null default 8 check (weekly_min >= 0), weekly_max smallint not null default 16 check (weekly_max >= weekly_min),
  unique (user_id, muscle_id)
);
create table public.volume_experiments (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  muscle_id uuid not null references public.muscles(id) on delete cascade,
  baseline_weeks smallint not null default 4 check (baseline_weeks between 1 and 12),
  added_sets smallint not null check (added_sets between 1 and 4),
  started_on date not null default current_date, status text not null default 'active' check (status in ('active','completed','cancelled')),
  notes text
);

alter table public.muscles enable row level security; alter table public.muscles force row level security;
alter table public.exercise_muscles enable row level security; alter table public.exercise_muscles force row level security;
alter table public.volume_targets enable row level security; alter table public.volume_targets force row level security;
alter table public.volume_experiments enable row level security; alter table public.volume_experiments force row level security;
create policy "authenticated read muscles" on public.muscles for select to authenticated using (true);
create policy "admins manage muscles" on public.muscles for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "authenticated read exercise muscles" on public.exercise_muscles for select to authenticated using (true);
create policy "admins manage exercise muscles" on public.exercise_muscles for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "owners manage volume targets" on public.volume_targets for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owners manage volume experiments" on public.volume_experiments for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
