import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/user";
import { apiError, HttpError, numberValue, readJson, uuid } from "@/lib/http";
export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireApiUser();
    const body = await readJson(request);
    const id = uuid(body.exerciseId, "Workout exercise");
    const { data, error: loadError } = await supabase
      .from("workout_exercises")
      .select("id,session:workout_sessions!inner(user_id,status)")
      .eq("id", id)
      .eq("session.user_id", user.id)
      .eq("session.status", "completed")
      .maybeSingle();
    if (loadError) throw loadError;
    if (!data)
      throw new HttpError(404, "Choose an exercise from a completed workout.");
    const { error } = await supabase.from("exercise_soreness_feedback").upsert(
      {
        workout_exercise_id: id,
        soreness_rating: numberValue(body.rating, "Soreness", {
          min: 1,
          max: 5,
          integer: true,
        }),
        recorded_at: new Date().toISOString(),
      },
      { onConflict: "workout_exercise_id" },
    );
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
