import { requireAdmin } from "@/lib/auth";
import MuscleManager from "./muscle-manager";
export default async function MusclePage() {
  const { supabase } = await requireAdmin();
  const [muscles, exercises] = await Promise.all([
    supabase.from("muscles").select("id,name").order("name"),
    supabase
      .from("exercises")
      .select("id,name,exercise_muscles(muscle_id,contribution)")
      .is("archived_at", null)
      .order("name"),
  ]);
  for (const result of [muscles, exercises])
    if (result.error) throw new Error("Muscle groups could not be loaded.");
  return (
    <MuscleManager
      muscles={muscles.data ?? []}
      exercises={exercises.data ?? []}
      mappings={(exercises.data ?? []).flatMap((exercise) =>
        exercise.exercise_muscles.map((mapping) => ({
          ...mapping,
          exercise_id: exercise.id,
        })),
      )}
    />
  );
}
