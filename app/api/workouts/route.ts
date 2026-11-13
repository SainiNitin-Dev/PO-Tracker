import { NextResponse } from "next/server";
import { requireUser } from "@/lib/user";
import { getSuggestion } from "@/lib/progression";

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) return String(error.message);
  return "Could not save workout. Please try again.";
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const body = await request.json();
    if (body.action === "suggestion") {
      const { data: prior } = await supabase.from("workout_exercises").select("id,workout_sets(weight_kg,reps,duration_seconds,rir,set_kind),workout_sessions!inner(user_id,status,performed_at,notes)").eq("gym_exercise_id", body.gymExerciseId).eq("workout_sessions.user_id", user.id).eq("workout_sessions.status", "completed").order("performed_at", { referencedTable: "workout_sessions", ascending: false }).limit(1).maybeSingle();
      const session = Array.isArray(prior?.workout_sessions) ? prior?.workout_sessions[0] : prior?.workout_sessions;
      const sets = (prior?.workout_sets ?? []).map((set) => ({ weightKg: set.weight_kg, reps: set.reps, durationSeconds: set.duration_seconds, rir: set.rir, setKind: set.set_kind }));
      return NextResponse.json(getSuggestion({ trackingType: body.trackingType, incrementKg: Number(body.incrementKg), repMin: body.repMin, repMax: body.repMax, timeTargetSeconds: body.timeTargetSeconds, latestSets: sets, painNote: /pain|sharp|joint/i.test(session?.notes ?? "") }));
    }
    if (body.action === "start") {
      const { data: session, error } = await supabase.from("workout_sessions").insert({ user_id: user.id, gym_id: body.gymId, program_day_id: body.programDayId }).select("id").single();
      if (error) throw error;
      const rows = body.exercises.map((exercise: { gymExerciseId: string; programExerciseId: string | null }, index: number) => ({ session_id: session.id, gym_exercise_id: exercise.gymExerciseId, program_exercise_id: exercise.programExerciseId, sort_order: index }));
      const { data: workoutExercises, error: exerciseError } = rows.length ? await supabase.from("workout_exercises").insert(rows).select("id,program_exercise_id") : { data: [], error: null };
      if (exerciseError) throw exerciseError;
      return NextResponse.json({ ...session, workoutExercises });
    }
    if (body.action === "set") {
      const { data: owned } = await supabase.from("workout_exercises").select("id, session:workout_sessions!inner(user_id)").eq("id", body.workoutExerciseId).eq("session.user_id", user.id).single();
      if (!owned) throw new Error("Workout exercise not found");
      const { error } = await supabase.from("workout_sets").upsert({ workout_exercise_id: body.workoutExerciseId, set_number: Number(body.setNumber), set_kind: body.setKind, weight_kg: body.weightKg === "" ? null : Number(body.weightKg), reps: body.reps === "" ? null : Number(body.reps), duration_seconds: body.durationSeconds === "" ? null : Number(body.durationSeconds), rir: body.rir === "" ? null : Number(body.rir) }, { onConflict: "workout_exercise_id,set_number" });
      if (error) throw error; return NextResponse.json({ ok: true });
    }
    if (body.action === "complete") {
      const { error } = await supabase.from("workout_sessions").update({ status: "completed", completed_at: new Date().toISOString(), notes: body.notes || null, bodyweight_kg: body.bodyweightKg ? Number(body.bodyweightKg) : null }).eq("id", body.sessionId).eq("user_id", user.id);
      if (error) throw error; return NextResponse.json({ ok: true });
    }
    throw new Error("Unknown workout action");
  } catch (e) { return NextResponse.json({ error: errorMessage(e) }, { status: 400 }); }
}
