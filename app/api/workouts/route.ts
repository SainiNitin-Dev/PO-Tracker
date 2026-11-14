import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/user";
import { apiError, HttpError, readJson, uuid, textValue } from "@/lib/http";
import { loadActiveWorkout } from "@/lib/workout-data";
import {
  optionalTrainingNumber,
  validateSet,
  TrainingValidationError,
} from "@/lib/training-validation";
import type { TrackingType } from "@/lib/progression";

export async function GET() {
  try {
    const { supabase, user } = await requireApiUser();
    return NextResponse.json(
      { workout: await loadActiveWorkout(supabase, user.id) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(
      error instanceof TrainingValidationError
        ? new HttpError(400, error.message)
        : error,
    );
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireApiUser();
    const body = await readJson(request);
    if (body.action === "start") {
      const { error } = await supabase.rpc("start_training_workout", {
        p_gym_id: uuid(body.gymId, "Gym"),
        p_day_id: uuid(body.programDayId, "Training day"),
      });
      if (error) throw error;
      return NextResponse.json({
        workout: await loadActiveWorkout(supabase, user.id),
      });
    }
    if (
      body.action === "set" ||
      body.action === "delete-set" ||
      body.action === "feedback"
    ) {
      const exerciseId = uuid(body.workoutExerciseId, "Exercise");
      const { data: owned, error: ownedError } = await supabase
        .from("workout_exercises")
        .select(
          "id,session:workout_sessions!inner(user_id,status),equipment:gym_exercises(exercise:exercises(tracking_type))",
        )
        .eq("id", exerciseId)
        .eq("session.user_id", user.id)
        .eq("session.status", "in_progress")
        .maybeSingle();
      if (ownedError) throw ownedError;
      if (!owned)
        throw new HttpError(
          404,
          "This workout is no longer open. Refresh to see its latest status.",
        );
      if (body.action === "feedback") {
        const pump = optionalTrainingNumber(
          body.pumpRating,
          "Muscle pump",
          1,
          5,
          true,
        );
        const notes = body.notes
          ? textValue(body.notes, "Exercise notes", { max: 1000 })
          : null;
        const { error } = await supabase.rpc("save_training_feedback", {p_exercise_id: exerciseId, p_pump: pump, p_notes: notes});
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }
      const setId = uuid(body.setId, "Set");
      if (body.action === "delete-set") {
        const { error } = await supabase.rpc("delete_training_set", {p_exercise_id: exerciseId, p_id: setId});
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }
      const equipment = Array.isArray(owned.equipment)
        ? owned.equipment[0]
        : owned.equipment;
      const exercise = Array.isArray(equipment?.exercise)
        ? equipment.exercise[0]
        : equipment?.exercise;
      const values = validateSet(body, exercise?.tracking_type as TrackingType);
      const { data, error } = await supabase.rpc("save_training_set", {
        p_exercise_id: exerciseId,
        p_id: setId,
        p_kind: values.kind,
        p_weight: values.weight,
        p_reps: values.reps,
        p_seconds: values.seconds,
        p_rir: values.rir,
      });
      if (error) throw error;
      return NextResponse.json({ set: data });
    }
    if (body.action === "complete" || body.action === "abandon") {
      const { error } = await supabase.rpc("finish_training_workout", {
        p_id: uuid(body.sessionId, "Workout"),
        p_abandon: body.action === "abandon",
        p_notes: body.notes
          ? textValue(body.notes, "Workout notes", { max: 2000 })
          : "",
        p_bodyweight: optionalTrainingNumber(
          body.bodyweightKg,
          "Body weight",
          20,
          500,
        ),
      });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    throw new HttpError(400, "Unknown workout action.");
  } catch (error) {
    return apiError(
      error instanceof TrainingValidationError
        ? new HttpError(400, error.message)
        : error,
    );
  }
}
