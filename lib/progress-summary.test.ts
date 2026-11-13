import { describe, expect, it } from "vitest";
import {
  compareExperiment,
  summarizeProgress,
  type ProgressSession,
} from "./progress-summary";
const now = Date.parse("2026-11-13T12:00:00Z");
const mapping = [
  { exercise_id: "press", muscle_id: "chest", contribution: 1 },
  { exercise_id: "press", muscle_id: "triceps", contribution: 0.5 },
];
function session(
  date: string,
  weight = 50,
  equipmentId = "bench",
): ProgressSession {
  return {
    performed_at: date,
    exercises: [
      {
        equipmentId,
        exerciseId: "press",
        name: "Press",
        trackingType: "reps",
        pump: 3,
        sets: [
          { set_kind: "working", weight_kg: weight, reps: 10, rir: 2 },
          { set_kind: "warmup", weight_kg: 20, reps: 10, rir: null },
        ],
      },
    ],
  };
}
describe("progress summaries", () => {
  it("counts working sets with secondary contributions and excludes future/old sessions", () => {
    const result = summarizeProgress(
      [
        session("2026-11-12T12:00:00Z"),
        session("2026-11-01T12:00:00Z"),
        session("2026-11-14T12:00:00Z"),
      ],
      mapping,
      now,
    );
    expect(result.volume).toEqual({ chest: 1, triceps: 0.5 });
    expect(result.workingSets).toBe(1);
    expect(result.sessions).toBe(1);
    expect(result.weeks.reduce((n, w) => n + w.sessions, 0)).toBe(2);
  });
  it("compares only the same equipment and stops at experiment end", () => {
    const result = compareExperiment(
      {
        id: "x",
        muscle_id: "chest",
        baseline_weeks: 1,
        added_sets: 1,
        started_on: "2026-10-01",
        status: "completed",
        ended_at: "2026-10-15T00:00:00Z",
      },
      [
        session("2026-10-02", 50),
        session("2026-10-09", 55),
        session("2026-10-10", 100, "other-bench"),
        session("2026-11-01", 200),
      ],
      mapping,
      now,
    );
    expect(result.comparisons).toHaveLength(1);
    expect(result.comparisons[0].after).toBe(73.3);
    expect(result.after.sets).toBe(2);
    expect(result.baseline.weeklySets).toBe(1);
  });
  it("does not report a weekly rate from a partial week or invent missing effort", () => {
    const result = compareExperiment(
      {
        id: "x",
        muscle_id: "chest",
        baseline_weeks: 4,
        added_sets: 1,
        started_on: "2026-11-12",
        status: "active",
        ended_at: null,
      },
      [],
      mapping,
      now,
    );
    expect(result.phase).toBe("baseline");
    expect(result.baseline.weeklySets).toBeNull();
    expect(result.baseline.rir).toBeNull();
    expect(result.comparisons).toEqual([]);
  });
});
