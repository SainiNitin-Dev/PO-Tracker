export type TrackingType =
  "reps" | "bodyweight_reps" | "time" | "weighted_time";
export type SetLog = {
  weightKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
  rir: number | null;
  setKind: "warmup" | "working" | "drop";
};
export type ProgressionInput = {
  trackingType: TrackingType;
  incrementKg: number;
  targetSets?: number;
  repMin?: number | null;
  repMax?: number | null;
  timeTargetSeconds?: number | null;
  latestSets: SetLog[];
  previousSets?: SetLog[];
  painNote?: boolean;
  stalledSessions?: number;
};
export type Suggestion = {
  action:
    | "new_machine"
    | "increase_weight"
    | "add_rep"
    | "add_time"
    | "hold"
    | "deload"
    | "add_load_or_variation";
  message: string;
};

/** Epley estimate, shown only for loaded rep sets of 1–12 reps. */
export function estimateOneRepMax(weightKg: number, reps: number) {
  if (
    !Number.isFinite(weightKg) ||
    weightKg <= 0 ||
    !Number.isInteger(reps) ||
    reps < 1 ||
    reps > 12
  )
    return 0;
  return reps === 1
    ? weightKg
    : Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}
export function getSuggestion(input: ProgressionInput): Suggestion {
  if (input.painNote)
    return {
      action: "hold",
      message:
        "You noted pain last time. Stop any painful movement and get professional advice if pain continues. Do not increase the load.",
    };
  const work = input.latestSets.filter((set) => set.setKind === "working");
  if (!work.length)
    return {
      action: "new_machine",
      message:
        "No working sets recorded on this equipment yet. Start with a comfortable load and find your range.",
    };
  if (work.length < (input.targetSets ?? 1))
    return {
      action: "hold",
      message:
        "Complete your planned working sets at the current load before increasing it.",
    };
  if ((input.stalledSessions ?? 0) >= 3)
    return {
      action: "deload",
      message:
        "Your last three sessions have not improved at this load. Consider a lighter session, then build back up.",
    };
  const timed =
    input.trackingType === "time" || input.trackingType === "weighted_time";
  if (timed) {
    if (!input.timeTargetSeconds)
      return {
        action: "hold",
        message:
          "Set a time target in your plan to get a progression suggestion.",
      };
    const allTarget = work.every(
      (set) => (set.durationSeconds ?? 0) >= input.timeTargetSeconds!,
    );
    if (!allTarget)
      return {
        action: "add_time",
        message:
          "Keep the same load or variation and work towards your time target.",
      };
    return {
      action: "add_load_or_variation",
      message:
        input.trackingType === "weighted_time"
          ? `You reached the time target. Try one weight step (${input.incrementKg} kg) if your form stays comfortable.`
          : "You reached the time target. Try a slightly harder variation, keeping good form.",
    };
  }
  if (!input.repMin || !input.repMax)
    return {
      action: "hold",
      message: "Set a rep range in your plan to get a progression suggestion.",
    };
  const failed = work.some((set) => (set.reps ?? 0) < input.repMin!);
  const previousWork = (input.previousSets ?? []).filter(
    (set) => set.setKind === "working",
  );
  const previousFailed = previousWork.some(
    (set) => (set.reps ?? 0) < input.repMin!,
  );
  if (failed)
    return {
      action: "hold",
      message: previousFailed
        ? "You missed the minimum reps in two sessions. Keep the load steady; review rest, recovery and form before increasing."
        : "Keep this load and reach the bottom of your rep range before adding weight.",
    };
  const allTopWithRir = work.every(
    (set) =>
      (set.reps ?? 0) >= input.repMax! && set.rir !== null && set.rir > 0,
  );
  if (input.trackingType === "bodyweight_reps")
    return allTopWithRir
      ? {
          action: "add_load_or_variation",
          message:
            "You reached the top of your range with reps left. Try a small added load or a harder variation.",
        }
      : {
          action: "add_rep",
          message:
            "Keep the same variation and aim for one more rep across your working sets.",
        };
  const equalLoads = work.every(
    (set) => set.weightKg !== null && set.weightKg === work[0].weightKg,
  );
  if (allTopWithRir && equalLoads && input.incrementKg > 0)
    return {
      action: "increase_weight",
      message: `Try ${Math.round(((work[0].weightKg ?? 0) + input.incrementKg) * 100) / 100} kg next time: one weight step (${input.incrementKg} kg). Build back up through your rep range.`,
    };
  return {
    action: "add_rep",
    message:
      "Keep the same weight and aim for one more rep across your working sets. Record reps left so the next suggestion can account for effort.",
  };
}
