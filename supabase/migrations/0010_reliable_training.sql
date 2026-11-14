-- All operations run as the signed-in member. No service-role access is used.
create index if not exists workout_sessions_owner_status_date on public.workout_sessions(user_id, status, performed_at desc);
create index if not exists workout_exercises_session on public.workout_exercises(session_id);
create index if not exists workout_exercises_equipment on public.workout_exercises(gym_exercise_id);
create index if not exists workout_sets_exercise on public.workout_sets(workout_exercise_id);
alter table public.workout_exercises add column if not exists target_sets smallint;
alter table public.workout_exercises add column if not exists rep_min smallint;
alter table public.workout_exercises add column if not exists rep_max smallint;
alter table public.workout_exercises add column if not exists time_target_seconds integer;

create or replace function public.check_training_links() returns trigger
language plpgsql set search_path = public as $$
declare s public.workout_sessions; g public.gym_exercises; p record; t public.exercise_tracking_type;
begin
  if tg_table_name = 'workout_sessions' then
    if new.program_day_id is not null and not exists (
      select 1 from public.program_days d join public.programs pr on pr.id=d.program_id
      where d.id=new.program_day_id and pr.user_id=new.user_id
    ) then raise exception 'The training day does not belong to this member.'; end if;
  elsif tg_table_name = 'workout_exercises' then
    select * into s from public.workout_sessions where id=new.session_id;
    select * into g from public.gym_exercises where id=new.gym_exercise_id;
    if s.id is null or g.id is null or s.gym_id is distinct from g.gym_id then raise exception 'This equipment does not belong to the workout gym.'; end if;
    if new.program_exercise_id is not null and not exists (
      select 1 from public.program_exercises pe where pe.id=new.program_exercise_id
      and pe.program_day_id=s.program_day_id and pe.exercise_id=g.exercise_id
    ) then raise exception 'This exercise does not belong to the workout day.'; end if;
  elsif tg_table_name = 'workout_sets' then
    select s1.* into s from public.workout_exercises we join public.workout_sessions s1 on s1.id=we.session_id
      where we.id=new.workout_exercise_id;
    if s.id is null or s.status <> 'in_progress' then raise exception 'Only an open workout can be changed.'; end if;
    select e.tracking_type into t from public.workout_exercises we
      join public.gym_exercises ge on ge.id=we.gym_exercise_id join public.exercises e on e.id=ge.exercise_id
      where we.id=new.workout_exercise_id;
    if t in ('time','weighted_time') and (new.duration_seconds is null or new.reps is not null) then raise exception 'This exercise needs seconds, not reps.'; end if;
    if t in ('reps','bodyweight_reps') and (new.reps is null or new.duration_seconds is not null) then raise exception 'This exercise needs reps, not seconds.'; end if;
    if t in ('reps','weighted_time') and new.weight_kg is null then raise exception 'Enter the weight used.'; end if;
  elsif tg_table_name = 'program_exercises' then
    select tracking_type into t from public.exercises where id=new.exercise_id;
    if t in ('time','weighted_time') and (new.time_target_seconds is null or new.rep_min is not null or new.rep_max is not null) then raise exception 'Timed exercises need a time target.'; end if;
    if t in ('reps','bodyweight_reps') and (new.rep_min is null or new.rep_max is null or new.time_target_seconds is not null or new.rep_max < new.rep_min) then raise exception 'Rep exercises need a valid rep range.'; end if;
  end if;
  return new;
end;
$$;
drop trigger if exists check_workout_session_links on public.workout_sessions;
create trigger check_workout_session_links before insert or update of program_day_id,user_id on public.workout_sessions for each row execute function public.check_training_links();
drop trigger if exists check_workout_exercise_links on public.workout_exercises;
create trigger check_workout_exercise_links before insert or update of session_id,gym_exercise_id,program_exercise_id on public.workout_exercises for each row execute function public.check_training_links();
drop trigger if exists check_workout_set_type on public.workout_sets;
create trigger check_workout_set_type before insert or update on public.workout_sets for each row execute function public.check_training_links();
drop trigger if exists check_program_exercise_targets on public.program_exercises;
create trigger check_program_exercise_targets before insert or update of exercise_id,rep_min,rep_max,time_target_seconds on public.program_exercises for each row execute function public.check_training_links();

