-- Run in a disposable Supabase project after 0001_phase_one.sql.
-- Replace UUIDs with three existing Auth users, then set their roles as noted below.
-- The admin assertion proves catalog access,
-- while the following assertions prove it has zero access to private member data.
begin;
create extension if not exists pgtap;
select plan(6);

-- Before running: ensure Alice and Bob have role user, Manager has role admin.
-- The user IDs below must be valid auth.users IDs in this test project.
insert into public.body_metrics (user_id, bodyweight_kg) values ('11111111-1111-1111-1111-111111111111', 70.0);

set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
select is((select count(*) from public.body_metrics), 0::bigint, 'one user cannot read another user metrics');
select throws_ok($$insert into public.body_metrics(user_id, bodyweight_kg) values ('11111111-1111-1111-1111-111111111111', 71)$$, '42501', null, 'one user cannot write another user metrics');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
select is((select count(*) from public.body_metrics), 0::bigint, 'admin cannot read member metrics');
select is((select count(*) from public.workout_sessions), 0::bigint, 'admin cannot read member workouts');
select is((select count(*) from public.progress_photos), 0::bigint, 'admin cannot read member photo metadata');
select lives_ok($$insert into public.gyms(name, weight_increment_kg) values ('RLS Test Gym', 2.5)$$, 'admin can create gyms');
reset role;
select * from finish();
rollback;
