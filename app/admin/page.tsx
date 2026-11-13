import { requireAdmin } from "@/lib/auth";
import AdminConsole from "./admin-console";
export default async function AdminPage() {
  const { supabase } = await requireAdmin();
  const [gyms, exercises, gymExercises] = await Promise.all([
    supabase
      .from("gyms")
      .select("id,name,weight_increment_kg")
      .is("archived_at", null)
      .order("name"),
    supabase
      .from("exercises")
      .select("id,name,tracking_type")
      .is("archived_at", null)
      .order("name"),
    supabase
      .from("gym_exercises")
      .select("id,gym_id,exercise_id,equipment_label")
      .is("archived_at", null),
  ]);
  for (const result of [gyms, exercises, gymExercises])
    if (result.error)
      throw new Error(
        "The catalog could not be loaded. Check that all database updates are applied.",
      );
  const activeGyms = new Set(gyms.data?.map((g) => g.id));
  const activeExercises = new Set(exercises.data?.map((e) => e.id));
  return (
    <AdminConsole
      gyms={gyms.data ?? []}
      exercises={exercises.data ?? []}
      gymExercises={(gymExercises.data ?? []).filter(
        (g) => activeGyms.has(g.gym_id) && activeExercises.has(g.exercise_id),
      )}
    />
  );
}