create or replace function public.start_training_workout(p_gym_id uuid, p_day_id uuid) returns uuid
language plpgsql set search_path = public as $$
declare result uuid; member_id uuid := auth.uid();
begin
  if member_id is null or public.is_admin() then raise exception 'A member account is required.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(member_id::text, 0));
  select id into result from public.workout_sessions where user_id=member_id and status='in_progress' order by performed_at limit 1;
  if result is not null then return result; end if;
  if not exists(select 1 from public.gyms where id=p_gym_id and archived_at is null) then raise exception 'Choose an available gym.'; end if;
  if not exists(select 1 from public.program_days d join public.programs p on p.id=d.program_id where d.id=p_day_id and p.user_id=member_id and p.is_active) then raise exception 'Choose a day from your active plan.'; end if;
  if not exists(select 1 from public.program_exercises where program_day_id=p_day_id) then raise exception 'Add exercises to this training day first.'; end if;
  if exists(select 1 from public.program_exercises pe join public.exercises e on e.id=pe.exercise_id
    left join public.gym_exercises ge on ge.exercise_id=pe.exercise_id and ge.gym_id=p_gym_id and ge.archived_at is null
    where pe.program_day_id=p_day_id and (ge.id is null or e.archived_at is not null)) then
    raise exception 'Some exercises are unavailable at this gym. Update your plan or ask your admin to add the equipment.';
  end if;
  insert into public.workout_sessions(user_id,gym_id,program_day_id) values(member_id,p_gym_id,p_day_id) returning id into result;
  insert into public.workout_exercises(session_id,gym_exercise_id,program_exercise_id,sort_order,target_sets,rep_min,rep_max,time_target_seconds)
    select result,ge.id,pe.id,pe.sort_order,pe.target_sets,pe.rep_min,pe.rep_max,pe.time_target_seconds from public.program_exercises pe join public.gym_exercises ge on ge.exercise_id=pe.exercise_id and ge.gym_id=p_gym_id and ge.archived_at is null where pe.program_day_id=p_day_id;
  return result;
end;
$$;

create or replace function public.save_training_set(p_exercise_id uuid,p_id uuid,p_kind public.set_kind,p_weight numeric,p_reps integer,p_seconds integer,p_rir integer) returns jsonb
language plpgsql set search_path = public as $$
declare owned public.workout_exercises; existing public.workout_sets; result public.workout_sets; next_number integer;
begin
  -- Serialize all saves with finishing the same session, across tabs/devices.
  perform 1 from public.workout_sessions s join public.workout_exercises we on we.session_id=s.id
    where we.id=p_exercise_id and s.user_id=auth.uid() for update of s;
  select we.* into owned from public.workout_exercises we join public.workout_sessions s on s.id=we.session_id
    where we.id=p_exercise_id and s.user_id=auth.uid() and s.status='in_progress' for update of we;
  if owned.id is null or public.is_admin() then raise exception 'This workout is not open or does not belong to you.'; end if;
  select * into existing from public.workout_sets where id=p_id;
  if existing.id is not null and existing.workout_exercise_id<>p_exercise_id then raise exception 'This set belongs to a different exercise.'; end if;
  select coalesce(max(set_number),0)+1 into next_number from public.workout_sets where workout_exercise_id=p_exercise_id;
  if next_number>1000 then raise exception 'This exercise has reached the set limit.'; end if;
  insert into public.workout_sets(id,workout_exercise_id,set_number,set_kind,weight_kg,reps,duration_seconds,rir)
    values(p_id,p_exercise_id,coalesce(existing.set_number,next_number),p_kind,p_weight,p_reps,p_seconds,p_rir)
    on conflict(id) do update set set_kind=excluded.set_kind,weight_kg=excluded.weight_kg,reps=excluded.reps,duration_seconds=excluded.duration_seconds,rir=excluded.rir
    returning * into result;
  return to_jsonb(result);
