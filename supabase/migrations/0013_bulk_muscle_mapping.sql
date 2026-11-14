begin;

create or replace function public.replace_exercise_muscles(
  p_exercise_id uuid, p_primary uuid[], p_secondary uuid[]
) returns void
language plpgsql set search_path = public as $$
declare
  selected_ids uuid[] := p_primary || p_secondary;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;

  perform 1 from public.exercises
  where id = p_exercise_id and archived_at is null for update;
  if not found then
    raise exception 'Choose an active exercise.';
  end if;

  if p_primary is null or p_secondary is null or cardinality(selected_ids) > 250 then
    raise exception 'Select up to 250 muscles.';
  end if;
  if (select count(distinct id) from unnest(selected_ids) as selected(id)) <> cardinality(selected_ids) then
    raise exception 'Each muscle can have only one role.';
  end if;
  if (select count(*) from public.muscles where id = any(selected_ids)) <> cardinality(selected_ids) then
    raise exception 'One or more muscles are no longer available. Refresh and try again.';
  end if;

  insert into public.exercise_muscles (exercise_id, muscle_id, contribution)
  select p_exercise_id, id, 1 from unnest(p_primary) as selected(id)
  union all
  select p_exercise_id, id, 0.5 from unnest(p_secondary) as selected(id)
  on conflict (exercise_id, muscle_id) do update set contribution = excluded.contribution;

  delete from public.exercise_muscles
  where exercise_id = p_exercise_id and not (muscle_id = any(selected_ids));
end;
$$;

revoke all on function public.replace_exercise_muscles(uuid, uuid[], uuid[]) from public, anon;
grant execute on function public.replace_exercise_muscles(uuid, uuid[], uuid[]) to authenticated;

commit;
