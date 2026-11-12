import { requireUser } from "@/lib/user";
import ProgressDashboard from "./progress-dashboard";

function weekStart() { const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - ((date.getDay() + 6) % 7)); return date.toISOString(); }
export default async function ProgressPage() {
  const { supabase, user } = await requireUser();
  const [{ data: muscles }, { data: targets }, { data: experiments }, { data: sessions }] = await Promise.all([
    supabase.from("muscles").select("id,name").order("name"),
    supabase.from("volume_targets").select("muscle_id,weekly_min,weekly_max").eq("user_id", user.id),
    supabase.from("volume_experiments").select("id,muscle_id,baseline_weeks,added_sets,started_on,status").eq("user_id", user.id).order("started_on", { ascending: false }),
    supabase.from("workout_sessions").select("id").eq("user_id", user.id).eq("status", "completed").gte("performed_at", weekStart())
  ]);
  const sessionIds = (sessions ?? []).map((s) => s.id);
  const { data: workoutExercises } = sessionIds.length ? await supabase.from("workout_exercises").select("id,gym_exercise_id").in("session_id", sessionIds) : { data: [] };
  const workoutIds = (workoutExercises ?? []).map((we) => we.id);
  const [{ data: workingSets }, { data: gymExercises }] = await Promise.all([
    workoutIds.length ? supabase.from("workout_sets").select("workout_exercise_id").in("workout_exercise_id", workoutIds).eq("set_kind", "working") : Promise.resolve({ data: [] as never[] }),
    (workoutExercises ?? []).length ? supabase.from("gym_exercises").select("id,exercise_id").in("id", (workoutExercises ?? []).map((we) => we.gym_exercise_id)) : Promise.resolve({ data: [] as never[] })
  ]);
  const mappings = (gymExercises ?? []).length ? await supabase.from("exercise_muscles").select("exercise_id,muscle_id,contribution").in("exercise_id", (gymExercises ?? []).map((ge) => ge.exercise_id)) : { data: [] };
  const exerciseForWorkout = new Map((workoutExercises ?? []).map((we) => [we.id, (gymExercises ?? []).find((ge) => ge.id === we.gym_exercise_id)?.exercise_id]));
  const volume: Record<string, number> = {};
  for (const set of workingSets ?? []) for (const mapping of mappings.data ?? []) if (exerciseForWorkout.get(set.workout_exercise_id) === mapping.exercise_id) volume[mapping.muscle_id] = (volume[mapping.muscle_id] ?? 0) + Number(mapping.contribution);
  return <ProgressDashboard muscles={muscles ?? []} targets={targets ?? []} experiments={experiments ?? []} volume={volume} />;
}
