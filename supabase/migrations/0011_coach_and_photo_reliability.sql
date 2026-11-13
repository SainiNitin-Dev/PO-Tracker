-- Additive changes only: retain existing chat history, photos, and member records.
alter table public.photo_reviews add column if not exists source_context jsonb;
alter table public.coach_messages add column if not exists request_id uuid;
alter table public.coach_messages add column if not exists evidence jsonb not null default '[]'::jsonb;
create unique index if not exists coach_message_request_once
  on public.coach_messages(user_id, request_id, role) where request_id is not null;
create index if not exists coach_messages_recent on public.coach_messages(conversation_id, created_at desc);
create index if not exists coach_notes_owner on public.coach_notes(user_id, updated_at desc);
create index if not exists photos_owner_date on public.progress_photos(user_id, taken_at desc);
create index if not exists photo_reviews_owner_date on public.photo_reviews(user_id, created_at desc);

create table if not exists public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('chat', 'vision')),
  created_at timestamptz not null default now()
);
alter table public.ai_usage enable row level security;
alter table public.ai_usage force row level security;
revoke all on public.ai_usage from anon, authenticated;
grant select on public.ai_usage to authenticated;
create policy "members read own ai allowance" on public.ai_usage for select to authenticated
  using (user_id = auth.uid() and not public.is_admin());
create index if not exists ai_usage_allowance on public.ai_usage(kind, created_at, user_id);

-- Atomic limits work across serverless instances. Failed provider attempts also count.
create or replace function public.reserve_ai_request(request_kind text)
returns table(allowed boolean, reason text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare member_id uuid := auth.uid(); user_count integer; total_count integer;
begin
  if member_id is null or public.is_admin() then raise exception 'Member access required' using errcode = '42501'; end if;
  if request_kind not in ('chat', 'vision') then raise exception 'Invalid request kind' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(110011);
  delete from public.ai_usage where created_at < now() - interval '32 days';
  if exists(select 1 from public.ai_usage where user_id = member_id and kind = request_kind
    and created_at > now() - case when request_kind = 'chat' then interval '10 seconds' else interval '30 seconds' end) then
    return query select false, 'Please wait a few seconds before trying again.'::text; return;
  end if;
  select count(*) into user_count from public.ai_usage where user_id = member_id and kind = request_kind
    and created_at >= case when request_kind = 'chat' then date_trunc('day', now() at time zone 'UTC') at time zone 'UTC' else date_trunc('month', now() at time zone 'UTC') at time zone 'UTC' end;
  if user_count >= (case when request_kind = 'chat' then 20 else 4 end) then
    return query select false, case when request_kind = 'chat' then 'You have used today’s 20 coach requests. Your allowance resets at midnight UTC.' else 'You have used this month’s 4 photo reviews. Your allowance resets next month.' end; return;
  end if;
  select count(*) into total_count from public.ai_usage where kind = request_kind and created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  if total_count >= (case when request_kind = 'chat' then 100 else 10 end) then
    return query select false, 'The app has reached today’s AI allowance. Please try again tomorrow.'::text; return;
  end if;
  insert into public.ai_usage(user_id, kind) values(member_id, request_kind);
  return query select true, ''::text;
end; $$;
revoke all on function public.reserve_ai_request(text) from public, anon;
grant execute on function public.reserve_ai_request(text) to authenticated;

-- Store both messages together only after a valid response; retries cannot duplicate them.
create or replace function public.save_coach_exchange(exchange_id uuid, user_message text, coach_answer text, fact_evidence jsonb)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare member_id uuid := auth.uid(); conversation uuid; result jsonb;
begin
  if member_id is null or public.is_admin() then raise exception 'Member access required' using errcode = '42501'; end if;
  if exchange_id is null or length(trim(user_message)) not between 1 and 2000 or length(trim(coach_answer)) not between 1 and 14000
    or jsonb_typeof(fact_evidence) <> 'array' or jsonb_array_length(fact_evidence) > 20 then
    raise exception 'Invalid coach exchange' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(member_id::text, 11));
  select jsonb_build_object('answer',content,'evidence',evidence) into result from public.coach_messages
    where user_id = member_id and request_id = exchange_id and role = 'assistant';
  if result is not null then return result; end if;
  select id into conversation from public.coach_conversations where user_id = member_id order by created_at desc limit 1;
  if conversation is null then
    insert into public.coach_conversations(user_id) values(member_id) returning id into conversation;
  end if;
  insert into public.coach_messages(conversation_id,user_id,role,content,request_id,created_at)
    values(conversation,member_id,'user',user_message,exchange_id,clock_timestamp());
  insert into public.coach_messages(conversation_id,user_id,role,content,request_id,evidence,created_at)
    values(conversation,member_id,'assistant',coach_answer,exchange_id,fact_evidence,clock_timestamp());
  return jsonb_build_object('answer',coach_answer,'evidence',fact_evidence);
end; $$;
revoke all on function public.save_coach_exchange(uuid,text,text,jsonb) from public, anon;
grant execute on function public.save_coach_exchange(uuid,text,text,jsonb) to authenticated;

create or replace function public.save_coach_note(note_text text, note_id uuid default null)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare member_id uuid := auth.uid(); saved public.coach_notes;
begin
  if member_id is null or public.is_admin() then raise exception 'Member access required' using errcode = '42501'; end if;
  if length(trim(note_text)) not between 1 and 1000 then raise exception 'Invalid note' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(member_id::text, 12));
  if note_id is null then
    if (select count(*) from public.coach_notes where user_id = member_id) >= 20 then raise exception 'You can keep up to 20 notes. Edit or remove an existing note first.' using errcode = 'P0001'; end if;
    insert into public.coach_notes(user_id,note) values(member_id,trim(note_text)) returning * into saved;
  else
    update public.coach_notes set note = trim(note_text), updated_at = now() where id = note_id and user_id = member_id returning * into saved;
    if saved.id is null then raise exception 'Note not found' using errcode = 'P0002'; end if;
  end if;
  return to_jsonb(saved);
end; $$;
revoke all on function public.save_coach_note(text,uuid) from public, anon;
grant execute on function public.save_coach_note(text,uuid) to authenticated;

-- Call only after the Storage API has removed the file, so a failed file delete is retryable.
create or replace function public.delete_photo_metadata(photo_id uuid)
returns void language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or public.is_admin() then raise exception 'Member access required' using errcode = '42501'; end if;
  delete from public.photo_reviews where user_id = auth.uid() and (older_photo_id = photo_id or newer_photo_id = photo_id);
  delete from public.progress_photos where id = photo_id and user_id = auth.uid();
end; $$;
revoke all on function public.delete_photo_metadata(uuid) from public, anon;
grant execute on function public.delete_photo_metadata(uuid) to authenticated;

-- Enforce the same limits at the storage boundary as in the upload form.
update storage.buckets set file_size_limit = 8388608, allowed_mime_types = array['image/jpeg','image/png','image/webp'] where id = 'progress-photos';
