import { estimateOneRepMax } from "../progression";

export type TrainingFact = { id: string; text: string; source: string };
export type TrainingSnapshot = {
  name: string;
  facts: TrainingFact[];
  notes: { id: string; note: string; updated_at: string }[];
  coverage: string;
};
type Relation<T> = T | T[] | null;
type SetRecord = {
  set_kind: string;
  weight_kg: number | null;
  reps: number | null;
  duration_seconds: number | null;
  rir: number | null;
};
type ExerciseRecord = {
  id: string;
  gym_exercise_id: string;
  pump_rating: number | null;
  notes: string | null;
  gym_exercises: Relation<{
    equipment_label: string | null;
    exercises: Relation<{
      name: string;
      tracking_type: string;
      exercise_muscles?: {
        contribution: number;
        muscles: Relation<{ name: string }>;
      }[];
    }>;
  }>;
  workout_sets: SetRecord[];
  exercise_soreness_feedback?: Relation<{ soreness_rating: number }>;
};
export type SessionRecord = {
  id: string;
  performed_at: string;
  notes: string | null;
  gym: Relation<{ name: string }>;
  workout_exercises: ExerciseRecord[];
};
type Program = {
  name: string;
  program_days: {
    name: string;
    weekday: number | null;
    sort_order: number;
    program_exercises: {
      target_sets: number;
      rep_min: number | null;
      rep_max: number | null;
      time_target_seconds: number | null;
      sort_order: number;
      exercises: Relation<{ name: string }>;
    }[];
  }[];
};
function one<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
const round = (value: number) => Math.round(value * 10) / 10;
const dateLabel = (date: string) =>
  new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });

