import { requireAdmin } from "@/lib/auth";
import MuscleManager from "./muscle-manager";
export default async function MusclePage() {
  const { supabase } = await requireAdmin();
  const [muscles, exercises, mappings] = await Promise.all([
    supabase.from("muscles").select("id,name").order("name"),
    supabase
      .from("exercises")
      .select("id,name")
      .is("archived_at", null)
      .order("name"),
    supabase
      .from("exercise_muscles")
      .select("exercise_id,muscle_id,contribution"),
  ]);
  for (const result of [muscles, exercises, mappings])
    if (result.error) throw new Error("Muscle groups could not be loaded.");
  return (
    <MuscleManager
      muscles={muscles.data ?? []}
      exercises={exercises.data ?? []}
      mappings={(mappings.data ?? []).filter((m) =>
        exercises.data?.some((e) => e.id === m.exercise_id),
      )}
    />
  );
}
