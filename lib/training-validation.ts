import type { TrackingType } from "./progression";
export class TrainingValidationError extends Error {}
export function optionalTrainingNumber(
  value: unknown,
  label: string,
  min: number,
  max: number,
  integer = false,
): number | null {
  if (value === "" || value === undefined || value === null) return null;
  if (typeof value !== "number" && typeof value !== "string")
    throw new TrainingValidationError(`${label} must be a number.`);
  const number = Number(value);
  if (
    !Number.isFinite(number) ||
    number < min ||
    number > max ||
    (integer && !Number.isInteger(number))
  )
    throw new TrainingValidationError(
      `${label} must be ${integer ? "a whole number " : ""}between ${min} and ${max}.`,
    );
  return number;
}
export function validateSet(body: Record<string, unknown>, type: TrackingType) {
  if (!["reps", "bodyweight_reps", "time", "weighted_time"].includes(type)) throw new TrainingValidationError("This exercise’s tracking type is unavailable. Refresh and try again.");
  const timed = type === "time" || type === "weighted_time";
  const weight = optionalTrainingNumber(body.weightKg, "Weight", 0, 9999.99);
  const reps = optionalTrainingNumber(body.reps, "Reps", 1, 1000, true);
  const seconds = optionalTrainingNumber(
    body.durationSeconds,
    "Seconds",
    1,
    86400,
    true,
  );
  const rir = optionalTrainingNumber(body.rir, "Reps left", 0, 10, true);
  if (
    timed
      ? seconds === null || reps !== null
      : reps === null || seconds !== null
  )
    throw new TrainingValidationError(
      timed
        ? "Enter seconds only for this exercise."
        : "Enter reps only for this exercise.",
    );
  if ((type === "reps" || type === "weighted_time") && weight === null)
    throw new TrainingValidationError(
      "Enter the weight used for this exercise.",
    );
  if (!["working", "warmup", "drop"].includes(String(body.setKind)))
    throw new TrainingValidationError("Choose a valid set type.");
  return {
    weight,
    reps,
    seconds,
    rir,
    kind: body.setKind as "working" | "warmup" | "drop",
  };
}
export function validateTargets(
  body: Record<string, unknown>,
  type: TrackingType,
) {
  const sets = optionalTrainingNumber(
    body.targetSets,
    "Working sets",
    1,
    12,
    true,
  );
  if (sets === null)
    throw new TrainingValidationError("Enter the number of working sets.");
  const timed = type === "time" || type === "weighted_time";
  const repMin = timed
    ? null
    : optionalTrainingNumber(body.repMin, "Minimum reps", 1, 1000, true);
  const repMax = timed
    ? null
    : optionalTrainingNumber(body.repMax, "Maximum reps", 1, 1000, true);
  const seconds = timed
    ? optionalTrainingNumber(
        body.timeTargetSeconds,
        "Target seconds",
        1,
        86400,
        true,
      )
    : null;
  if (timed && seconds === null)
    throw new TrainingValidationError("Enter a time target.");
  if (!timed && (repMin === null || repMax === null || repMax < repMin))
    throw new TrainingValidationError(
      "Enter a rep range with the maximum at least as high as the minimum.",
    );
  return {
    target_sets: sets,
    rep_min: repMin,
    rep_max: repMax,
    time_target_seconds: seconds,
  };
}