end;
$$;

create or replace function public.finish_training_workout(p_id uuid,p_abandon boolean,p_notes text,p_bodyweight numeric) returns void
language plpgsql set search_path = public as $$
declare owned public.workout_sessions;
begin
  select * into owned from public.workout_sessions where id=p_id and user_id=auth.uid() for update;
  if owned.id is null or public.is_admin() then raise exception 'Workout not found.'; end if;
  if owned.status<>'in_progress' then return; end if;
  if not p_abandon and not exists(select 1 from public.workout_sets ws join public.workout_exercises we on we.id=ws.workout_exercise_id where we.session_id=p_id and ws.set_kind='working') then raise exception 'Log at least one working set before finishing, or end without completing.'; end if;
  update public.workout_sessions set status=case when p_abandon then 'abandoned'::public.session_status else 'completed'::public.session_status end,
    completed_at=now(),notes=nullif(trim(p_notes),''),bodyweight_kg=p_bodyweight where id=p_id;
end;
$$;

create or replace function public.delete_training_set(p_exercise_id uuid,p_id uuid) returns void
language plpgsql set search_path = public as $$
declare session_status public.session_status;
begin
  select s.status into session_status from public.workout_sessions s join public.workout_exercises we on we.session_id=s.id
    where we.id=p_exercise_id and s.user_id=auth.uid() for update of s;
  if session_status is distinct from 'in_progress' or public.is_admin() then raise exception 'Only an open workout can be changed.'; end if;
  delete from public.workout_sets where id=p_id and workout_exercise_id=p_exercise_id;
end;
$$;

create or replace function public.save_training_feedback(p_exercise_id uuid,p_pump integer,p_notes text) returns void
language plpgsql set search_path = public as $$
declare session_status public.session_status;
begin
  select s.status into session_status from public.workout_sessions s join public.workout_exercises we on we.session_id=s.id
    where we.id=p_exercise_id and s.user_id=auth.uid() for update of s;
  if session_status is distinct from 'in_progress' or public.is_admin() then raise exception 'Only an open workout can be changed.'; end if;
  if length(p_notes)>1000 then raise exception 'Exercise notes must be at most 1000 characters.'; end if;
  update public.workout_exercises set pump_rating=p_pump,notes=nullif(trim(p_notes),'') where id=p_exercise_id;
end;
$$;

create or replace function public.save_training_plan(p_id uuid,p_name text,p_activate boolean) returns uuid
language plpgsql set search_path = public as $$
declare result uuid; member_id uuid:=auth.uid();
begin
  if member_id is null or public.is_admin() then raise exception 'A member account is required.'; end if;
  if length(trim(p_name)) not between 1 and 100 then raise exception 'Enter a plan name (up to 100 characters).'; end if;
  perform pg_advisory_xact_lock(hashtextextended(member_id::text,1));
  if p_id is not null and not exists(select 1 from public.programs where id=p_id and user_id=member_id) then raise exception 'Plan not found.'; end if;
  if p_activate then update public.programs set is_active=false where user_id=member_id and is_active and id is distinct from p_id; end if;
  if p_id is null then
    insert into public.programs(user_id,name,is_active) values(member_id,trim(p_name),p_activate) returning id into result;
  else
    update public.programs set name=trim(p_name),is_active=case when p_activate then true else is_active end where id=p_id returning id into result;
  end if;
  return result;
end;
$$;

create or replace function public.add_training_day(p_program_id uuid,p_name text,p_weekday integer) returns uuid
language plpgsql set search_path = public as $$
declare result uuid; next_order integer;
begin
  perform 1 from public.programs where id=p_program_id and user_id=auth.uid() for update;
  if not found or public.is_admin() then raise exception 'Plan not found.'; end if;
  if length(trim(p_name)) not between 1 and 80 or p_weekday not between 0 and 6 then raise exception 'Enter a day name and weekday.'; end if;
  select coalesce(max(sort_order),-1)+1 into next_order from public.program_days where program_id=p_program_id;
  if next_order>100 then raise exception 'This plan has reached the training-day limit.'; end if;
  insert into public.program_days(program_id,name,weekday,sort_order) values(p_program_id,trim(p_name),p_weekday,next_order) returning id into result;
  return result;
