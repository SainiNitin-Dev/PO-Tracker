alter table public.workout_exercises add column if not exists swapped_from_id uuid;

create or replace function public.swap_training_exercise(
  p_exercise_id uuid, p_expected_equipment uuid, p_replacement uuid
) returns void
language plpgsql set search_path = public as $$
declare
  session_row public.workout_sessions;
  workout_entry public.workout_exercises;
begin
  select s.* into session_row
  from workout_sessions s join workout_exercises we on we.session_id = s.id
  where (we.id = p_exercise_id or we.swapped_from_id = p_exercise_id)
    and s.user_id = auth.uid() for update of s;

  if session_row.status is distinct from 'in_progress' or public.is_admin() then
    raise exception 'Only your open workout can be changed.';
  end if;
  select * into workout_entry from workout_exercises where session_id = session_row.id
    and (id = p_exercise_id or swapped_from_id = p_exercise_id);
  if workout_entry.gym_exercise_id = p_replacement then return; end if;
  if workout_entry.id is distinct from p_exercise_id or workout_entry.gym_exercise_id is distinct from p_expected_equipment then
    raise exception 'This exercise changed. Reload the workout before swapping it.';
  end if;
  if workout_entry.pump_rating is not null or workout_entry.notes is not null
      or exists (select 1 from workout_sets where workout_exercise_id = p_exercise_id)
      or exists (select 1 from exercise_soreness_feedback where workout_exercise_id = p_exercise_id) then
    raise exception 'Swap exercises before logging sets or exercise feedback.';
  end if;
  if not exists (
    select 1 from gym_exercises source
    join exercises source_exercise on source_exercise.id = source.exercise_id
    join gym_exercises replacement on replacement.id = p_replacement
    join exercises replacement_exercise on replacement_exercise.id = replacement.exercise_id
    where source.id = workout_entry.gym_exercise_id
      and replacement.gym_id = session_row.gym_id and replacement.archived_at is null
      and replacement_exercise.archived_at is null
      and (source_exercise.tracking_type in ('time','weighted_time')) =
          (replacement_exercise.tracking_type in ('time','weighted_time'))
      and exists (
        select 1 from exercise_muscles a join exercise_muscles b on b.muscle_id = a.muscle_id
        where a.exercise_id = source.exercise_id and b.exercise_id = replacement.exercise_id
          and a.contribution = 1 and b.contribution = 1
      )
  ) then raise exception 'Choose an available exercise with a matching primary muscle and target type.';
  end if;
  if exists (select 1 from workout_exercises where session_id = session_row.id and gym_exercise_id = p_replacement) then
    raise exception 'This exercise is already in your workout.';
  end if;

  -- Keep the session's targets, also snapshotting them for legacy entries.
  update workout_exercises set id = gen_random_uuid(), swapped_from_id = p_exercise_id,
    gym_exercise_id = p_replacement, program_exercise_id = null,
    target_sets = coalesce(target_sets, (select target_sets from program_exercises where id = workout_entry.program_exercise_id), 1),
    rep_min = coalesce(rep_min, (select rep_min from program_exercises where id = workout_entry.program_exercise_id)),
    rep_max = coalesce(rep_max, (select rep_max from program_exercises where id = workout_entry.program_exercise_id)),
    time_target_seconds = coalesce(time_target_seconds, (select time_target_seconds from program_exercises where id = workout_entry.program_exercise_id))
  where id = p_exercise_id;
end;
$$;

revoke all on function public.swap_training_exercise(uuid, uuid, uuid) from public, anon;
grant execute on function public.swap_training_exercise(uuid, uuid, uuid) to authenticated;
