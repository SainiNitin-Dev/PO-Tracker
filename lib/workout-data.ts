import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getSuggestion,
  type SetLog,
  type TrackingType,
} from "@/lib/progression";
import type { ActiveWorkout, WorkoutSet } from "@/lib/workout-types";

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}
const setLog = (set: WorkoutSet): SetLog => ({
  weightKg: set.weight_kg,
  reps: set.reps,
  durationSeconds: set.duration_seconds,
  rir: set.rir,
  setKind: set.set_kind,
});

export async function loadActiveWorkout(
  supabase: SupabaseClient,
  userId: string,
): Promise<ActiveWorkout | null> {
  const { data: session, error } = await supabase
    .from("workout_sessions")
    .select(
      "id,performed_at,notes,bodyweight_kg,gym:gyms(name,weight_increment_kg),day:program_days(name),workout_exercises(id,gym_exercise_id,sort_order,pump_rating,notes,target_sets,rep_min,rep_max,time_target_seconds,program:program_exercises(target_sets,rep_min,rep_max,time_target_seconds),equipment:gym_exercises(equipment_label,exercise:exercises(name,tracking_type)),workout_sets(id,set_number,set_kind,weight_kg,reps,duration_seconds,rir))",
    )
    .eq("user_id", userId)
    .eq("status", "in_progress")
    .order("performed_at")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!session) return null;
  const { data: recent, error: historyError } = await supabase
    .from("workout_sessions")
    .select(
      "id,performed_at,notes,workout_exercises(gym_exercise_id,notes,workout_sets(id,set_number,set_kind,weight_kg,reps,duration_seconds,rir))",
    )
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("performed_at", { ascending: false })
    .limit(60);
  if (historyError) throw historyError;
  const gym = one(session.gym);
  return {
    id: session.id,
    performed_at: session.performed_at,
    notes: session.notes,
    bodyweight_kg: session.bodyweight_kg,
    gymName: gym?.name ?? "Your gym",
    dayName: one(session.day)?.name ?? "Saved workout",
    exercises: [...session.workout_exercises]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((entry) => {
        const equipment = one(entry.equipment);
        const exercise = one(equipment?.exercise);
        const plan = one(entry.program);
        const history = (recent ?? []).flatMap((session) =>
          session.workout_exercises
            .filter((item) => item.gym_exercise_id === entry.gym_exercise_id)
            .map((item) => ({ ...item, sessionNotes: session.notes })),
        );
        const sets = (history[0]?.workout_sets ?? []) as WorkoutSet[];
        const previousSets = (history[1]?.workout_sets ?? []) as WorkoutSet[];
        const trackingType = (exercise?.tracking_type ??
          "reps") as TrackingType;
        const targetSets = entry.target_sets ?? plan?.target_sets ?? 1;
        const repMin = entry.rep_min ?? plan?.rep_min ?? null;
        const repMax = entry.rep_max ?? plan?.rep_max ?? null;
        const timeTargetSeconds =
          entry.time_target_seconds ?? plan?.time_target_seconds ?? null;
        // Compare complete working-set totals only at the same load and set count.
        const lastThree = history
          .slice(0, 3)
          .map((item) =>
            (item.workout_sets as WorkoutSet[]).filter(
              (set) => set.set_kind === "working",
            ),
          );
        const comparable =
          lastThree.length === 3 &&
          lastThree.every(
            (work) =>
              work.length >= targetSets &&
              work.length === lastThree[0].length &&
              work.every((set) => set.weight_kg === lastThree[0][0]?.weight_kg),
          );
        const totals = lastThree.map((work) =>
          work.reduce(
            (sum, set) => sum + Number(set.reps ?? set.duration_seconds ?? 0),
            0,
          ),
        );
        const stalled =
          comparable && totals[0] <= totals[1] && totals[1] <= totals[2];
        return {
          id: entry.id,
          gym_exercise_id: entry.gym_exercise_id,
          name: exercise?.name ?? "Saved exercise",
          equipmentLabel: equipment?.equipment_label ?? null,
          trackingType,
          targetSets,
          repMin,
          repMax,
          timeTargetSeconds,
          pumpRating: entry.pump_rating,
          notes: entry.notes,
          sets: ([...entry.workout_sets] as WorkoutSet[]).sort(
            (a, b) => a.set_number - b.set_number,
          ),
          suggestion: getSuggestion({
            trackingType,
            incrementKg: Number(gym?.weight_increment_kg ?? 2.5),
            targetSets,
            repMin,
            repMax,
            timeTargetSeconds,
            latestSets: sets.map(setLog),
            previousSets: previousSets.map(setLog),
            stalledSessions: stalled ? 3 : 0,
            painNote: /\b(pain|painful|sharp|injury|joint pain)\b/i.test(
              `${history[0]?.sessionNotes ?? ""} ${history[0]?.notes ?? ""}`,
            ),
          }),
        };
      }),
  };
}
