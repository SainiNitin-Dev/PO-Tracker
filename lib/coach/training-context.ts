import type { SupabaseClient } from "@supabase/supabase-js";

// Every numeric value comes directly from a query result; the model only receives this JSON.
export async function trainingSnapshot(supabase: SupabaseClient, userId: string) {
  const [{ data: profile }, { data: recentSessions }, { data: notes }, { data: targets }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", userId).single(),
    supabase.from("workout_sessions").select("id,performed_at,gym:gyms(name)").eq("user_id", userId).eq("status", "completed").order("performed_at", { ascending: false }).limit(10),
    supabase.from("coach_notes").select("note,updated_at").eq("user_id", userId).order("updated_at", { ascending: false }).limit(10),
    supabase.from("volume_targets").select("weekly_min,weekly_max,muscle:muscles(name)").eq("user_id", userId)
  ]);
  return { profile, recentSessions: recentSessions ?? [], durableNotes: notes ?? [], volumeTargets: targets ?? [] };
}
