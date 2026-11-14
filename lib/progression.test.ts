import { describe, expect, it } from "vitest";
import { estimateOneRepMax, getSuggestion } from "./progression";
const working = (reps: number, rir = 1) => ({
  weightKg: 60,
  reps,
  durationSeconds: null,
  rir,
  setKind: "working" as const,
});
describe("progression engine", () => {
  it("only increases after all sets hit the top with RIR", () =>
    expect(
      getSuggestion({
        trackingType: "reps",
        incrementKg: 2.5,
        repMin: 8,
        repMax: 12,
        latestSets: [working(12), working(12)],
      }).action,
    ).toBe("increase_weight"));
  it("holds after missing the minimum", () =>
    expect(
      getSuggestion({
        trackingType: "reps",
        incrementKg: 2.5,
        repMin: 8,
        repMax: 12,
        latestSets: [working(7)],
      }).action,
    ).toBe("hold"));
  it("never increases after pain", () =>
    expect(
      getSuggestion({
        trackingType: "reps",
        incrementKg: 2.5,
        repMin: 8,
        repMax: 12,
        latestSets: [working(12)],
        painNote: true,
      }).action,
    ).toBe("hold"));
  it("calculates e1RM", () => expect(estimateOneRepMax(60, 10)).toBe(80));
  it("uses actual weight for one rep and rejects unsupported estimates", () => {
    expect(estimateOneRepMax(100, 1)).toBe(100);
    expect(estimateOneRepMax(100, 13)).toBe(0);
    expect(estimateOneRepMax(100, 1.5)).toBe(0);
  });
  it("waits for all planned working sets and ignores warm-ups", () => {
    expect(getSuggestion({trackingType:"reps",incrementKg:2.5,repMin:8,repMax:12,targetSets:2,latestSets:[working(12),{...working(12),setKind:"warmup"}]}).action).toBe("hold");
  });
  it("does not increase with unknown effort or different loads", () => {
    for (const sets of [[{...working(12),rir:null}], [working(12),{...working(12),weightKg:50}]]) {
      expect(getSuggestion({trackingType:"reps",incrementKg:2.5,repMin:8,repMax:12,latestSets:sets}).action).toBe("add_rep");
    }
  });
  it("uses seconds for timed exercises", () => {
    expect(getSuggestion({trackingType:"time",incrementKg:2.5,timeTargetSeconds:60,latestSets:[{...working(0),reps:null,durationSeconds:30}]}).action).toBe("add_time");
    expect(getSuggestion({trackingType:"weighted_time",incrementKg:2.5,timeTargetSeconds:60,latestSets:[{...working(0),reps:null,durationSeconds:60}]}).action).toBe("add_load_or_variation");
  });
});
