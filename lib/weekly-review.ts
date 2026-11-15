import type { ProgressSession } from "./progress-summary";

type Session = ProgressSession & { dayId: string | null };
type Day = { id: string; name: string };
type Measure = "weight" | "reps" | "seconds";
type Performance = {
  equipmentId: string;
  name: string;
  equipment: string | null;
  measure: Measure;
  matched: number;
  value: number;
};
const WEEK = 7 * 86400000;
const priority = { weight: 3, reps: 2, seconds: 1 };

export function weeklyReview(sessions: Session[], plan: Day[], now: number) {
  const summarize = (start: number, end: number) => {
    const days = new Set<string>();
    const lifts = new Map<string, Performance>();
    let workingSets = 0;
    let completed = 0;
    for (const session of sessions) {
      const date = Date.parse(session.performed_at);
      if (!(date > start && date <= end)) continue;
      completed++;
      if (session.dayId) days.add(session.dayId);
      for (const exercise of session.exercises) {
        const equipmentId = exercise.equipmentId;
        for (const set of exercise.sets) {
          if (set.set_kind !== "working") continue;
          workingSets++;
          const kg = Number(set.weight_kg ?? 0);
          const measures: [Measure, number, number][] = [];
          if (
            set.reps &&
            ["reps", "bodyweight_reps"].includes(exercise.trackingType)
          ) {
            measures.push(["reps", kg, set.reps]);
            if (exercise.trackingType === "reps")
              measures.push(["weight", set.reps, kg]);
          }
          if (
            set.duration_seconds &&
            ["time", "weighted_time"].includes(exercise.trackingType)
          ) {
            measures.push(["seconds", kg, set.duration_seconds]);
          }
          for (const [measure, matched, value] of measures) {
            const key = `${equipmentId}:${measure}:${matched}`;
            const previous = lifts.get(key);
            if (!previous || value > previous.value) {
              lifts.set(key, {
                equipmentId,
                name: exercise.name,
                equipment: exercise.equipmentLabel ?? null,
                measure,
                matched,
                value,
              });
            }
          }
        }
      }
    }
    return { days, lifts, completed, workingSets };
  };

  const previous = summarize(now - 2 * WEEK, now - WEEK);
  const current = summarize(now - WEEK, now);
  const improvements = new Map<string, Performance & { before: number }>();
  for (const [key, lift] of current.lifts) {
    const before = previous.lifts.get(key);
    if (!before || lift.value <= before.value) continue;
    const existing = improvements.get(lift.equipmentId);
    if (
      !existing ||
      priority[lift.measure] > priority[existing.measure] ||
      (lift.measure === existing.measure &&
        lift.value - before.value > existing.value - existing.before)
    ) {
      improvements.set(lift.equipmentId, { ...lift, before: before.value });
    }
  }
  return {
    completed: current.completed,
    workingSets: current.workingSets,
    previousWorkingSets: previous.workingSets,
    days: plan.map((day) => ({ ...day, completed: current.days.has(day.id) })),
    improvements: [...improvements.values()],
  };
}
