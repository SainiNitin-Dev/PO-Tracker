"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { requestJson } from "@/lib/client-request";
import {
  type Experiment,
  type summarizeProgress,
  type compareExperiment,
} from "@/lib/progress-summary";
import ConfirmDialog, { type Confirmation } from "@/components/confirm-dialog";
type Muscle = { id: string; name: string };
type Target = { muscle_id: string; weekly_min: number; weekly_max: number };
type Trial = Experiment & {
  comparison: ReturnType<typeof compareExperiment>;
  incomplete: boolean;
};
export default function ProgressDashboard({
  muscles,
  targets,
  experiments,
  summary,
}: {
  muscles: Muscle[];
  targets: Target[];
  experiments: Trial[];
  summary: ReturnType<typeof summarizeProgress>;
}) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [refreshing, transition] = useTransition();
  const busy = working || refreshing;
  const [message, setMessage] = useState<{
    text: string;
    error?: boolean;
  } | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const run = async (
    path: string,
    body: object,
    method = "POST",
    form?: HTMLFormElement,
  ) => {
    setWorking(true);
    setMessage(null);
    try {
      await requestJson(path, body, method);
      form?.reset();
      setMessage({ text: "Saved. Your progress is up to date." });
      transition(() => router.refresh());
    } catch (e) {
      setMessage({
        text:
          e instanceof Error
            ? e.message
            : "That didn’t save. Please try again.",
        error: true,
      });
    } finally {
      setWorking(false);
    }
  };
  const submit = (path: string) => (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    void run(path, Object.fromEntries(new FormData(form)));
  };
  const maxSessions = Math.max(1, ...summary.weeks.map((w) => w.sessions));
  return (
    <main className="app-page">
      <header className="page-header">
        <p className="eyebrow">The bigger picture</p>
        <h1>Your progress</h1>
        <p>
          A look at your completed workouts. Progress takes time; use these
          patterns alongside how you feel.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/history" className="secondary-action">
            History & personal bests
          </Link>
          <Link href="/photos" className="quiet-action">
            Progress photos →
          </Link>
        </div>
      </header>
      {message && (
        <p
          className="status-message mb-6"
          data-tone={message.error ? "error" : "success"}
          role={message.error ? "alert" : "status"}
        >
          {message.text}
        </p>
      )}
      <div className="mb-6 grid grid-cols-2 gap-4">
        <section className="surface">
          <p className="muted text-sm">Sessions · last 7 days</p>
          <p className="metric-value mt-2">{summary.sessions}</p>
        </section>
        <section className="surface">
          <p className="muted text-sm">Working sets · last 7 days</p>
          <p className="metric-value mt-2">{summary.workingSets}</p>
        </section>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section className="surface">
          <h2 className="text-lg font-semibold">Finding your rhythm</h2>
          <p className="muted mt-1 text-sm">
            Completed workouts in each 7-day period
          </p>
          <figure className="mt-6">
            <div
              className="flex h-44 items-end justify-between gap-2"
              role="img"
              aria-label={summary.weeks
                .map(
                  (w) =>
                    `${new Date(w.start).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })}: ${w.sessions} sessions`,
                )
                .join("; ")}
            >
              {summary.weeks.map((w) => (
                <div
                  key={w.start}
                  className="flex h-full flex-1 flex-col items-center justify-end gap-2"
                >
                  <span className="text-xs font-semibold">{w.sessions}</span>
                  <div
                    className="w-full max-w-10 rounded-t bg-[#81936d]"
                    style={{
                      height: `${w.sessions ? Math.max(5, (w.sessions / maxSessions) * 120) : 2}px`,
                      opacity: w.sessions ? 1 : 0.3,
                    }}
                  />
                  <span className="muted text-[10px]">
                    {new Date(w.start).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      timeZone: "UTC",
                    })}
                  </span>
                </div>
              ))}
            </div>
            <figcaption className="muted mt-4 text-xs">
              The latest column is the last 7 days. Warm-up and drop sets aren’t
              counted as working sets.
            </figcaption>
          </figure>
          {!summary.weeks.some((w) => w.sessions) && (
            <p className="empty-state">
              Your completed workouts will appear here.{" "}
              <Link className="underline" href="/workout">
                Start a session
              </Link>{" "}
              when you’re ready.
            </p>
          )}
        </section>
        <section className="surface">
          <h2 className="text-lg font-semibold">Sets by muscle</h2>
          <p className="muted mt-1 text-sm">
            Last 7 days · main muscles count fully, supporting muscles count
            half.
          </p>
          <div className="mt-5 space-y-5">
            {muscles.map((m) => {
              const target = targets.find((t) => t.muscle_id === m.id);
              const min = target?.weekly_min ?? 8;
              const max = target?.weekly_max ?? 16;
              const sets = summary.volume[m.id] ?? 0;
              return (
                <div key={m.id}>
                  <div className="mb-2 flex justify-between gap-3 text-sm">
                    <span className="font-semibold">{m.name}</span>
                    <span>
                      {sets}{" "}
                      <span className="muted">
                        / {min}–{max} sets
                      </span>
                    </span>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded bg-[#eeeee7]"
                    role="meter"
                    aria-label={`${m.name} working sets`}
                    aria-valuenow={sets}
                    aria-valuemin={0}
                    aria-valuemax={Math.max(max, sets, 1)}
                    aria-valuetext={`${sets} sets; target ${min} to ${max}`}
                  >
                    <div
                      className="h-full rounded bg-[#81936d]"
                      style={{
                        width: `${Math.min(100, (sets / Math.max(1, max)) * 100)}%`,
                      }}
                    />
                  </div>
                  <details className="mt-1">
                    <summary className="muted !min-h-9 text-xs">
                      Adjust target
                    </summary>
                    <form
                      onSubmit={submit("/api/volume-targets")}
                      className="mt-2 flex flex-wrap items-end gap-2"
                    >
                      <input type="hidden" name="muscleId" value={m.id} />
                      <label className="field w-24">
                        Minimum
                        <input
                          name="min"
                          type="number"
                          min={0}
                          max={100}
                          defaultValue={min}
                          required
                        />
                      </label>
                      <label className="field w-24">
                        Maximum
                        <input
                          name="max"
                          type="number"
                          min={0}
                          max={100}
                          defaultValue={max}
                          required
                        />
                      </label>
                      <button className="secondary-action" disabled={busy}>
                        {busy ? "Saving…" : "Save target"}
                      </button>
                    </form>
                  </details>
                </div>
              );
            })}
          </div>
          {!muscles.length && (
            <p className="empty-state">
              Your gym admin needs to link exercises to muscle groups before
              this breakdown is available. You can still log workouts.
            </p>
          )}
          <p className="muted mt-4 text-xs">
            Targets are editable planning ranges, not a score or a requirement
            to add more work.
          </p>
        </section>
      </div>
      <section className="surface mt-6">
        <details>
          <summary className="text-lg">Try a training experiment</summary>
          <p className="muted mt-3 max-w-2xl text-sm leading-relaxed">
            Track your usual training for a baseline period. Then, if recovery
            feels good, add a small number of weekly sets to your plan and
            compare what you actually logged. This tracker never changes your
            plan automatically.
          </p>
          <form
            onSubmit={submit("/api/experiments")}
            className="mt-5 grid gap-4 sm:grid-cols-3"
          >
            <label className="field">
              Muscle group
              <select name="muscleId" required>
                <option value="">Choose a muscle</option>
                {muscles.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Baseline (weeks)
              <input
                name="baselineWeeks"
                type="number"
                min={1}
                max={12}
                defaultValue={4}
                required
              />
            </label>
            <label className="field">
              Extra weekly sets to try
              <input
                name="addedSets"
                type="number"
                min={1}
                max={4}
                defaultValue={1}
                required
              />
            </label>
            <button
              className="primary-action sm:col-span-3 sm:justify-self-start"
              disabled={busy || !muscles.length}
            >
              {busy ? "Saving…" : "Start baseline"}
            </button>
          </form>
        </details>
      </section>
      <section className="mt-8">
        <div className="section-heading">
          <h2>Your experiments</h2>
        </div>
        <div className="space-y-4">
          {experiments.map((e) => (
            <article key={e.id} className="surface">
              <div className="section-heading">
                <h2>
                  {muscles.find((m) => m.id === e.muscle_id)?.name ??
                    "Muscle group"}
                </h2>
                <span className="badge">
                  {e.status === "active"
                    ? e.comparison.phase === "baseline"
                      ? "Building baseline"
                      : "Comparing"
                    : e.status === "completed"
                      ? "Completed"
                      : "Cancelled"}
                </span>
              </div>
              <p className="muted text-sm">
                {e.baseline_weeks}-week baseline from {e.started_on} · planned
                change: +{e.added_sets} weekly sets from{" "}
                {e.comparison.changeDate}
              </p>
              {e.status === "active" && e.comparison.phase === "comparison" && (
                <p className="status-message mt-4">
                  If you’re ready to try the change,{" "}
                  <Link href="/program" className="font-semibold underline">
                    edit your plan
                  </Link>{" "}
                  to add the sets. Keep other factors as consistent as you can.
                </p>
              )}
              {e.incomplete ? (
                <p className="status-message mt-4">
                  {e.status !== "active" && !e.ended_at
                    ? "This older experiment has no recorded end date. Its results cannot be compared reliably."
                    : "This experiment extends outside the loaded history window. Comparisons are incomplete; review its sessions in workout history."}
                </p>
              ) : (
                <>
                  <div className="mt-5 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <caption className="sr-only">
                        Recorded baseline and comparison results
                      </caption>
                      <thead>
                        <tr className="muted">
                          <th className="pb-3 font-normal">Recorded measure</th>
                          <th className="pb-3 font-normal">Baseline</th>
                          <th className="pb-3 font-normal">After</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          [
                            "Weekly sets",
                            e.comparison.baseline.weeklySets,
                            e.comparison.after.weeklySets,
                          ],
                          [
                            "Sessions for this muscle",
                            e.comparison.baseline.sessions,
                            e.comparison.after.sessions,
                          ],
                          [
                            "Average reps left",
                            e.comparison.baseline.rir,
                            e.comparison.after.rir,
                          ],
                          [
                            "Average muscle pump / 5",
                            e.comparison.baseline.pump,
                            e.comparison.after.pump,
                          ],
                        ].map(([label, before, after]) => (
                          <tr key={label}>
                            <th className="py-2 pr-4 font-normal">{label}</th>
                            <td>{before ?? "—"}</td>
                            <td>{after ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {e.comparison.comparisons.map((c) => (
                    <p key={c.equipmentId} className="muted mt-3 text-sm">
                      {c.name}, same equipment: estimated strength {c.before} →{" "}
                      {c.after} kg ({c.difference > 0 ? "+" : ""}
                      {c.difference} kg).
                    </p>
                  ))}
                  <p className="muted mt-4 text-xs">
                    Weekly rates need at least 7 days. Strength estimates use
                    weighted rep sets of up to 12 reps. Differences do not prove
                    that extra sets caused a change.
                  </p>
                </>
              )}
              {e.status === "active" && (
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    className="secondary-action"
                    disabled={busy}
                    onClick={() =>
                      setConfirmation({
                        title: "Complete this experiment?",
                        description:
                          "Its comparison window will end now. Your workouts and results remain available.",
                        label: "Complete experiment",
                        onConfirm: () =>
                          void run(
                            "/api/experiments",
                            { id: e.id, status: "completed" },
                            "PATCH",
                          ),
                      })
                    }
                  >
                    Complete
                  </button>
                  <button
                    className="quiet-action"
                    disabled={busy}
                    onClick={() =>
                      setConfirmation({
                        title: "Cancel this experiment?",
                        description:
                          "This stops the experiment. Your training records and the experiment history stay intact.",
                        label: "Cancel experiment",
                        onConfirm: () =>
                          void run(
                            "/api/experiments",
                            { id: e.id, status: "cancelled" },
                            "PATCH",
                          ),
                      })
                    }
                  >
                    Cancel experiment
                  </button>
                </div>
              )}
            </article>
          ))}
          {!experiments.length && (
            <p className="empty-state">
              No experiments yet. Your regular workouts are enough to start
              building a useful history.
            </p>
          )}
        </div>
      </section>
      <p className="muted mt-8 text-xs">
        This view uses up to 300 completed workouts from the last 180 days and
        your latest 50 experiments. Muscle totals use the current exercise
        mappings.
      </p>
      <ConfirmDialog
        confirmation={confirmation}
        onClose={() => setConfirmation(null)}
      />
    </main>
  );
}
