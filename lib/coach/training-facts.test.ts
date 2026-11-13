import { describe, expect, it } from "vitest";
import { buildTrainingFacts, type SessionRecord } from "./training-facts";
const baseline = {
  name: "Member",
  notes: [],
  targets: [],
  metrics: [],
  program: null,
  question: "How is my press?",
  now: new Date("2026-11-13T12:00:00Z"),
};
function session(
  id: string,
  date: string,
  equipment: string,
  weight: number,
): SessionRecord {
  return {
    id,
    performed_at: date,
    notes: null,
    gym: { name: "Gym" },
    workout_exercises: [
      {
        id: `${id}-exercise`,
        gym_exercise_id: equipment,
        pump_rating: null,
        notes: null,
        gym_exercises: {
          equipment_label: null,
          exercises: { name: "Press", tracking_type: "reps" },
        },
        workout_sets: [
          {
            set_kind: "working",
            weight_kg: weight,
            reps: 8,
            duration_seconds: null,
            rir: 2,
          },
        ],
      },
    ],
  };
}
describe("coach retrieval facts", () => {
  it("computes comparisons on the same equipment, not a different machine", () => {
    const result = buildTrainingFacts({
      ...baseline,
      sessions: [
        session("new", "2026-11-12", "a", 55),
        session("old", "2026-11-05", "a", 50),
        session("other", "2026-11-01", "b", 200),
      ],
    });
    const estimates = result.facts.filter((f) =>
      f.text.includes("estimated one-rep"),
    );
    expect(estimates).toHaveLength(1);
    expect(estimates[0].text).toContain("63.3 kg to 69.7 kg");
    expect(estimates[0].text).not.toContain("200");
  });
  it("states missing history without inventing records", () => {
    const result = buildTrainingFacts({ ...baseline, sessions: [] });
    expect(
      result.facts.some((f) => f.text.includes("no completed workouts")),
    ).toBe(true);
    expect(result.coverage).toContain("Missing logs are unknown");
  });
});
