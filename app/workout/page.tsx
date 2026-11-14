import { requireUser } from "@/lib/user";
import { loadActiveWorkout } from "@/lib/workout-data";
import WorkoutLogger from "./workout-logger";

export default async function WorkoutPage() {
  const { supabase, user } = await requireUser();
  const [programResult, gymResult, availabilityResult, workout] =
    await Promise.all([
      supabase
        .from("programs")
        .select(
          "program_days(id,name,weekday,sort_order,program_exercises(id,program_day_id,exercise_id,sort_order,exercise:exercises(name,archived_at)))",
        )
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
  const days = [...(programResult.data?.program_days ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  const entries = days
    .flatMap((day) => day.program_exercises)
    .sort((a, b) => a.sort_order - b.sort_order);
  const plannedExercises = new Set(entries.map((entry) => entry.exercise_id));
  const options = {
    userId: user.id,
    gyms: gymResult.data ?? [],
    days: days.map(({ id, name, weekday }) => ({ id, name, weekday })),
    availability: (availabilityResult.data ?? []).filter((entry) =>
      plannedExercises.has(entry.exercise_id),
    ),
    entries: entries.map((entry) => {
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
