import { estimateOneRepMax } from "./progression";

export type ProgressSet = {
  set_kind: string;
  weight_kg: number | null;
  reps: number | null;
  rir: number | null;
};
export type ProgressSession = {
  performed_at: string;
  exercises: {
    equipmentId: string;
    exerciseId: string;
    name: string;
    trackingType: string;
    pump: number | null;
    sets: ProgressSet[];
  }[];
};
export type MuscleMapping = {
  exercise_id: string;
  muscle_id: string;
  contribution: number;
};
export type Experiment = {
  id: string;
  muscle_id: string;
  baseline_weeks: number;
  added_sets: number;
  started_on: string;
  status: string;
  ended_at: string | null;
};
const DAY = 86400000;
const mean = (values: number[]) =>
  values.length
    ? Math.round((values.reduce((sum, n) => sum + n, 0) / values.length) * 10) /
      10
    : null;

export function summarizeProgress(
  sessions: ProgressSession[],
  mappings: MuscleMapping[],
  now = Date.now(),
) {
  const relevant = sessions.filter((s) => Date.parse(s.performed_at) <= now);
  const recent = relevant.filter(
    (s) => Date.parse(s.performed_at) > now - 7 * DAY,
  );
  const volume: Record<string, number> = {};
  for (const session of recent)
    for (const exercise of session.exercises) {
      const sets = exercise.sets.filter((s) => s.set_kind === "working").length;
      for (const mapping of mappings.filter(
        (m) => m.exercise_id === exercise.exerciseId,
      ))
        volume[mapping.muscle_id] =
          (volume[mapping.muscle_id] ?? 0) +
          sets * Number(mapping.contribution);
    }
  const weeks = Array.from({ length: 8 }, (_, index) => {
    const end = now - (7 - index) * 7 * DAY;
    const start = end - 7 * DAY;
    const records = relevant.filter(
      (s) =>
        Date.parse(s.performed_at) > start && Date.parse(s.performed_at) <= end,
    );
    return {
      start: new Date(start).toISOString(),
      sessions: records.length,
      sets: records.reduce(
        (sum, s) =>
          sum +
          s.exercises.reduce(
            (n, e) =>
              n + e.sets.filter((set) => set.set_kind === "working").length,
            0,
          ),
        0,
      ),
    };
  });
  return {
    volume,
    weeks,
    sessions: recent.length,
    workingSets: recent.reduce(
      (sum, s) =>
        sum +
        s.exercises.reduce(
          (n, e) =>
            n + e.sets.filter((set) => set.set_kind === "working").length,
          0,
        ),
      0,
    ),
  };
}

export function compareExperiment(
  experiment: Experiment,
  sessions: ProgressSession[],
  mappings: MuscleMapping[],
  now = Date.now(),
) {
  const start = Date.parse(`${experiment.started_on}T00:00:00Z`);
  const change = start + experiment.baseline_weeks * 7 * DAY;
  const end = experiment.ended_at
    ? Math.min(now, Date.parse(experiment.ended_at))
    : now;
  const selected = new Map(
    mappings
      .filter((m) => m.muscle_id === experiment.muscle_id)
      .map((m) => [m.exercise_id, Number(m.contribution)]),
  );
  const period = (from: number, to: number) => {
    const records = sessions.filter(
      (s) =>
        Date.parse(s.performed_at) >= from && Date.parse(s.performed_at) < to,
    );
    let sets = 0;
    const rir: number[] = [],
      pumps: number[] = [];
    const strength = new Map<string, { name: string; estimate: number }>();
    for (const s of records)
      for (const e of s.exercises) {
        if (!selected.has(e.exerciseId)) continue;
        const working = e.sets.filter((set) => set.set_kind === "working");
        sets += working.length * selected.get(e.exerciseId)!;
        if (working.length && e.pump !== null) pumps.push(Number(e.pump));
        for (const set of working) {
          if (set.rir !== null) rir.push(Number(set.rir));
          if (
            e.trackingType === "reps" &&
            set.weight_kg &&
            set.reps &&
            set.reps <= 12
          ) {
            const estimate = estimateOneRepMax(set.weight_kg, set.reps);
            if (estimate > (strength.get(e.equipmentId)?.estimate ?? 0))
              strength.set(e.equipmentId, { name: e.name, estimate });
          }
        }
      }
    const days = Math.max(0, (to - from) / DAY);
    return {
      sessions: records.filter((s) =>
        s.exercises.some(
          (e) =>
            selected.has(e.exerciseId) &&
            e.sets.some((set) => set.set_kind === "working"),
        ),
      ).length,
      sets,
      weeklySets: days >= 7 ? Math.round((sets / (days / 7)) * 10) / 10 : null,
      rir: mean(rir),
      pump: mean(pumps),
      strength,
    };
  };
  const baseline = period(start, Math.min(end, change));
  const after = period(change, Math.max(change, end));
  const comparisons = [...baseline.strength.entries()].flatMap(
    ([id, before]) => {
      const latest = after.strength.get(id);
      return latest
        ? [
            {
              equipmentId: id,
              name: before.name,
              before: before.estimate,
              after: latest.estimate,
              difference:
                Math.round((latest.estimate - before.estimate) * 10) / 10,
            },
          ]
        : [];
    },
  );
  return {
    phase: end < change ? ("baseline" as const) : ("comparison" as const),
    changeDate: new Date(change).toISOString().slice(0, 10),
    baseline: {
      sessions: baseline.sessions,
      sets: baseline.sets,
      weeklySets: baseline.weeklySets,
      rir: baseline.rir,
      pump: baseline.pump,
    },
    after: {
      sessions: after.sessions,
      sets: after.sets,
      weeklySets: after.weeklySets,
      rir: after.rir,
      pump: after.pump,
    },
    comparisons,
  };
}
