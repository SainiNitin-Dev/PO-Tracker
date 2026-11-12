-- Phase 4: private coach conversation, durable notes, and audit-friendly tool context.
create table public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.coach_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create table public.coach_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.coach_messages enable row level security; alter table public.coach_messages force row level security;
alter table public.coach_notes enable row level security; alter table public.coach_notes force row level security;
create policy "owners manage coach messages" on public.coach_messages for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owners manage coach notes" on public.coach_notes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
