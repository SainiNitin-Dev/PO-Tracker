/** Plate weights are in hundredths of a kilogram so combinations are exact. */
export function warmupPlan(workingKg: number, barKg: number, pairs: number[]) {
  const bar = Math.round(barKg * 100);
  const target = Math.round(workingKg * 100);
  if (target < bar || bar <= 0) return null;

  const limit = Math.floor((target - bar) / 2);
  const combinations = new Map<number, number[]>([[0, []]]);
  for (const plate of [...pairs].sort((a, b) => b - a)) {
    const centiKg = Math.round(plate * 100);
    for (const [total, stack] of [...combinations]) {
      const next = total + centiKg;
      const existing = combinations.get(next);
      if (next <= limit && (!existing || existing.length > stack.length + 1)) {
        combinations.set(next, [...stack, plate]);
      }
    }
  }

  const totals = [...combinations.keys()].sort((a, b) => b - a);
  const load = (desired: number) => {
    const platesTotal = totals.find((total) => bar + 2 * total <= desired) ?? 0;
    return {
      kg: (bar + 2 * platesTotal) / 100,
      plates: combinations.get(platesTotal)!,
    };
  };
  const working = load(target);
  const warmups: (ReturnType<typeof load> & { reps: number })[] = [];
  for (const [fraction, reps] of [
    [0, 8],
    [0.5, 5],
    [0.7, 3],
    [0.85, 1],
  ]) {
    const set = load(target * fraction);
    if (set.kg < working.kg && !warmups.some((other) => other.kg === set.kg)) {
      warmups.push({ ...set, reps });
    }
  }
  return { warmups, working };
}
