import { requireUser } from "@/lib/user";
import WorkoutLogger from "./workout-logger";

export default async function WorkoutPage() {
  const { supabase, user } = await requireUser();
  const { data: program } = await supabase.from("programs").select("id,name").eq("user_id", user.id).eq("is_active", true).maybeSingle();
  const [{ data: gyms }, { data: days }, { data: gymExercises }] = await Promise.all([
    supabase.from("gyms").select("id,name").order("name"),
    program ? supabase.from("program_days").select("id,name,weekday,sort_order").eq("program_id", program.id).order("sort_order") : Promise.resolve({ data: [] as never[] }),
    supabase.from("gym_exercises").select("id,gym_id,exercise_id,equipment_label,exercise:exercises(name,tracking_type)")
  ]);
  const dayIds = (days ?? []).map((day) => day.id);
  const { data: entries } = dayIds.length ? await supabase.from("program_exercises").select("id,program_day_id,exercise_id,target_sets,rep_min,rep_max,time_target_seconds,sort_order,exercise:exercises(name,tracking_type)").in("program_day_id", dayIds).order("sort_order") : { data: [] };
  const normalizedEntries = (entries ?? []).map((entry) => ({ ...entry, exercise: Array.isArray(entry.exercise) ? entry.exercise[0] ?? null : entry.exercise }));
  const normalizedGymExercises = (gymExercises ?? []).map((item) => ({ ...item, exercise: Array.isArray(item.exercise) ? item.exercise[0] ?? null : item.exercise }));
  return <WorkoutLogger gyms={gyms ?? []} days={days ?? []} entries={normalizedEntries} gymExercises={normalizedGymExercises} />;
}
