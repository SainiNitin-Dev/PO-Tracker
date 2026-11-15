import { expect, it } from "vitest";
import { weeklyReview } from "./weekly-review";

it("compares completed plan days and working sets on matching equipment across weeks", () => {
  const session = (
    performed_at: string,
    dayId: string,
    weight: number,
    equipmentId = "bench",
  ) => ({
    performed_at,
    dayId,
    exercises: [
      {
        name: "Bench press",
        equipmentId,
        exerciseId: "press",
        trackingType: "reps",
        pump: null,
        sets: [
          { set_kind: "working", weight_kg: weight, reps: 8, rir: null },
          { set_kind: "warmup", weight_kg: weight - 10, reps: 10, rir: null },
        ],
      },
    ],
  });
  const result = weeklyReview(
    [
      session("2026-11-01T10:00:00Z", "push", 40),
      session("2026-11-08T10:00:00Z", "push", 45),
      session("2026-11-09T10:00:00Z", "push", 70, "other-bench"),
    ],
    [
      { id: "push", name: "Push" },
      { id: "legs", name: "Legs" },
    ],
    Date.parse("2026-11-11T00:00:00Z"),
  );
  expect(result).toMatchObject({
    completed: 2,
    workingSets: 2,
    previousWorkingSets: 1,
    days: [{ completed: true }, { completed: false }],
    improvements: [
      {
        equipmentId: "bench",
        measure: "weight",
        matched: 8,
        before: 40,
        value: 45,
      },
    ],
  });
});
