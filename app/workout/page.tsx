import { requireUser } from "@/lib/user";
import { loadActiveWorkout } from "@/lib/workout-data";
import WorkoutLogger from "./workout-logger";

export default async function WorkoutPage() {
  const { supabase, user } = await requireUser();
  const [programResult, gymResult, availabilityResult, workout] =
    await Promise.all([
      supabase
        .from("programs")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle(),
      supabase
        .from("gyms")
        .select("id,name")
        .is("archived_at", null)
        .order("name"),
      supabase
        .from("gym_exercises")
        .select("gym_id,exercise_id")
        .is("archived_at", null),
      loadActiveWorkout(supabase, user.id),
    ]);
  for (const result of [programResult, gymResult, availabilityResult])
    if (result.error)
      throw new Error(
        "We could not load your training setup. Please try again.",
      );
  const { data: days, error: daysError } = programResult.data
    ? await supabase
        .from("program_days")
        .select("id,name,weekday,sort_order")
        .eq("program_id", programResult.data.id)
        .order("sort_order")
    : { data: [], error: null };
  if (daysError) throw daysError;
  const ids = (days ?? []).map((day) => day.id);
  const { data: entries, error: entriesError } = ids.length
    ? await supabase
        .from("program_exercises")
        .select(
          "id,program_day_id,exercise_id,exercise:exercises(name,archived_at)",
        )
        .in("program_day_id", ids)
        .order("sort_order")
    : { data: [], error: null };
  if (entriesError) throw entriesError;
  const options = {
    userId: user.id,
    gyms: gymResult.data ?? [],
    days: days ?? [],
    availability: availabilityResult.data ?? [],
    entries: (entries ?? []).map((entry) => {
      const exercise = Array.isArray(entry.exercise)
        ? entry.exercise[0]
        : entry.exercise;
      return {
        id: entry.id,
        program_day_id: entry.program_day_id,
        exercise_id: entry.exercise_id,
        name: exercise?.name ?? "Saved exercise",
        archived: Boolean(exercise?.archived_at),
      };
    }),
  };
  return <WorkoutLogger options={options} initialWorkout={workout} />;
}
