import { NextResponse } from "next/server";
import { apiError, HttpError, readJson, uuid } from "@/lib/http";
import { requireApiUser } from "@/lib/user";

const endedStatuses = ["completed", "abandoned"];

export async function DELETE(request: Request) {
  try {
    const { supabase, user } = await requireApiUser();
    const body = await readJson(request);
    const sessionId = uuid(body.sessionId, "Workout");

    if (body.exerciseId === undefined) {
      const { data, error } = await supabase
        .from("workout_sessions")
        .delete()
        .eq("id", sessionId)
        .eq("user_id", user.id)
        .in("status", endedStatuses)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data)
        throw new HttpError(404, "This workout is no longer in your history.");
    } else {
      const exerciseId = uuid(body.exerciseId, "Workout exercise");
      const { data: session, error: sessionError } = await supabase
        .from("workout_sessions")
        .select("id")
        .eq("id", sessionId)
        .eq("user_id", user.id)
        .in("status", endedStatuses)
        .maybeSingle();
      if (sessionError) throw sessionError;
      if (!session)
        throw new HttpError(404, "This workout is no longer in your history.");

      // Row-level security also checks ownership through the parent session.
      const { data, error } = await supabase
        .from("workout_exercises")
        .delete()
        .eq("id", exerciseId)
        .eq("session_id", sessionId)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data)
        throw new HttpError(404, "This exercise is no longer in that workout.");
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
