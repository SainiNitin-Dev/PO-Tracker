import { PGlite } from "@electric-sql/pglite";
import { readdir, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Isolated, ephemeral PostgreSQL. Auth and Storage API behavior is not emulated.
const db = await PGlite.create();
let passed = 0;
const scalar = async (sql, params = []) =>
  Object.values((await db.query(sql, params)).rows[0] ?? {})[0];
const equal = async (label, sql, expected, params = []) => {
  assert.equal(await scalar(sql, params), expected, label);
  passed++;
  console.log(`PASS ${label}`);
};
const denied = async (label, sql, params = []) => {
  let failed = false;
  try {
    await db.query(sql, params);
  } catch {
    failed = true;
  }
  assert.ok(failed, label);
  passed++;
  console.log(`PASS ${label}`);
};
const login = async (id) => {
  await db.exec("reset role; set role authenticated;");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
};
try {
  await db.exec(`create role anon nologin; create role authenticated nologin;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',aud text,role text);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,owner uuid,metadata jsonb);
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql immutable as $$select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1]$$;
    grant usage on schema public,auth,storage to anon,authenticated;
    grant execute on function auth.uid(),storage.foldername(text) to anon,authenticated;
    grant all on storage.objects to authenticated;
    alter default privileges in schema public grant all on tables to anon,authenticated;
    alter default privileges in schema public grant usage,select on sequences to anon,authenticated;`);
  const files = (
    await readdir(new URL("../supabase/migrations/", import.meta.url))
  )
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const sql = await readFile(
      new URL(`../supabase/migrations/${file}`, import.meta.url),
      "utf8",
    );
    try {
      await db.exec(sql);
    } catch (error) {
      console.error(
        `${file}: ${error.message}; position ${error.position}; context ${error.where ?? error.internalQuery ?? ""}`,
      );
      throw error;
    }
    console.log(`MIGRATION ${file}`);
  }
  const a = randomUUID(),
    b = randomUUID(),
    recipient = randomUUID(),
    admin = randomUUID(),
    gym = randomUUID(),
    movement = randomUUID(),
    timed = randomUUID(),
    muscle = randomUUID(),
    triceps = randomUUID(),
    shoulders = randomUUID(),
    equipment = randomUUID(),
    timedEquipment = randomUUID();
  await db.query(
    'insert into auth.users(id,raw_user_meta_data) values($1,\'{"role":"admin","display_name":"Test Member"}\'),($2,\'{}\'),($3,\'{}\')',
    [a, b, admin],
  );
  await db.query("update profiles set role='admin' where id=$1", [admin]);
  await db.query("insert into auth.users(id) values($1)", [recipient]);
  await login(admin);
  await db.query(
    "insert into gyms(id,name,weight_increment_kg) values($1,'Test Gym',2.5)",
    [gym],
  );
  await db.query(
    "insert into exercises(id,name,tracking_type) values($1,'Test Press','reps'),($2,'Test Hold','time')",
    [movement, timed],
  );
  await db.query("insert into muscles(id,name) values($1,'Chest')", [muscle]);
  await db.query(
    "insert into muscles(id,name) values($1,'Triceps'),($2,'Shoulders')",
    [triceps, shoulders],
  );
  const replaceMuscles =
    "select replace_exercise_muscles($1,$2::uuid[],$3::uuid[])";
  await db.query(replaceMuscles, [movement, [muscle], [triceps, shoulders]]);
  const contributions =
    "select string_agg(m.name || ':' || em.contribution, ',' order by m.name) from exercise_muscles em join muscles m on m.id=em.muscle_id where em.exercise_id=$1";
  await equal(
    "save primary and multiple secondary muscles together",
    contributions,
    "Chest:1.00,Shoulders:0.50,Triceps:0.50",
    [movement],
  );
  await denied(
    "invalid muscle leaves previous assignments intact",
    replaceMuscles,
    [movement, [muscle], [randomUUID()]],
  );
  await equal(
    "invalid request preserves the whole previous selection",
    contributions,
    "Chest:1.00,Shoulders:0.50,Triceps:0.50",
    [movement],
  );
  await denied("the same muscle cannot hold both roles", replaceMuscles, [
    movement,
    [muscle],
    [muscle],
  ]);
  await db.query(replaceMuscles, [timed, [shoulders], []]);
  await db.query(replaceMuscles, [movement, [triceps], [muscle]]);
  await equal(
    "edit roles and remove unchecked assignments",
    contributions,
    "Chest:0.50,Triceps:1.00",
    [movement],
  );
  await equal(
    "replacing mappings affects only the selected exercise",
    contributions,
    "Shoulders:1.00",
    [timed],
  );
  await db.query(replaceMuscles, [timed, [], []]);
  await equal("clear all assignments in one save", contributions, null, [
    timed,
  ]);
  await db.query(
    "insert into gym_exercises(id,gym_id,exercise_id) values($1,$2,$3),($4,$2,$5)",
    [equipment, gym, movement, timedEquipment, timed],
  );
  await login(a);
  await denied(
    "member cannot replace exercise muscle assignments",
    replaceMuscles,
    [movement, [], []],
  );
  await equal(
    "signup metadata cannot grant admin",
    "select role::text from profiles where id=auth.uid()",
    "user",
  );
  await denied(
    "role escalation blocked",
    "update profiles set role='admin' where id=auth.uid()",
  );
  await db.exec(
    "update profiles set display_name='Updated' where id=auth.uid()",
  );
  await equal(
    "name update works without recursive policy",
    "select display_name from profiles where id=auth.uid()",
    "Updated",
  );
  await denied(
    "members cannot manage catalog",
    "insert into gyms(name,weight_increment_kg) values('Forbidden',2.5)",
  );
  const plan = await scalar("select save_training_plan(null,'Plan A',true)");
  const day = await scalar("select add_training_day($1,'Push',1)", [plan]);
  await scalar("select add_training_exercise($1,$2,2,6,10,null)", [
    day,
    movement,
  ]);
  await denied(
    "reject wrong target type",
    "select add_training_exercise($1,$2,2,6,10,null)",
    [day, timed],
  );
  const second = await scalar(
    "select add_training_exercise($1,$2,2,null,null,30)",
    [day, timed],
  );
  await db.query("select move_training_item('exercise',$1,-1)", [second]);
  await db.query(
    "update program_exercises set notes='Private note' where id=$1",
    [second],
  );
  const copyPlan = "select copy_member_plan($1,$2,$3)";
  const copyRequest = randomUUID();
  await login(recipient);
  await scalar("select save_training_plan(null,'Recipient plan',true)");
  await denied("a member cannot copy another member's plan", copyPlan, [
    plan,
    b,
    randomUUID(),
  ]);
  await login(a);
  await denied("cannot copy a plan to an admin account", copyPlan, [
    plan,
    admin,
    randomUUID(),
  ]);
  await db.query(copyPlan, [plan, recipient, copyRequest]);
  await db.query(copyPlan, [plan, recipient, copyRequest]);
  await login(recipient);
  await equal(
    "copy retry creates only one separate plan",
    "select count(*)::int from programs where name='Plan A' and not is_active",
    1,
  );
  await equal(
    "recipient's active plan stays active",
    "select name from programs where is_active",
    "Recipient plan",
  );
  await equal(
    "copy preserves the day and weekday",
    "select weekday from program_days where name='Push'",
    1,
  );
  await equal(
    "copy preserves order, sets, rep ranges and timed targets",
    "select string_agg(concat_ws(':',target_sets,rep_min,rep_max,time_target_seconds),',' order by sort_order) from program_exercises",
    "2:30,2:6:10",
  );
  await equal(
    "copy excludes private notes",
    "select count(*)::int from program_exercises where notes is not null",
    0,
  );
  await db.query("update program_exercises set target_sets=3");
  await login(a);
  await equal(
    "editing the copy does not affect the source",
    "select target_sets from program_exercises where id=$1",
    2,
    [second],
  );
  await equal(
    "reordering preserves unique positions",
    "select sort_order from program_exercises where id=$1",
    0,
    [second],
  );
  const workout = await scalar("select start_training_workout($1,$2)", [
    gym,
    day,
  ]);
  await equal(
    "retry start resumes same workout",
    "select start_training_workout($1,$2)",
    workout,
    [gym, day],
  );
  await equal(
    "atomic start creates all exercises",
    "select count(*)::int from workout_exercises where session_id=$1",
    2,
    [workout],
  );
  const we = await scalar(
    "select id from workout_exercises where session_id=$1 and gym_exercise_id=$2",
    [workout, equipment],
  );
  const tw = await scalar(
    "select id from workout_exercises where session_id=$1 and gym_exercise_id=$2",
    [workout, timedEquipment],
  );
  const setId = randomUUID();
  await denied(
    "cannot finish without a working set",
    "select finish_training_workout($1,false,'',null)",
    [workout],
  );
  await db.query("select save_training_feedback($1,3,'Seat position 2')", [we]);
  await equal(
    "exercise feedback persists",
    "select pump_rating from workout_exercises where id=$1",
    3,
    [we],
  );
  const removableSet = randomUUID();
  await db.query("select save_training_set($1,$2,'working',40,8,null,2)", [
    we,
    removableSet,
  ]);
  await db.query("select delete_training_set($1,$2)", [we, removableSet]);
  await equal(
    "last set can be deleted from an open workout",
    "select count(*)::int from workout_sets where workout_exercise_id=$1",
    0,
    [we],
  );
  await db.query("select save_training_set($1,$2,'working',50,8,null,2)", [
    we,
    setId,
  ]);
  await db.query("select save_training_set($1,$2,'working',50,9,null,1)", [
    we,
    setId,
  ]);
  await equal(
    "idempotent save does not duplicate sets",
    "select count(*)::int from workout_sets where workout_exercise_id=$1",
    1,
    [we],
  );
  await equal(
    "set edits persist",
    "select reps from workout_sets where id=$1",
    9,
    [setId],
  );
  await denied(
    "rep sets reject simultaneous duration",
    "select save_training_set($1,$2,'working',50,8,30,1)",
    [we, randomUUID()],
  );
  await db.query(
    "select save_training_set($1,$2,'working',null,null,30,null)",
    [tw, randomUUID()],
  );
  await equal(
    "timed sets save with reps null",
    "select duration_seconds from workout_sets where workout_exercise_id=$1",
    30,
    [tw],
  );
  const conversation = await scalar(
    "insert into coach_conversations(user_id) values(auth.uid()) returning id",
  );
  const photo = await scalar(
    "insert into progress_photos(user_id,storage_path,taken_at) values(auth.uid(),$1,current_date) returning id",
    [`${a}/${randomUUID()}.jpg`],
  );
  await db.query(
    "insert into storage.objects(bucket_id,name) values('progress-photos',$1)",
    [`${a}/private.jpg`],
  );
  await db.exec(
    "insert into body_metrics(user_id,bodyweight_kg) values(auth.uid(),70)",
  );
  await login(b);
  for (const table of [
    "programs",
    "program_days",
    "program_exercises",
    "workout_sessions",
    "workout_exercises",
    "workout_sets",
    "coach_conversations",
    "body_metrics",
    "progress_photos",
  ])
    await equal(
      `other member cannot read ${table}`,
      `select count(*)::int from ${table}`,
      0,
    );
  await equal(
    "other member cannot read private storage",
    "select count(*)::int from storage.objects",
    0,
  );
  await denied(
    "cross-owner conversation link blocked",
    "insert into coach_messages(user_id,conversation_id,role,content) values(auth.uid(),$1,'user','Injection')",
    [conversation],
  );
  await denied(
    "cross-owner photo path blocked",
    "insert into progress_photos(user_id,storage_path,taken_at) values(auth.uid(),$1,current_date)",
    [`${a}/${randomUUID()}.jpg`],
  );
  await denied(
    "cross-owner set mutation blocked",
    "select save_training_set($1,$2,'working',100,10,null,0)",
    [we, setId],
  );
  await login(admin);
  await equal(
    "admin cannot read private workout sets",
    "select count(*)::int from workout_sets",
    0,
  );
  await denied(
    "admin cannot create own training log",
    "insert into workout_sessions(user_id,gym_id) values(auth.uid(),$1)",
    [gym],
  );
  await equal(
    "archive referenced equipment succeeds",
    "select archive_catalog('gym_exercises',$1,false,null)",
    1,
    [equipment],
  );
  await equal(
    "bulk gym archive succeeds",
    "select archive_catalog('gyms',null,true,null)",
    1,
  );
  await db.exec(
    "insert into gyms(name,weight_increment_kg) values('Test Gym',2.5)",
  );
  await equal(
    "archived gym name can be reused",
    "select count(*)::int from gyms where name='Test Gym'",
    2,
  );
  await login(a);
  await equal(
    "archiving preserves saved sets",
    "select count(*)::int from workout_sets",
    2,
  );
  await db.query("select finish_training_workout($1,false,'Good session',70)", [
    workout,
  ]);
  await equal(
    "finish saves workout status",
    "select status::text from workout_sessions where id=$1",
    "completed",
    [workout],
  );
  await denied(
    "finished workout cannot receive sets",
    "select save_training_set($1,$2,'working',50,8,null,1)",
    [we, randomUUID()],
  );
  await denied(
    "finished workout rejects set deletion",
    "select delete_training_set($1,$2)",
    [we, setId],
  );
  await denied(
    "finished workout rejects feedback edits",
    "select save_training_feedback($1,2,'Changed')",
    [we],
  );
  await db.query("delete from programs where id=$1", [plan]);
  await equal(
    "plan deletion keeps workout history",
    "select count(*)::int from workout_sets",
    2,
  );
  const exchange = randomUUID();
  await db.query(
    "select save_coach_exchange($1,'Question','Grounded answer','[]')",
    [exchange],
  );
  await db.query(
    "select save_coach_exchange($1,'Question','Different answer','[]')",
    [exchange],
  );
  await equal(
    "coach exchange saves exactly once",
    "select count(*)::int from coach_messages",
    2,
  );
  await equal(
    "AI allowance reserves one request",
    "select allowed from reserve_ai_request('chat')",
    true,
  );
  await equal(
    "AI cooldown is enforced in database",
    "select allowed from reserve_ai_request('chat')",
    false,
  );
  await scalar("select start_volume_experiment($1,4,1)", [muscle]);
  await denied(
    "duplicate active muscle experiment blocked",
    "select start_volume_experiment($1,4,1)",
    [muscle],
  );
  await db.query("select delete_photo_metadata($1)", [photo]);
  await equal(
    "photo metadata deletion works",
    "select count(*)::int from progress_photos",
    0,
  );
  await db.exec("reset role; set role anon;");
  await equal(
    "anonymous cannot see workout history",
    "select count(*)::int from workout_sessions",
    0,
  );
  console.log(
    `\n${files.length} migrations applied; ${passed} database assertions passed. No external services contacted.`,
  );
} catch (error) {
  console.error(`DATABASE CHECK FAILED: ${error.message}`);
  process.exitCode = 1;
} finally {
  await db.close();
}
