import { requireUser } from "@/lib/user";
import {
  summarizeProgress,
  compareExperiment,
  type ProgressSession,
  type ProgressSet,
  type Experiment,
} from "@/lib/progress-summary";
import ProgressDashboard from "./progress-dashboard";
type Relation<T> = T | T[] | null;
const one = <T,>(value: Relation<T>) =>
  Array.isArray(value) ? value[0] : value;
type RawSession = {
  performed_at: string;
  workout_exercises: {
    pump_rating: number | null;
    gym_exercise_id: string;
    gym_exercises: Relation<{
      exercise_id: string;
      exercises: Relation<{ name: string; tracking_type: string }>;
    }>;
    workout_sets: ProgressSet[];
  }[];
};
export default async function ProgressPage() {
  const { supabase, user } = await requireUser();
  const now = Date.now();
  const [muscles, targets, experiments, sessions, mappings] = await Promise.all(
    [
      supabase.from("muscles").select("id,name").order("name"),
      supabase
        .from("volume_targets")
        .select("muscle_id,weekly_min,weekly_max")
        .eq("user_id", user.id),
      supabase
        .from("volume_experiments")
        .select(
          "id,muscle_id,baseline_weeks,added_sets,started_on,status,ended_at",
        )
        .eq("user_id", user.id)
        .order("started_on", { ascending: false })
        .limit(50),
      supabase
        .from("workout_sessions")
        .select(
          "performed_at,workout_exercises(pump_rating,gym_exercise_id,gym_exercises(exercise_id,exercises(name,tracking_type)),workout_sets(set_kind,weight_kg,reps,rir))",
        )
        .eq("user_id", user.id)
        .eq("status", "completed")
        .gte("performed_at", new Date(now - 180 * 86400000).toISOString())
        .order("performed_at", { ascending: false })
        .limit(300),
      supabase
        .from("exercise_muscles")
        .select("exercise_id,muscle_id,contribution"),
    ],
  );
  for (const result of [muscles, targets, experiments, sessions, mappings])
    if (result.error) throw new Error("Your progress could not be loaded.");
  const records: ProgressSession[] = (
    (sessions.data ?? []) as unknown as RawSession[]
  ).map((s) => ({
    performed_at: s.performed_at,
    exercises: s.workout_exercises.map((e) => {
      const gym = one(e.gym_exercises);
      const movement = one(gym?.exercises ?? null);
      return {
        equipmentId: e.gym_exercise_id,
        exerciseId: gym?.exercise_id ?? "",
        name: movement?.name ?? "Archived Exercise",
        trackingType: movement?.tracking_type ?? "",
        pump: e.pump_rating,
        sets: e.workout_sets,
      };
    }),
  }));
  const data = summarizeProgress(records, mappings.data ?? [], now);
  const trials = ((experiments.data ?? []) as Experiment[]).map((e) => ({
    ...e,
    comparison: compareExperiment(e, records, mappings.data ?? [], now),
    incomplete:
      Date.parse(e.started_on) < now - 180 * 86400000 || records.length === 300,
  }));
  return (
    <ProgressDashboard
      muscles={muscles.data ?? []}
      targets={targets.data ?? []}
      experiments={trials}
      summary={data}
    />
  );
}
