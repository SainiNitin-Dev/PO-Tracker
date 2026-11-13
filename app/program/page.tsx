import { requireUser } from "@/lib/user";
import ProgramEditor from "./program-editor";

export default async function ProgramPage() {
  const { supabase, user } = await requireUser();
  const [programsResult, exerciseResult] = await Promise.all([
    supabase
      .from("programs")
      .select("id,name,is_active")
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
  const programIds = (programsResult.data ?? []).map((program) => program.id);
  const { data: days, error: dayError } = programIds.length
    ? await supabase
        .from("program_days")
        .select("id,program_id,name,weekday,sort_order")
        .in("program_id", programIds)
        .order("sort_order")
    : { data: [], error: null };
  if (dayError) throw dayError;
  const dayIds = (days ?? []).map((day) => day.id);
  const { data: entries, error: entryError } = dayIds.length
    ? await supabase
        .from("program_exercises")
        .select(
          "id,program_day_id,exercise_id,target_sets,rep_min,rep_max,time_target_seconds,sort_order,exercise:exercises(name,tracking_type,archived_at)",
        )
        .in("program_day_id", dayIds)
        .order("sort_order")
    : { data: [], error: null };
  if (entryError) throw entryError;
  return (
    <ProgramEditor
      programs={programsResult.data ?? []}
      days={days ?? []}
      exercises={exerciseResult.data ?? []}
      entries={(entries ?? []).map((entry) => ({
        ...entry,
        exercise: Array.isArray(entry.exercise)
          ? (entry.exercise[0] ?? null)
          : entry.exercise,
      }))}
    />
  );
}
