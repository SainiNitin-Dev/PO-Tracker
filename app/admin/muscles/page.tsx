import { requireAdmin } from "@/lib/auth";
import MuscleManager from "./muscle-manager";
export default async function MusclePage() { const { supabase } = await requireAdmin(); const [{ data: muscles }, { data: exercises }, { data: mappings }] = await Promise.all([supabase.from("muscles").select("id,name").order("name"), supabase.from("exercises").select("id,name").order("name"), supabase.from("exercise_muscles").select("exercise_id,muscle_id,contribution")]); return <MuscleManager muscles={muscles ?? []} exercises={exercises ?? []} mappings={mappings ?? []} />; }
