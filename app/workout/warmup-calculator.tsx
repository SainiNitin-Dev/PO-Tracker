"use client";

import { useState } from "react";
import { warmupPlan } from "@/lib/warmup";

export default function WarmupCalculator({
  suggestedKg,
  onUseSet,
}: {
  suggestedKg: number | null;
  onUseSet: (kg: number, reps: number) => void;
}) {
  const [working, setWorking] = useState(suggestedKg?.toString() ?? "");
  const [bar, setBar] = useState("20");
  const [inventory, setInventory] = useState("20, 20, 15, 10, 5, 2.5, 1.25");
  const pairs = inventory.trim() ? inventory.split(/[\s,]+/).map(Number) : [];
  const validPlates =
    pairs.length <= 40 && pairs.every((kg) => kg >= 0.01 && kg <= 100);
  const validWeight = (value: string) =>
    Number(value) >= 0.01 && Number(value) <= 1000;
  const plan =
    validWeight(working) && validWeight(bar) && validPlates
      ? warmupPlan(Number(working), Number(bar), pairs)
      : null;
  const plates = (stack: number[]) =>
    stack.length ? `${stack.join(" + ")} kg per side` : "Empty bar";

  return (
    <details className="rounded-xl border border-[#ded9ce] p-4">
      <summary className="cursor-pointer font-semibold">
        Barbell warm-up & plates
      </summary>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="field">
          Working weight (kg)
          <input
            type="number"
            min="0.01"
            max="1000"
            step="0.01"
            value={working}
            onChange={(event) => setWorking(event.target.value)}
          />
        </label>
        <label className="field">
          Bar weight (kg)
          <input
            type="number"
            min="0.01"
            max="1000"
            step="0.01"
            value={bar}
            onChange={(event) => setBar(event.target.value)}
          />
        </label>
        <label className="field col-span-2">
          Available plate pairs (kg)
          <input
            type="text"
            value={inventory}
            onChange={(event) => setInventory(event.target.value)}
            maxLength={240}
          />
          <span className="muted text-xs">
            Enter each pair once. Enter 20, 20 if you have four 20 kg plates.
          </span>
        </label>
      </div>
      {!plan && (
        <p className="muted mt-3 text-sm">
          Enter a working weight at least as heavy as the bar and up to 40 plate
          pairs.
        </p>
      )}
      {plan && (
        <div className="mt-3 space-y-2 text-sm">
          <p>
            <strong>Working load {plan.working.kg} kg</strong> ·{" "}
            {plates(plan.working.plates)}
          </p>
          {plan.working.kg !== Math.round(Number(working) * 100) / 100 && (
            <p className="muted">
              Closest load at or below your target with these plates.
            </p>
          )}
          {plan.warmups.map((set) => (
            <div
              key={set.kg}
              className="flex flex-wrap items-center justify-between gap-x-2 border-t border-[#ded9ce] py-1"
            >
              <span>
                {set.kg} kg × {set.reps} · {plates(set.plates)}
              </span>
              <button
                type="button"
                className="quiet-action"
                onClick={() => onUseSet(set.kg, set.reps)}
              >
                Use warm-up set
              </button>
            </div>
          ))}
        </div>
      )}
    </details>
  );
}
