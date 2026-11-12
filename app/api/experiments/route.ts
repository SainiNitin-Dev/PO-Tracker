import { NextResponse } from "next/server";
import { requireUser } from "@/lib/user";

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const body = await request.json();
    const { error } = await supabase.from("volume_experiments").insert({ user_id: user.id, muscle_id: body.muscleId, baseline_weeks: Number(body.baselineWeeks), added_sets: Number(body.addedSets) });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Could not start experiment" }, { status: 400 }); }
}
