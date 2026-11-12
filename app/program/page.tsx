import { requireUser } from "@/lib/user";
import ProgramEditor from "./program-editor";

export default async function ProgramPage() {
  const { supabase, user } = await requireUser();
  const { data: program } = await supabase.from("programs").select("id,name").eq("user_id", user.id).eq("is_active", true).maybeSingle();
  const [{ data: days }, { data: exercises }] = await Promise.all([
    program ? supabase.from("program_days").select("id,name,weekday,sort_order").eq("program_id", program.id).order("sort_order") : Promise.resolve({ data: [] as never[] }),
    supabase.from("exercises").select("id,name,tracking_type").order("name")
  ]);
  const dayIds = (days ?? []).map((day) => day.id);
  const { data: entries } = dayIds.length ? await supabase.from("program_exercises").select("id,program_day_id,target_sets,rep_min,rep_max,time_target_seconds,sort_order,exercise:exercises(name,tracking_type)").in("program_day_id", dayIds).order("sort_order") : { data: [] };
  const normalizedEntries = (entries ?? []).map((entry) => ({ ...entry, exercise: Array.isArray(entry.exercise) ? entry.exercise[0] ?? null : entry.exercise }));
  return <ProgramEditor program={program} days={days ?? []} exercises={exercises ?? []} entries={normalizedEntries} />;
}