end;
$$;

create or replace function public.add_training_exercise(p_day_id uuid,p_exercise_id uuid,p_sets integer,p_min integer,p_max integer,p_seconds integer) returns uuid
language plpgsql set search_path = public as $$
declare result uuid; next_order integer;
begin
  perform 1 from public.program_days d join public.programs p on p.id=d.program_id where d.id=p_day_id and p.user_id=auth.uid() for update of d;
  if not found or public.is_admin() then raise exception 'Training day not found.'; end if;
  if not exists(select 1 from public.exercises where id=p_exercise_id and archived_at is null) then raise exception 'Choose an available exercise.'; end if;
  select coalesce(max(sort_order),-1)+1 into next_order from public.program_exercises where program_day_id=p_day_id;
  if next_order>100 then raise exception 'This day has reached the exercise limit.'; end if;
  insert into public.program_exercises(program_day_id,exercise_id,target_sets,rep_min,rep_max,time_target_seconds,sort_order)
    values(p_day_id,p_exercise_id,p_sets,p_min,p_max,p_seconds,next_order) returning id into result;
  return result;
end;
$$;

create or replace function public.move_training_item(p_kind text,p_id uuid,p_direction integer) returns void
language plpgsql set search_path = public as $$
declare source_order integer; neighbor_order integer; neighbor_id uuid; parent_id uuid;
begin
  if auth.uid() is null or public.is_admin() or p_direction not in (-1,1) then raise exception 'Invalid reorder request.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,1));
  if p_kind='day' then
    select sort_order,program_id into source_order,parent_id from public.program_days where id=p_id;
    if parent_id is null then raise exception 'Training day not found.'; end if;
    select id,sort_order into neighbor_id,neighbor_order from public.program_days where program_id=parent_id
      and (sort_order-source_order)*p_direction>0 order by abs(sort_order-source_order) limit 1;
    if neighbor_id is null then return; end if;
    update public.program_days set sort_order=-1 where id=p_id;
    update public.program_days set sort_order=source_order where id=neighbor_id;
    update public.program_days set sort_order=neighbor_order where id=p_id;
  elsif p_kind='exercise' then
    select sort_order,program_day_id into source_order,parent_id from public.program_exercises where id=p_id;
    if parent_id is null then raise exception 'Exercise not found.'; end if;
    select id,sort_order into neighbor_id,neighbor_order from public.program_exercises where program_day_id=parent_id
      and (sort_order-source_order)*p_direction>0 order by abs(sort_order-source_order) limit 1;
    if neighbor_id is null then return; end if;
    update public.program_exercises set sort_order=-1 where id=p_id;
    update public.program_exercises set sort_order=source_order where id=neighbor_id;
    update public.program_exercises set sort_order=neighbor_order where id=p_id;
  else raise exception 'Invalid reorder request.'; end if;
end;
$$;

revoke all on function public.delete_training_set(uuid,uuid), public.save_training_feedback(uuid,integer,text) from public, anon;
grant execute on function public.delete_training_set(uuid,uuid), public.save_training_feedback(uuid,integer,text) to authenticated;
revoke all on function public.start_training_workout(uuid,uuid), public.save_training_set(uuid,uuid,public.set_kind,numeric,integer,integer,integer), public.finish_training_workout(uuid,boolean,text,numeric), public.save_training_plan(uuid,text,boolean), public.add_training_day(uuid,text,integer), public.add_training_exercise(uuid,uuid,integer,integer,integer,integer), public.move_training_item(text,uuid,integer) from public, anon;
grant execute on function public.start_training_workout(uuid,uuid), public.save_training_set(uuid,uuid,public.set_kind,numeric,integer,integer,integer), public.finish_training_workout(uuid,boolean,text,numeric), public.save_training_plan(uuid,text,boolean), public.add_training_day(uuid,text,integer), public.add_training_exercise(uuid,uuid,integer,integer,integer,integer), public.move_training_item(text,uuid,integer) to authenticated;
