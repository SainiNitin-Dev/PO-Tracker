import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { supabase } = await requireAdmin();
    const body = await request.json();
    if (body.action === "create") {
      const { error } = await supabase.from("muscles").insert({ name: body.name });
      if (error) throw error;
    } else if (body.action === "map") {
      const { error } = await supabase.from("exercise_muscles").upsert({ exercise_id: body.exerciseId, muscle_id: body.muscleId, contribution: Number(body.contribution) }, { onConflict: "exercise_id,muscle_id" });
      if (error) throw error;
    } else throw new Error("Unknown action");
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Could not save mapping" }, { status: 400 }); }
}
