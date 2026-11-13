-- Run as postgres in a DISPOSABLE Supabase project after all migrations.
-- Fixtures are created here; no real accounts or emails are required or sent.
-- Every change is rolled back. Never run against a production project.
begin;
create extension if not exists pgtap;
select plan(24);

insert into auth.users(id, email, raw_user_meta_data, aud, role) values
('11111111-1111-4111-8111-111111111111','alice-privacy@example.invalid','{"role":"admin","display_name":"Alice"}','authenticated','authenticated'),
('22222222-2222-4222-8222-222222222222','bob-privacy@example.invalid','{}','authenticated','authenticated'),
('33333333-3333-4333-8333-333333333333','admin-privacy@example.invalid','{}','authenticated','authenticated');
update public.profiles set role = 'admin' where id = '33333333-3333-4333-8333-333333333333';

insert into public.gyms(id,name,weight_increment_kg) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Privacy Test Gym',2.5);
insert into public.exercises(id,name,tracking_type) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Privacy Test Press','reps');
insert into public.gym_exercises(id,gym_id,exercise_id) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into public.workout_sessions(id,user_id,gym_id) values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into public.workout_exercises(id,session_id,gym_exercise_id) values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','dddddddd-dddd-4ddd-8ddd-dddddddddddd','cccccccc-cccc-4ccc-8ccc-cccccccccccc');
insert into public.workout_sets(workout_exercise_id,set_number,weight_kg,reps) values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',1,40,8);
insert into public.body_metrics(user_id,bodyweight_kg) values ('11111111-1111-4111-8111-111111111111',70);
insert into public.coach_conversations(id,user_id) values ('abababab-abab-4bab-8bab-abababababab','11111111-1111-4111-8111-111111111111');
insert into public.coach_messages(conversation_id,user_id,role,content) values ('abababab-abab-4bab-8bab-abababababab','11111111-1111-4111-8111-111111111111','user','Private question');
insert into public.progress_photos(id,user_id,storage_path,taken_at) values ('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd','11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111/test.jpg',current_date);

set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select is((select role::text from public.profiles where id=auth.uid()),'user','signup metadata cannot grant admin');
select is((select count(*) from public.workout_sets),1::bigint,'owner can read seeded workout sets');
select lives_ok($$update public.profiles set display_name='Alice Edited' where id=auth.uid()$$,'owner can edit their name');
select throws_ok($$update public.profiles set role='admin' where id=auth.uid()$$,'42501',null,'owner cannot escalate role');
select throws_ok($$insert into public.gyms(name,weight_increment_kg) values ('Unauthorized Gym',2.5)$$,'42501',null,'member cannot create catalog data');
select throws_ok($$select public.archive_catalog('gyms',null,true)$$,'42501',null,'member cannot call admin archive');

select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select is((select count(*) from public.body_metrics),0::bigint,'other member cannot read metrics');
select is((select count(*) from public.workout_sessions),0::bigint,'other member cannot read workouts');
select is((select count(*) from public.workout_sets),0::bigint,'other member cannot read sets through children');
select is((select count(*) from public.coach_messages),0::bigint,'other member cannot read chat');
select is((select count(*) from public.progress_photos),0::bigint,'other member cannot read photos');
select throws_ok($$insert into public.body_metrics(user_id,bodyweight_kg) values ('11111111-1111-4111-8111-111111111111',71)$$,'42501',null,'other member cannot write metrics');
select throws_ok($$insert into public.coach_messages(conversation_id,user_id,role,content) values ('abababab-abab-4bab-8bab-abababababab',auth.uid(),'user','Injected')$$,'42501',null,'chat cannot reference another owner conversation');
select throws_ok($$insert into public.photo_reviews(user_id,older_photo_id,review_text,confidence) values (auth.uid(),'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd','Injected','low')$$,'42501',null,'review cannot reference another owner photo');
select throws_ok($$insert into public.progress_photos(user_id,storage_path,taken_at) values (auth.uid(),'11111111-1111-4111-8111-111111111111/forged.jpg',current_date)$$,'42501',null,'photo path must belong to metadata owner');

select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select is((select count(*) from public.body_metrics),0::bigint,'admin cannot read member metrics');
select is((select count(*) from public.workout_sessions),0::bigint,'admin cannot read member workouts');
select is((select count(*) from public.progress_photos),0::bigint,'admin cannot read member photos');
select is((select count(*) from public.coach_messages),0::bigint,'admin cannot read member chat');
select throws_ok($$insert into public.workout_sessions(user_id,gym_id) values (auth.uid(),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,'42501',null,'catalog admin cannot log workouts');
select is(public.archive_catalog('gyms','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false),1,'admin can archive gym without foreign-key failure');
select is((select count(*) from public.gym_exercises where archived_at is null),0::bigint,'archiving gym atomically clears availability');
select lives_ok($$insert into public.gyms(name,weight_increment_kg) values ('Privacy Test Gym',2.5)$$,'archived gym names can be reused');
reset role;
select is((select count(*) from public.workout_sets where workout_exercise_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),1::bigint,'archiving preserves workout history');

select * from finish();
rollback;
