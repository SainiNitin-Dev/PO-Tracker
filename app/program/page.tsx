import { requireUser } from "@/lib/user";
import ProgramEditor from "./program-editor";

export default async function ProgramPage() {
  const { supabase, user } = await requireUser();
  const [programsResult, exerciseResult] = await Promise.all([
    supabase
      .from("programs")
      .select(
        "id,name,is_active,program_days(id,program_id,name,weekday,sort_order,program_exercises(id,program_day_id,exercise_id,target_sets,rep_min,rep_max,time_target_seconds,sort_order,exercise:exercises(name,tracking_type,archived_at)))",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("exercises")
      .select("id,name,tracking_type")
      .is("archived_at", null)
      .order("name"),
  ]);
  if (programsResult.error || exerciseResult.error)
    throw new Error("We could not load your plans. Please try again.");
  const programs = programsResult.data ?? [];
  const days = programs.flatMap((program) => program.program_days);
  const entries = days.flatMap((day) => day.program_exercises);
  return (
    <ProgramEditor
      programs={programs.map(({ id, name, is_active }) => ({
        id,
        name,
        is_active,
      }))}
      days={days.map(({ id, program_id, name, weekday, sort_order }) => ({
        id,
        program_id,
        name,
        weekday,
        sort_order,
      }))}
      exercises={exerciseResult.data ?? []}
      entries={entries.map((entry) => ({
        ...entry,
        exercise: Array.isArray(entry.exercise)
          ? (entry.exercise[0] ?? null)
          : entry.exercise,
      }))}
    />
  );
}
