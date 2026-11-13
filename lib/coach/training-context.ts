import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildTrainingFacts,
  type SessionRecord,
  type TrainingSnapshot,
} from "./training-facts";

/** Read through the member's authenticated client; never use the service-role key. */
export async function trainingSnapshot(
  supabase: SupabaseClient,
  userId: string,
  question = "",
): Promise<TrainingSnapshot> {
  const since = new Date(Date.now() - 84 * 86400000).toISOString();
  const results = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", userId).single(),
    supabase
      .from("workout_sessions")
      .select(
        "id,performed_at,notes,gym:gyms(name),workout_exercises(id,gym_exercise_id,pump_rating,notes,gym_exercises(equipment_label,exercises(name,tracking_type,exercise_muscles(contribution,muscles(name)))),workout_sets(set_kind,weight_kg,reps,duration_seconds,rir),exercise_soreness_feedback(soreness_rating))",
      )
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("performed_at", since)
      .order("performed_at", { ascending: false })
      .limit(48),
    supabase
      .from("coach_notes")
      .select("id,note,updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(20),
    supabase
      .from("volume_targets")
      .select("weekly_min,weekly_max,muscles(name)")
      .eq("user_id", userId)
      .limit(40),
    supabase
      .from("body_metrics")
      .select("recorded_at,bodyweight_kg")
      .eq("user_id", userId)
      .order("recorded_at", { ascending: false })
      .limit(12),
    supabase
      .from("programs")
      .select(
        "name,program_days(name,weekday,sort_order,program_exercises(target_sets,rep_min,rep_max,time_target_seconds,sort_order,exercises(name)))",
      )
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("volume_experiments")
      .select("baseline_weeks,added_sets,started_on,status,muscles(name)")
      .eq("user_id", userId)
      .order("started_on", { ascending: false })
      .limit(8),
  ]);
  for (const result of results)
    if (result.error)
      throw new Error(
        "Your training records could not be loaded. Please try again.",
      );
  const [profile, sessions, notes, targets, metrics, program, experiments] =
    results;
  return buildTrainingFacts({
    name: profile.data?.display_name ?? "",
    sessions: (sessions.data ?? []) as unknown as SessionRecord[],
    notes: (notes.data ?? []) as {
      id: string;
      note: string;
      updated_at: string;
    }[],
    targets: targets.data ?? [],
    metrics: metrics.data ?? [],
    program: program.data,
    experiments: experiments.data ?? [],
    question,
  });
}
