import { estimateOneRepMax } from "./progression";
export type HistorySet = {
  id: string;
  set_number: number;
  set_kind: string;
  weight_kg: number | null;
  reps: number | null;
  duration_seconds: number | null;
  rir: number | null;
};
export type HistoryExercise = {
  id: string;
  equipmentId: string;
  name: string;
  gym: string;
  equipmentLabel: string | null;
  trackingType: string;
  notes: string | null;
  pump: number | null;
  soreness: number | null;
  sets: HistorySet[];
};
export type HistorySession = {
  id: string;
  performed_at: string;
  status: string;
  notes: string | null;
  bodyweight_kg: number | null;
  gym: string;
  day: string;
  exercises: HistoryExercise[];
};
export function historyRecords(sessions: HistorySession[]) {
  const result = new Map<
    string,
    {
      equipmentId: string;
      name: string;
      gym: string;
      equipmentLabel: string | null;
      trackingType: string;
      weight: number;
      reps: number;
      seconds: number;
      estimate: number;
    }
  >();
  for (const session of sessions) {
    if (session.status !== "completed") continue;
    for (const exercise of session.exercises)
      for (const set of exercise.sets) {
        if (set.set_kind !== "working") continue;
        const best = result.get(exercise.equipmentId) ?? {
          equipmentId: exercise.equipmentId,
          name: exercise.name,
          gym: exercise.gym,
          equipmentLabel: exercise.equipmentLabel,
          trackingType: exercise.trackingType,
          weight: 0,
          reps: 0,
          seconds: 0,
          estimate: 0,
        };
        best.weight = Math.max(best.weight, Number(set.weight_kg ?? 0));
        best.reps = Math.max(best.reps, Number(set.reps ?? 0));
        best.seconds = Math.max(
          best.seconds,
          Number(set.duration_seconds ?? 0),
        );
        if (exercise.trackingType === "reps")
          best.estimate = Math.max(
            best.estimate,
            estimateOneRepMax(Number(set.weight_kg), Number(set.reps)),
          );
        result.set(exercise.equipmentId, best);
      }
  }
  return [...result.values()];
}
