begin;

alter table public.coach_conversations add column title text;
update public.coach_conversations c set title = (
  select left(regexp_replace(trim(m.content), '[[:space:]]+', ' ', 'g'), 70)
  from public.coach_messages m
  where m.conversation_id = c.id and m.user_id = c.user_id and m.role = 'user'
  order by m.created_at, m.id limit 1
);
create index coach_chats_owner_created on public.coach_conversations(user_id, created_at desc, id desc);

create function public.save_coach_chat_exchange(chat_id uuid, exchange_id uuid, user_message text, coach_answer text, fact_evidence jsonb)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare member_id uuid := auth.uid(); result jsonb;
begin
  if member_id is null or public.is_admin() then
    raise exception 'Member access required.' using errcode = '42501';
  end if;
  if exchange_id is null or user_message is null or coach_answer is null or fact_evidence is null
    or length(trim(user_message)) not between 1 and 2000 or length(trim(coach_answer)) not between 1 and 14000
    or jsonb_typeof(fact_evidence) <> 'array' or jsonb_array_length(fact_evidence) > 20 then
    raise exception 'Invalid coach exchange.' using errcode = '22023';
  end if;

  perform 1 from public.coach_conversations where id = chat_id and user_id = member_id for update;
  if not found then raise exception 'This chat is no longer available. Open another chat or start a new one.'; end if;

  select jsonb_build_object('answer', content, 'evidence', evidence) into result
    from public.coach_messages where user_id = member_id and conversation_id = chat_id
      and request_id = exchange_id and role = 'assistant';
  if result is not null then return result; end if;

  insert into public.coach_messages(conversation_id,user_id,role,content,request_id,created_at)
    values(chat_id,member_id,'user',user_message,exchange_id,clock_timestamp());
  insert into public.coach_messages(conversation_id,user_id,role,content,request_id,evidence,created_at)
    values(chat_id,member_id,'assistant',coach_answer,exchange_id,fact_evidence,clock_timestamp());
  update public.coach_conversations set title = left(regexp_replace(trim(user_message), '[[:space:]]+', ' ', 'g'), 70)
    where id = chat_id and user_id = member_id and title is null;
  return jsonb_build_object('answer',coach_answer,'evidence',fact_evidence);
end;
$$;

revoke all on function public.save_coach_chat_exchange(uuid,uuid,text,text,jsonb) from public, anon;
grant execute on function public.save_coach_chat_exchange(uuid,uuid,text,text,jsonb) to authenticated;

commit;
