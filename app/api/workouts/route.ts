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

const optionalNotes = (value: unknown, label: string, max: number) =>
  textValue(value ?? "", label, { min: 0, max });

function exerciseFeedback(body: Record<string, unknown>) {
  return {
    exercise_id: uuid(body.workoutExerciseId, "Exercise").toLowerCase(),
    pump: optionalTrainingNumber(body.pumpRating, "Muscle pump", 1, 5, true),
    notes: optionalNotes(body.notes, "Exercise notes", 1000) || null,
  };
}

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
    if (body.action === "swap") {
      const { error } = await supabase.rpc("swap_training_exercise", {
        p_exercise_id: uuid(body.workoutExerciseId, "Exercise"),
        p_expected_equipment: uuid(
          body.expectedEquipmentId,
          "Current equipment",
        ),
        p_replacement: uuid(body.replacementId, "Replacement"),
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
        const { pump, notes } = exerciseFeedback(body);
        const { error } = await supabase.rpc("save_training_feedback", {
          p_exercise_id: exerciseId,
          p_pump: pump,
          p_notes: notes,
        });
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }
      const setId = uuid(body.setId, "Set");
      if (body.action === "delete-set") {
        const { error } = await supabase.rpc("delete_training_set", {
          p_exercise_id: exerciseId,
          p_id: setId,
        });
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
      const input = body.feedback ?? [];
      if (!Array.isArray(input) || input.length > 101)
        throw new HttpError(
          400,
          "Check the exercise feedback for this workout.",
        );
      const feedback = input.map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item))
          throw new HttpError(
            400,
            "Check the exercise feedback for this workout.",
          );
        return exerciseFeedback(item);
      });
      if (
        new Set(feedback.map((item) => item.exercise_id)).size !==
        feedback.length
      )
        throw new HttpError(400, "Each exercise can have one feedback entry.");
      const args = {
        p_id: uuid(body.sessionId, "Workout"),
        p_abandon: body.action === "abandon",
        p_notes: optionalNotes(body.notes, "Workout notes", 2000),
        p_bodyweight: optionalTrainingNumber(
          body.bodyweightKg,
          "Body weight",
          20,
          500,
        ),
      };
      const { error } = feedback.length
        ? await supabase.rpc("finish_training_workout_with_feedback", {
            ...args,
            p_feedback: feedback,
          })
        : await supabase.rpc("finish_training_workout", args);
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
