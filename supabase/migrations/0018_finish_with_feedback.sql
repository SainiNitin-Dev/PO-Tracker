begin;

create or replace function public.finish_training_workout_with_feedback(
  p_id uuid, p_abandon boolean, p_notes text, p_bodyweight numeric, p_feedback jsonb
) returns void
language plpgsql set search_path = public as $$
declare
  session_status public.session_status;
  feedback record;
begin
  select status into session_status from workout_sessions
    where id = p_id and user_id = auth.uid() for update;
  if session_status is null or public.is_admin() then raise exception 'Workout not found.'; end if;
  if session_status <> 'in_progress' then return; end if;
  if jsonb_typeof(p_feedback) is distinct from 'array' or jsonb_array_length(p_feedback) > 101 then
    raise exception 'Check the exercise feedback for this workout.';
  end if;

  for feedback in select * from jsonb_to_recordset(p_feedback) as item(exercise_id uuid, pump integer, notes text) loop
    if not exists (select 1 from workout_exercises where id = feedback.exercise_id and session_id = p_id) then
      raise exception 'An exercise changed. Refresh your workout before finishing.';
    end if;
    perform save_training_feedback(feedback.exercise_id, feedback.pump, feedback.notes);
  end loop;
  perform finish_training_workout(p_id, p_abandon, p_notes, p_bodyweight);
end;
$$;

revoke all on function public.finish_training_workout_with_feedback(uuid, boolean, text, numeric, jsonb) from public, anon;
grant execute on function public.finish_training_workout_with_feedback(uuid, boolean, text, numeric, jsonb) to authenticated;

-- Retire imports while keeping the sessions that were already synced.
revoke execute on function public.import_offline_workout(uuid, uuid, uuid, timestamptz, timestamptz, text, numeric, jsonb) from authenticated;
notify pgrst, 'reload schema';

commit;
