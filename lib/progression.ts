export type SetLog = { weightKg: number | null; reps: number | null; durationSeconds: number | null; rir: number | null; setKind: "warmup" | "working" | "drop" };
export type ProgressionInput = { trackingType: "reps" | "bodyweight_reps" | "time" | "weighted_time"; incrementKg: number; repMin?: number | null; repMax?: number | null; timeTargetSeconds?: number | null; latestSets: SetLog[]; previousSets?: SetLog[]; painNote?: boolean; stalledSessions?: number };
export type Suggestion = { action: "new_machine" | "increase_weight" | "add_rep" | "add_time" | "hold" | "deload" | "add_load_or_variation"; message: string };

export function estimateOneRepMax(weightKg: number, reps: number) { return Math.round(weightKg * (1 + reps / 30) * 10) / 10; }
export function getSuggestion(input: ProgressionInput): Suggestion {
  if (!input.latestSets.length) return { action: "new_machine", message: "New machine—find your working weight before a progression suggestion." };
  if (input.painNote) return { action: "hold", message: "Pain was noted last session. Hold this movement; do not increase weight." };
  if ((input.stalledSessions ?? 0) >= 3) return { action: "deload", message: "Several sessions have stalled. Consider a small deload before building back up." };
  const work = input.latestSets.filter((set) => set.setKind === "working");
  if (!work.length) return { action: "hold", message: "Log working sets first to receive a progression suggestion." };
  const failed = input.trackingType === "time" || input.trackingType === "weighted_time" ? work.some((set) => (set.durationSeconds ?? 0) < (input.timeTargetSeconds ?? 0)) : work.some((set) => (set.reps ?? 0) < (input.repMin ?? 1));
  if (failed) return { action: "hold", message: "Stay at the same load and first reach the bottom of the target range." };
  if (input.trackingType === "time" || input.trackingType === "weighted_time") {
    const allTarget = work.every((set) => (set.durationSeconds ?? 0) >= (input.timeTargetSeconds ?? Infinity));
    return allTarget ? { action: "add_load_or_variation", message: "You reached the time target. Add a small load or choose a harder variation." } : { action: "add_time", message: "Stay with this load and add a few seconds per set." };
  }
  const allTopWithRir = work.every((set) => (set.reps ?? 0) >= (input.repMax ?? Infinity) && (set.rir ?? 0) > 0);
  if (input.trackingType === "bodyweight_reps") return allTopWithRir ? { action: "add_load_or_variation", message: "You reached the rep target with reps in reserve. Add weight or a harder variation." } : { action: "add_rep", message: "Keep the variation and aim for one more rep." };
  if (allTopWithRir) return { action: "increase_weight", message: `Increase by one increment (${input.incrementKg} kg) and rebuild reps.` };
  return { action: "add_rep", message: "Keep the same weight and aim for one more rep across your working sets." };
}
