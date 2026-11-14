begin;

create table public.plan_copy_requests (
  sender_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null,
  source_id uuid not null,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  primary key (sender_id, request_id)
);
alter table public.plan_copy_requests enable row level security;
revoke all on public.plan_copy_requests from public, anon, authenticated;

create function public.copy_member_plan(p_plan_id uuid, p_recipient_id uuid, p_request_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  sender uuid := auth.uid();
  copied_plan uuid;
  source_name text;
  source_days jsonb;
  source_day jsonb;
  copied_day uuid;
begin
  if sender is null or not exists (select 1 from public.profiles where id = sender and role = 'user') then
    raise exception 'A member account is required.' using errcode = '42501';
  end if;
  if p_recipient_id is null or p_recipient_id = sender then
    raise exception 'Enter another member’s ID.';
  end if;
  if not exists (select 1 from public.profiles where id = p_recipient_id and role = 'user') then
    raise exception 'Member not found. Ask your friend to copy their member ID from Profile.';
  end if;

  select p.name, (
    select jsonb_agg(jsonb_build_object(
      'name', d.name, 'weekday', d.weekday, 'sort_order', d.sort_order,
      'exercises', (select jsonb_agg(jsonb_build_object(
        'exercise_id', e.exercise_id, 'target_sets', e.target_sets,
        'rep_min', e.rep_min, 'rep_max', e.rep_max,
        'time_target_seconds', e.time_target_seconds, 'sort_order', e.sort_order
      )) from public.program_exercises e where e.program_day_id = d.id)
    )) from public.program_days d where d.program_id = p.id
  ) into source_name, source_days
  from public.programs p where p.id = p_plan_id and p.user_id = sender;
  if not found then
    raise exception 'Choose one of your own plans.' using errcode = '42501';
  end if;

  insert into public.plan_copy_requests (sender_id, request_id, source_id, recipient_id)
  values (sender, p_request_id, p_plan_id, p_recipient_id)
  on conflict (sender_id, request_id) do nothing;
  if not found then
    if exists (select 1 from public.plan_copy_requests where sender_id = sender and request_id = p_request_id and source_id = p_plan_id and recipient_id = p_recipient_id) then
      return;
    end if;
    raise exception 'Start a new copy request for this plan and member.';
  end if;

  insert into public.programs (user_id, name, is_active)
  values (p_recipient_id, source_name, false) returning id into copied_plan;
  for source_day in select value from jsonb_array_elements(coalesce(source_days, '[]'::jsonb)) loop
    insert into public.program_days (program_id, name, weekday, sort_order)
    values (copied_plan, source_day->>'name', (source_day->>'weekday')::smallint, (source_day->>'sort_order')::smallint)
    returning id into copied_day;

    insert into public.program_exercises (program_day_id, exercise_id, target_sets, rep_min, rep_max, time_target_seconds, sort_order)
    select copied_day, e.exercise_id, e.target_sets, e.rep_min, e.rep_max, e.time_target_seconds, e.sort_order
    from jsonb_to_recordset(nullif(source_day->'exercises', 'null'::jsonb))
    as e(exercise_id uuid, target_sets smallint, rep_min smallint, rep_max smallint, time_target_seconds integer, sort_order smallint);
  end loop;
end;
$$;

revoke all on function public.copy_member_plan(uuid, uuid, uuid) from public, anon;
grant execute on function public.copy_member_plan(uuid, uuid, uuid) to authenticated;

commit;
