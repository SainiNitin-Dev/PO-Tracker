import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/user";
import { apiError, HttpError, readJson, numberValue, uuid } from "@/lib/http";
import {
  validateTargets,
  TrainingValidationError,
} from "@/lib/training-validation";
import type { TrackingType } from "@/lib/progression";

async function saveExercise(request: Request) {
  try {
    const { supabase } = await requireApiUser();
    const body = await readJson(request);
    if (body.direction !== undefined && request.method === "PATCH") {
      const direction = numberValue(body.direction, "Direction", {
        min: -1,
        max: 1,
        integer: true,
      });
      if (!direction) throw new HttpError(400, "Choose up or down.");
      const { error } = await supabase.rpc("move_training_item", {
        p_kind: "exercise",
        p_id: uuid(body.id, "Exercise"),
        p_direction: direction,
      });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    const exerciseId = uuid(body.exerciseId, "Exercise");
    const { data: exercise, error: exerciseError } = await supabase
      .from("exercises")
      .select("tracking_type,archived_at")
      .eq("id", exerciseId)
      .maybeSingle();
    if (exerciseError) throw exerciseError;
    if (!exercise) throw new HttpError(404, "Exercise not found.");
    if (exercise.archived_at && request.method === "POST")
      throw new HttpError(
        400,
        "This exercise is no longer in the library. Choose another exercise.",
      );
    const targets = validateTargets(
      body,
      exercise.tracking_type as TrackingType,
    );
    if (request.method === "POST") {
      const { data, error } = await supabase.rpc("add_training_exercise", {
        p_day_id: uuid(body.programDayId, "Day"),
        p_exercise_id: exerciseId,
        p_sets: targets.target_sets,
        p_min: targets.rep_min,
        p_max: targets.rep_max,
        p_seconds: targets.time_target_seconds,
      });
      if (error) throw error;
      return NextResponse.json({ id: data });
    }
    const { data, error } = await supabase
      .from("program_exercises")
      .update({ exercise_id: exerciseId, ...targets })
      .eq("id", uuid(body.id, "Exercise"))
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data)
      throw new HttpError(404, "This plan exercise is no longer available.");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(
      error instanceof TrainingValidationError
        ? new HttpError(400, error.message)
        : error,
    );
  }
}
export const POST = saveExercise;
export const PATCH = saveExercise;
export async function DELETE(request: Request) {
  try {
    const { supabase } = await requireApiUser();
    const body = await readJson(request);
    const { data, error } = await supabase
      .from("program_exercises")
      .delete()
      .eq("id", uuid(body.id, "Exercise"))
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data)
      throw new HttpError(404, "This plan exercise is no longer available.");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
