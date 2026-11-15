import { describe, expect, it } from "vitest";
import { warmupPlan } from "./warmup";

describe("barbell warm-up calculator", () => {
  it("finds a reachable load with limited pairs even where the heaviest plate would miss", () => {
    const plan = warmupPlan(80, 20, [25, 20, 10]);
    expect(plan?.working).toEqual({ kg: 80, plates: [20, 10] });
    expect(plan?.warmups[0]).toEqual({ kg: 20, plates: [], reps: 8 });
    expect(plan?.warmups.every((set) => set.kg < 80)).toBe(true);
  });

  it("rounds down to an available load and omits duplicate warm-ups", () => {
    expect(warmupPlan(26, 20, [1.25])).toEqual({
      working: { kg: 22.5, plates: [1.25] },
      warmups: [{ kg: 20, plates: [], reps: 8 }],
    });
    expect(warmupPlan(15, 20, [])).toBeNull();
    expect(warmupPlan(20, 20, [])?.warmups).toEqual([]);
  });
});
