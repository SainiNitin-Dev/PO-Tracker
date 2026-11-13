-- Additive progress metadata; existing records are preserved.
alter table public.volume_experiments add column if not exists ended_at timestamptz;
create index if not exists body_metrics_owner_date on public.body_metrics(user_id, recorded_at desc);
create index if not exists experiments_owner_date on public.volume_experiments(user_id, started_on desc);

create or replace function public.start_volume_experiment(p_muscle uuid,p_weeks integer,p_sets integer) returns uuid
language plpgsql set search_path=public as $$
declare result uuid;
begin
  if auth.uid() is null or public.is_admin() then raise exception 'A member account is required.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,4));
  if exists(select 1 from public.volume_experiments where user_id=auth.uid() and muscle_id=p_muscle and status='active') then raise exception 'Finish the active experiment for this muscle before starting another.'; end if;
  insert into public.volume_experiments(user_id,muscle_id,baseline_weeks,added_sets) values(auth.uid(),p_muscle,p_weeks,p_sets) returning id into result;
  return result;
end;
$$;
revoke all on function public.start_volume_experiment(uuid,integer,integer) from public,anon;
grant execute on function public.start_volume_experiment(uuid,integer,integer) to authenticated;