export function buildTrainingFacts(input: {
  name: string;
  sessions: SessionRecord[];
  notes: TrainingSnapshot["notes"];
  targets: {
    weekly_min: number;
    weekly_max: number;
    muscles: Relation<{ name: string }>;
  }[];
  metrics: { recorded_at: string; bodyweight_kg: number | null }[];
  program: unknown;
  question: string;
  now?: Date;
  experiments?: {
    baseline_weeks: number;
    added_sets: number;
    started_on: string;
    status: string;
    muscles: Relation<{ name: string }>;
  }[];
}): TrainingSnapshot {
  const facts: TrainingFact[] = [];
  const add = (text: string, source: string) =>
    facts.push({ id: `f${facts.length + 1}`, text, source });
  const now = input.now ?? new Date();
  const sessions = input.sessions
    .filter((session) => Date.parse(session.performed_at) <= now.getTime())
    .sort((a, b) => Date.parse(b.performed_at) - Date.parse(a.performed_at));
  const current = sessions.filter(
    (session) =>
      Date.parse(session.performed_at) > now.getTime() - 7 * 86400000,
  );
  const previous = sessions.filter(
    (session) =>
      Date.parse(session.performed_at) <= now.getTime() - 7 * 86400000 &&
      Date.parse(session.performed_at) > now.getTime() - 14 * 86400000,
  );
  const workingCount = (rows: SessionRecord[]) =>
    rows.reduce(
      (sum, session) =>
        sum +
        session.workout_exercises.reduce(
          (n, exercise) =>
            n +
            exercise.workout_sets.filter((set) => set.set_kind === "working")
              .length,
          0,
        ),
      0,
    );
  add(
    `In the available logs for the last 7 days you completed ${current.length} workouts and logged ${workingCount(current)} working sets. In the preceding 7 days you completed ${previous.length} workouts and logged ${workingCount(previous)} working sets.`,
    "Completed workout log; rolling periods, not calendar weeks; limited to the retrieval coverage",
  );
  const volume = new Map<string, number>();
  for (const session of current)
    for (const entry of session.workout_exercises) {
      const count = entry.workout_sets.filter(
        (set) => set.set_kind === "working",
      ).length;
      for (const mapping of one(one(entry.gym_exercises)?.exercises ?? null)
        ?.exercise_muscles ?? []) {
        const muscle = one(mapping.muscles)?.name;
        if (muscle)
          volume.set(
            muscle,
            (volume.get(muscle) ?? 0) + count * Number(mapping.contribution),
          );
      }
    }
  for (const [muscle, sets] of volume)
    add(
      `In the last 7 days, your logged exercises contributed ${sets} effective working sets to ${muscle}.`,
      "Calculated using saved muscle mappings: full credit for primary muscles, half for secondary; unmapped exercises are not included",
    );
  if (!sessions.length)
    add(
      "You have no completed workouts in the training records available to this review.",
      "Completed workout log",
    );
  if (sessions[0])
    add(
      `Your latest completed workout was on ${dateLabel(sessions[0].performed_at)} at ${one(sessions[0].gym)?.name ?? "your gym"}.`,
      `Workout ${sessions[0].id}`,
    );

  const groups = new Map<
    string,
    { session: SessionRecord; exercise: ExerciseRecord }[]
  >();
  for (const session of sessions)
    for (const exercise of session.workout_exercises) {
      if (!exercise.workout_sets.some((set) => set.set_kind === "working"))
        continue;
      const group = groups.get(exercise.gym_exercise_id) ?? [];
      group.push({ session, exercise });
      groups.set(exercise.gym_exercise_id, group);
    }
  const terms = input.question
    .toLowerCase()
    .split(/\W+/)
    .filter((term) => term.length > 2);
  const ranked = [...groups.values()]
    .sort((a, b) => {
      const score = (rows: typeof a) =>
        terms.filter((term) =>
          one(one(rows[0].exercise.gym_exercises)?.exercises ?? null)
            ?.name.toLowerCase()
            .includes(term),
        ).length;
      return (
        score(b) - score(a) ||
        b[0].session.performed_at.localeCompare(a[0].session.performed_at)
      );
    })
    .slice(0, 12);
  for (const rows of ranked) {
    const latest = rows[0];
    const availability = one(latest.exercise.gym_exercises);
    const movement = one(availability?.exercises ?? null);
    if (!movement) continue;
    const name = `${movement.name} at ${one(latest.session.gym)?.name ?? "your gym"}${availability?.equipment_label ? ` (${availability.equipment_label})` : ""}`;
    const formatSets = (exercise: ExerciseRecord) =>
      exercise.workout_sets
        .filter((set) => set.set_kind === "working")
        .map(
          (set) =>
            `${set.weight_kg === null ? "" : `${set.weight_kg} kg × `}${set.reps === null ? `${set.duration_seconds} seconds` : `${set.reps} reps`}${set.rir === null ? "" : ` (${set.rir} reps left)`}`,
        )
        .join("; ");
    add(
      `${name}, ${dateLabel(latest.session.performed_at)}: ${formatSets(latest.exercise)}.`,
      `Workout ${latest.session.id}`,
    );
    if (rows[1]) {
      add(
        `Previous ${name} session, ${dateLabel(rows[1].session.performed_at)}: ${formatSets(rows[1].exercise)}.`,
        `Workout ${rows[1].session.id}`,
      );
      if (movement.tracking_type === "reps") {
        const bestEstimate = (exercise: ExerciseRecord) =>
          Math.max(
            0,
            ...exercise.workout_sets
              .filter((set) => set.set_kind === "working")
              .map((set) =>
                estimateOneRepMax(Number(set.weight_kg), Number(set.reps)),
              ),
          );
        const latestEstimate = bestEstimate(latest.exercise),
          previousEstimate = bestEstimate(rows[1].exercise);
        if (latestEstimate && previousEstimate) {
          const difference = round(latestEstimate - previousEstimate);
          add(
            `${name}: the best estimated one-rep maximum changed from ${round(previousEstimate)} kg to ${round(latestEstimate)} kg (${difference > 0 ? "+" : ""}${difference} kg). This Epley estimate uses working sets of up to 12 reps; it is not a tested maximum or a long-term trend.`,
            "Calculated from the two sessions above, on the same gym equipment",
          );
        }
      }
    }
    const soreness = one(latest.exercise.exercise_soreness_feedback ?? null);
    if (latest.exercise.pump_rating || soreness || latest.exercise.notes)
      add(
        `${name} feedback: ${latest.exercise.pump_rating ? `pump ${latest.exercise.pump_rating}/5; ` : ""}${soreness ? `soreness ${soreness.soreness_rating}/5; ` : ""}${latest.exercise.notes ? `your note: ${latest.exercise.notes.slice(0, 500)}` : "no written note"}.`,
        `Workout ${latest.session.id}`,
      );
  }
  for (const session of sessions.slice(0, 4))
    if (session.notes)
      add(
        `Your workout note on ${dateLabel(session.performed_at)}: ${session.notes.slice(0, 500)}`,
        `Workout ${session.id}`,
      );
  const program = input.program as Program | null;
  if (program) {
    for (const day of [...program.program_days]
      .sort((a, b) => a.sort_order - b.sort_order)
      .slice(0, 7)) {
      const entries = [...day.program_exercises]
        .sort((a, b) => a.sort_order - b.sort_order)
        .slice(0, 12);
      add(
        `${program.name} / ${day.name}: ${entries.length ? entries.map((entry) => `${one(entry.exercises)?.name ?? "Exercise"}, ${entry.target_sets} sets${entry.time_target_seconds ? ` of ${entry.time_target_seconds} seconds` : entry.rep_min && entry.rep_max ? ` of ${entry.rep_min}–${entry.rep_max} reps` : ""}`).join("; ") : "rest day; no exercises"}.`,
        "Your active training plan",
      );
    }
  } else add("You do not have an active training plan.", "Training plans");
  const metrics = input.metrics
    .filter(
      (metric) =>
        metric.bodyweight_kg !== null &&
        Date.parse(metric.recorded_at) <= now.getTime(),
    )
    .sort((a, b) => Date.parse(b.recorded_at) - Date.parse(a.recorded_at));
  if (metrics[0])
    add(
      `Your latest recorded bodyweight is ${metrics[0].bodyweight_kg} kg on ${dateLabel(metrics[0].recorded_at)}.${metrics[1] ? ` The previous entry was ${metrics[1].bodyweight_kg} kg on ${dateLabel(metrics[1].recorded_at)}; the change is ${round(Number(metrics[0].bodyweight_kg) - Number(metrics[1].bodyweight_kg))} kg.` : ""}`,
      "Bodyweight entries",
    );
  for (const target of input.targets.slice(0, 20))
    add(
      `Your saved weekly target for ${one(target.muscles)?.name ?? "this muscle"} is ${target.weekly_min}–${target.weekly_max} effective working sets.`,
      "Your saved volume targets; this is a goal, not completed volume",
    );
  for (const experiment of input.experiments ?? [])
    add(
      `Your ${experiment.status} volume trial for ${one(experiment.muscles)?.name ?? "this muscle"} started on ${dateLabel(experiment.started_on)}, with a ${experiment.baseline_weeks}-week baseline and ${experiment.added_sets} planned extra sets. This record alone does not confirm that the extra sets were completed or that the trial worked.`,
      "Saved volume trial",
    );
  for (const note of input.notes)
    add(
      `Your saved coaching note: ${note.note}`,
      `Coach note ${note.id}; reported by you, not independently measured`,
    );
  return {
    name: input.name,
    facts,
    notes: input.notes,
    coverage:
      "Up to the latest 48 completed workouts from the last 84 days, the active plan, the latest 12 bodyweight entries and saved notes. Missing logs are unknown, not proof that training did not happen. Different gyms/equipment are never combined for strength comparisons.",
  };
}
