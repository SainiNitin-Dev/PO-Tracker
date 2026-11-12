import { describe, expect, it } from "vitest";
import { estimateOneRepMax, getSuggestion } from "./progression";
const working = (reps: number, rir = 1) => ({ weightKg: 60, reps, durationSeconds: null, rir, setKind: "working" as const });
describe("progression engine", () => {
  it("only increases after all sets hit the top with RIR", () => expect(getSuggestion({ trackingType: "reps", incrementKg: 2.5, repMin: 8, repMax: 12, latestSets: [working(12), working(12)] }).action).toBe("increase_weight"));
  it("holds after missing the minimum", () => expect(getSuggestion({ trackingType: "reps", incrementKg: 2.5, repMin: 8, repMax: 12, latestSets: [working(7)] }).action).toBe("hold"));
  it("never increases after pain", () => expect(getSuggestion({ trackingType: "reps", incrementKg: 2.5, repMin: 8, repMax: 12, latestSets: [working(12)], painNote: true }).action).toBe("hold"));
  it("calculates e1RM", () => expect(estimateOneRepMax(60, 10)).toBe(80));
});
