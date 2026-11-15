alter table public.workout_sessions add column if not exists offline_import boolean not null default false;

create or replace function public.import_offline_workout(
  p_id uuid, p_gym uuid, p_day uuid, p_started timestamptz, p_finished timestamptz,
  p_notes text, p_bodyweight numeric, p_exercises jsonb
) returns uuid
language plpgsql set search_path = public as $$
declare
  member_id uuid := auth.uid();
  existing public.workout_sessions;
  day_id uuid;
  exercise jsonb;
  logged_set jsonb;
  entry_id uuid;
  equipment_id uuid;
  position integer := 0;
begin
  if member_id is null or public.is_admin() then raise exception 'A member account is required.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(member_id::text, 0));
  select * into existing from workout_sessions where id = p_id and user_id = member_id;
  if existing.offline_import and existing.status = 'completed' then return p_id; end if;
  if existing.id is not null then raise exception 'This workout ID is already in use.'; end if;
  if p_started is null or p_finished is null or not isfinite(p_started) or not isfinite(p_finished)
    or p_finished < p_started or p_finished > now() + interval '10 minutes'
    or length(p_notes) > 2000 or p_bodyweight not between 20 and 500
    or jsonb_typeof(p_exercises) is distinct from 'array' or jsonb_array_length(p_exercises) not between 1 and 101 then
    raise exception 'Check the details of this offline workout.';
  end if;

  select d.id into day_id from program_days d join programs p on p.id = d.program_id
    where d.id = p_day and p.user_id = member_id;
  if not exists (select 1 from gyms where id = p_gym) then raise exception 'The gym for this workout could not be found.'; end if;
  insert into workout_sessions(id, user_id, gym_id, program_day_id, performed_at, offline_import)
    values (p_id, member_id, p_gym, day_id, p_started, true);

  for exercise in select value from jsonb_array_elements(p_exercises) loop
    equipment_id := (exercise->>'equipmentId')::uuid;
    if not exists (
      select 1 from gym_exercises ge join exercises e on e.id = ge.exercise_id
      where ge.id = equipment_id and ge.gym_id = p_gym and e.tracking_type::text = exercise->>'trackingType'
    ) then raise exception 'An exercise does not match this workout gym.'; end if;
    if jsonb_typeof(exercise->'sets') is distinct from 'array' or jsonb_array_length(exercise->'sets') > 100
      or coalesce((exercise->>'targetSets')::integer, 0) not between 1 and 12 then
      raise exception 'Check the targets and sets for this workout.';
    end if;

    insert into workout_exercises(session_id, gym_exercise_id, sort_order, target_sets, rep_min, rep_max, time_target_seconds)
    values (p_id, equipment_id, position, (exercise->>'targetSets')::smallint,
      (exercise->>'repMin')::smallint, (exercise->>'repMax')::smallint, (exercise->>'timeTargetSeconds')::integer)
    returning id into entry_id;
    position := position + 1;
    for logged_set in select value from jsonb_array_elements(exercise->'sets') loop
      perform save_training_set(entry_id, (logged_set->>'id')::uuid, (logged_set->>'kind')::public.set_kind,
        (logged_set->>'weight')::numeric, (logged_set->>'reps')::integer,
        (logged_set->>'seconds')::integer, (logged_set->>'rir')::integer);
    end loop;
  end loop;

  perform finish_training_workout(p_id, false, p_notes, p_bodyweight);
  update workout_sessions set completed_at = p_finished where id = p_id;
  return p_id;
end;
$$;

revoke all on function public.import_offline_workout(uuid, uuid, uuid, timestamptz, timestamptz, text, numeric, jsonb) from public, anon;
grant execute on function public.import_offline_workout(uuid, uuid, uuid, timestamptz, timestamptz, text, numeric, jsonb) to authenticated;

create or replace function public.training_extensions_enabled() returns boolean
language sql stable set search_path = public as $$ select true $$;
revoke all on function public.training_extensions_enabled() from public, anon;
grant execute on function public.training_extensions_enabled() to authenticated;
