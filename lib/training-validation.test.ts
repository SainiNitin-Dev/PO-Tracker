import { describe, expect, it } from "vitest";
import {
  optionalTrainingNumber,
  validateSet,
  validateTargets,
} from "./training-validation";
describe("training validation", () => {
  it("keeps absent values null instead of converting them to zero", () => {
    for (const missing of [null, undefined, ""])
      expect(optionalTrainingNumber(missing, "Reps", 1, 100)).toBeNull();
  });
  it("accepts weighted reps and timed sets separately", () => {
    expect(
      validateSet(
        {
          setKind: "working",
          weightKg: "50",
          reps: "8",
          durationSeconds: null,
          rir: "0",
        },
        "reps",
      ),
    ).toEqual({ weight: 50, reps: 8, seconds: null, rir: 0, kind: "working" });
    expect(
      validateSet({ setKind: "working", durationSeconds: 30 }, "time").reps,
    ).toBeNull();
  });
  it("rejects mixed tracking, missing load and fractional counts", () => {
    expect(() =>
      validateSet(
        { setKind: "working", weightKg: 50, reps: 8, durationSeconds: 30 },
        "reps",
      ),
    ).toThrow();
    expect(() =>
      validateSet({ setKind: "working", durationSeconds: 30 }, "weighted_time"),
    ).toThrow();
    expect(() =>
      validateSet({ setKind: "working", weightKg: 50, reps: 8.5 }, "reps"),
    ).toThrow();
  });
  it("produces only the target columns needed by each tracking type", () => {
    expect(
      validateTargets(
        { targetSets: 2, timeTargetSeconds: 30, repMin: 6, repMax: 10 },
        "time",
      ),
    ).toEqual({
      target_sets: 2,
      rep_min: null,
      rep_max: null,
      time_target_seconds: 30,
    });
    expect(() =>
      validateTargets({ targetSets: 2, repMin: 10, repMax: 6 }, "reps"),
    ).toThrow();
  });
});
