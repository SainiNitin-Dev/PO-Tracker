import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/user";
import { apiError, HttpError, readJson, textValue, uuid } from "@/lib/http";
import {
  optionalTrainingNumber,
  TrainingValidationError,
  validateSet,
  validateTargets,
} from "@/lib/training-validation";
import type { TrackingType } from "@/lib/progression";

const asRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || !value || Array.isArray(value)) {
    throw new HttpError(400, "This offline workout could not be read.");
  }
  return value as Record<string, unknown>;
};

const timestamp = (value: unknown) => {
  const date = typeof value === "string" ? Date.parse(value) : NaN;
  if (!Number.isFinite(date))
    throw new HttpError(400, "This offline workout has an invalid date.");
  return new Date(date).toISOString();
};

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireApiUser();
    const body = await readJson(request);
    if (body.userId !== user.id)
      throw new HttpError(
        403,
        "Sign in with the account that downloaded this workout.",
      );
    if (
      !Array.isArray(body.exercises) ||
      body.exercises.length < 1 ||
      body.exercises.length > 101
    ) {
      throw new HttpError(
        400,
        "This offline workout has an invalid exercise list.",
      );
    }
    const setIds = new Set<string>();
    const exercises = body.exercises.map((value) => {
      const exercise = asRecord(value);
      if (!Array.isArray(exercise.sets) || exercise.sets.length > 100)
        throw new HttpError(400, "An exercise contains too many sets.");
      const trackingType = exercise.trackingType as TrackingType;
      if (
        !["reps", "bodyweight_reps", "time", "weighted_time"].includes(
          trackingType,
        )
      )
        throw new HttpError(400, "An exercise has an invalid tracking type.");
      const targets = validateTargets(exercise, trackingType);
      return {
        equipmentId: uuid(exercise.equipmentId, "Equipment"),
        trackingType,
        targetSets: targets.target_sets,
        repMin: targets.rep_min,
        repMax: targets.rep_max,
        timeTargetSeconds: targets.time_target_seconds,
        sets: exercise.sets.map((raw) => {
          const set = asRecord(raw);
          const id = uuid(set.id, "Set").toLowerCase();
          if (setIds.has(id))
            throw new HttpError(
              400,
              "This offline workout has a duplicate set.",
            );
          setIds.add(id);
          return { id, ...validateSet(set, trackingType) };
        }),
      };
    });
    const { data, error } = await supabase.rpc("import_offline_workout", {
      p_id: uuid(body.id, "Workout"),
      p_gym: uuid(body.gymId, "Gym"),
      p_day: uuid(body.dayId, "Plan day"),
      p_started: timestamp(body.startedAt),
      p_finished: timestamp(body.finishedAt),
      p_notes: body.notes
        ? textValue(body.notes, "Workout notes", { max: 2000 })
        : "",
      p_bodyweight: optionalTrainingNumber(
        body.bodyweightKg,
        "Body weight",
        20,
        500,
      ),
      p_exercises: exercises,
    });
    if (error) throw error;
    return NextResponse.json(
      { id: data },
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
