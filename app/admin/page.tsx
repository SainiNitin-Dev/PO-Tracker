import { requireAdmin } from "@/lib/auth";
import AdminConsole from "./admin-console";

export default async function AdminPage() {
  const { supabase } = await requireAdmin();
  const [{ data: gyms }, { data: exercises }, { data: gymExercises }] = await Promise.all([
    supabase.from("gyms").select("id,name,weight_increment_kg").is("archived_at", null).order("name"),
    supabase.from("exercises").select("id,name,tracking_type").is("archived_at", null).order("name"),
    supabase.from("gym_exercises").select("id,gym_id,exercise_id,equipment_label").is("archived_at", null)
  ]);
  return <AdminConsole gyms={gyms ?? []} exercises={exercises ?? []} gymExercises={gymExercises ?? []} />;
}
