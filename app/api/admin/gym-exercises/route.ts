import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { supabase } = await requireAdmin();
    const { gymId, exerciseId, equipmentLabel } = await request.json();
    const { error } = await supabase.from("gym_exercises").upsert({ gym_id: gymId, exercise_id: exerciseId, equipment_label: equipmentLabel || null }, { onConflict: "gym_id,exercise_id" });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status: 400 }); }
}
