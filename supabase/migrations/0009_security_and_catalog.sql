-- Preserve existing rows and historical references. Catalog removal means archive.
begin;

-- A profile owner may change their name, never their identity or role.
drop policy if exists "users update own display name only" on public.profiles;
create policy "users update own display name only" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (display_name) on public.profiles to authenticated;

-- Restrictive policies apply alongside existing owner policies, including through
-- child-table RLS. The catalog admin role cannot become a training-data back door.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'workout_sessions','body_metrics','coach_conversations','progress_photos',
    'programs','program_days','program_exercises','workout_exercises','workout_sets',
    'exercise_soreness_feedback','volume_targets','volume_experiments',
    'coach_messages','coach_notes','photo_reviews'
  ] loop
    execute format('create policy "members only" on public.%I as restrictive for all to authenticated using (not public.is_admin()) with check (not public.is_admin())', table_name);
  end loop;
end;
$$;

create policy "member photo storage" on storage.objects as restrictive for all to authenticated
  using (bucket_id <> 'progress-photos' or not public.is_admin())
  with check (bucket_id <> 'progress-photos' or not public.is_admin());

-- Prevent a user-owned record from pointing at another user's private record.
create or replace function public.check_private_links()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_table_name = 'coach_messages' then
    if not exists (select 1 from public.coach_conversations c where c.id = new.conversation_id and c.user_id = new.user_id) then
      raise exception 'Conversation does not belong to this user' using errcode = '42501';
    end if;
  elsif tg_table_name = 'photo_reviews' then
    if (new.older_photo_id is not null and not exists (select 1 from public.progress_photos p where p.id = new.older_photo_id and p.user_id = new.user_id))
       or (new.newer_photo_id is not null and not exists (select 1 from public.progress_photos p where p.id = new.newer_photo_id and p.user_id = new.user_id)) then
      raise exception 'Photos do not belong to this user' using errcode = '42501';
    end if;
    if new.older_photo_id = new.newer_photo_id then
      raise exception 'Choose two different photos' using errcode = '23514';
    end if;
  elsif tg_table_name = 'progress_photos' then
    if split_part(new.storage_path, '/', 1) <> new.user_id::text
       or new.storage_path ~ '(^|/)\.\.(/|$)' then
      raise exception 'Invalid photo path' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger check_message_owner before insert or update on public.coach_messages for each row execute function public.check_private_links();
create trigger check_review_owner before insert or update on public.photo_reviews for each row execute function public.check_private_links();
create trigger check_photo_path before insert or update on public.progress_photos for each row execute function public.check_private_links();

alter table public.gyms drop constraint if exists gyms_name_key;
create unique index if not exists gyms_active_name_key on public.gyms(name) where archived_at is null;
revoke delete on public.gyms, public.exercises, public.gym_exercises from authenticated, anon;

create or replace function public.archive_catalog_children()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.archived_at is not null and old.archived_at is null then
    if tg_table_name = 'gyms' then
      update public.gym_exercises set archived_at = new.archived_at where gym_id = new.id and archived_at is null;
    else
      update public.gym_exercises set archived_at = new.archived_at where exercise_id = new.id and archived_at is null;
    end if;
  end if;
  return new;
end;
$$;
create trigger archive_gym_children after update of archived_at on public.gyms for each row execute function public.archive_catalog_children();
create trigger archive_exercise_children after update of archived_at on public.exercises for each row execute function public.archive_catalog_children();

create or replace function public.check_catalog_links()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_table_name = 'gym_exercises' then
    if new.archived_at is null and (
      not exists (select 1 from public.gyms where id = new.gym_id and archived_at is null)
      or not exists (select 1 from public.exercises where id = new.exercise_id and archived_at is null)
    ) then raise exception 'Choose an active gym and exercise' using errcode = '23514'; end if;
  elsif tg_table_name = 'exercises' then
    if new.tracking_type <> old.tracking_type then
      raise exception 'Tracking method is fixed to preserve workout history' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
create trigger check_available_parents before insert or update on public.gym_exercises for each row execute function public.check_catalog_links();
create trigger preserve_tracking_type before update of tracking_type on public.exercises for each row execute function public.check_catalog_links();

-- Earlier versions archived a parent without clearing its availability rows.
update public.gym_exercises ge set archived_at = now()
where ge.archived_at is null and (
  exists (select 1 from public.gyms g where g.id = ge.gym_id and g.archived_at is not null)
  or exists (select 1 from public.exercises e where e.id = ge.exercise_id and e.archived_at is not null)
);

create or replace function public.archive_catalog(catalog text, item_id uuid default null, all_items boolean default false, for_gym uuid default null)
returns integer language plpgsql security invoker set search_path = public as $$
declare affected integer;
begin
  if not public.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if all_items is null or (all_items and item_id is not null) or (not all_items and item_id is null) then
    raise exception 'Choose one item or explicitly confirm all items' using errcode = '22023';
  end if;
  if for_gym is not null and catalog <> 'gym_exercises' then raise exception 'Invalid gym filter' using errcode = '22023'; end if;
  if catalog = 'gyms' then
    update public.gyms set archived_at = now() where archived_at is null and (all_items or id = item_id);
  elsif catalog = 'exercises' then
    update public.exercises set archived_at = now() where archived_at is null and (all_items or id = item_id);
  elsif catalog = 'gym_exercises' then
    update public.gym_exercises set archived_at = now() where archived_at is null and (all_items or id = item_id) and (for_gym is null or gym_id = for_gym);
  else raise exception 'Unknown catalog' using errcode = '22023';
  end if;
  get diagnostics affected = row_count;
  return affected;
end;
$$;
revoke all on function public.archive_catalog(text,uuid,boolean,uuid) from public, anon;
grant execute on function public.archive_catalog(text,uuid,boolean,uuid) to authenticated;

-- Deleting a muscle must not cascade into private targets or experiments.
create or replace function public.delete_unused_muscle(muscle uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  perform 1 from public.muscles where id = muscle for update;
  if exists (select 1 from public.exercise_muscles where muscle_id = muscle)
    or exists (select 1 from public.volume_targets where muscle_id = muscle)
    or exists (select 1 from public.volume_experiments where muscle_id = muscle) then
    raise exception 'This muscle is in use' using errcode = '23503';
  end if;
  delete from public.muscles where id = muscle;
end;
$$;
revoke delete on public.muscles from authenticated, anon;
revoke all on function public.delete_unused_muscle(uuid) from public, anon;
grant execute on function public.delete_unused_muscle(uuid) to authenticated;

create index if not exists workout_sessions_user_date_idx on public.workout_sessions(user_id, performed_at desc);
create index if not exists workout_exercises_session_idx on public.workout_exercises(session_id);
create index if not exists workout_exercises_gym_exercise_idx on public.workout_exercises(gym_exercise_id);
create index if not exists coach_messages_conversation_date_idx on public.coach_messages(conversation_id, created_at);
create index if not exists progress_photos_user_date_idx on public.progress_photos(user_id, taken_at desc);
create index if not exists coach_notes_user_idx on public.coach_notes(user_id);
create index if not exists body_metrics_user_date_idx on public.body_metrics(user_id, recorded_at desc);
create index if not exists program_days_program_idx on public.program_days(program_id);
create index if not exists program_exercises_day_idx on public.program_exercises(program_day_id);

update storage.buckets set file_size_limit = 8388608, allowed_mime_types = array['image/jpeg','image/png','image/webp'] where id = 'progress-photos';
commit;
