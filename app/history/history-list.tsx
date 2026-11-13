"use client";
import Link from "next/link";
import { useState } from "react";
import { historyRecords, type HistorySession } from "@/lib/history";
import { requestJson } from "@/lib/client-request";
export default function HistoryList({
  sessions,
}: {
  sessions: HistorySession[];
}) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("sessions");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState<{
    text: string;
    error?: boolean;
  } | null>(null);
  const matches = (text: string) =>
    text.toLowerCase().includes(search.trim().toLowerCase());
  const filtered = sessions.filter((s) =>
    matches(`${s.gym} ${s.day} ${s.exercises.map((e) => e.name).join(" ")}`),
  );
  const records = historyRecords(sessions).filter((r) =>
    matches(`${r.name} ${r.gym} ${r.equipmentLabel ?? ""}`),
  );
  const soreness = async (exerciseId: string, rating: string) => {
    setBusy(exerciseId);
    setMessage(null);
    try {
      await requestJson("/api/soreness", { exerciseId, rating });
      setMessage({ text: "Soreness saved. Your coach can use this feedback." });
    } catch (e) {
      setMessage({
        text: e instanceof Error ? e.message : "Could not save feedback.",
        error: true,
      });
    } finally {
      setBusy("");
    }
  };
  return (
    <main className="app-page">
      <header className="page-header">
        <p className="eyebrow">Your training, remembered</p>
        <h1>Workout history</h1>
        <p>
          Review your sets and compare records on the same gym equipment. Expand
          a session to see every saved set.
        </p>
        <Link href="/progress" className="quiet-action -ml-4 mt-2">
          ← Progress overview
        </Link>
      </header>
      {message && (
        <p
          className="status-message mb-5"
          data-tone={message.error ? "error" : "success"}
          role={message.error ? "alert" : "status"}
        >
          {message.text}
        </p>
      )}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button
          aria-pressed={tab === "sessions"}
          onClick={() => setTab("sessions")}
          className={tab === "sessions" ? "primary-action" : "secondary-action"}
        >
          Sessions
        </button>
        <button
          aria-pressed={tab === "records"}
          onClick={() => setTab("records")}
          className={tab === "records" ? "primary-action" : "secondary-action"}
        >
          Best in this view
        </button>
        <label className="field min-w-44 flex-1">
          <span className="sr-only">Find a workout or exercise</span>
          <input
            type="search"
            placeholder="Find a workout or exercise…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      {tab === "records" ? (
        <>
          <p className="muted mb-4 text-sm">
            Records from the workouts on this page. Warm-up and drop sets are
            excluded. Estimated strength uses loaded sets of 1–12 reps, not a
            tested maximum.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {records.map((r) => (
              <article className="surface" key={r.equipmentId}>
                <h2 className="text-lg font-semibold">{r.name}</h2>
                <p className="muted mt-1 text-sm">
                  {r.gym}
                  {r.equipmentLabel ? ` · ${r.equipmentLabel}` : ""}
                </p>
                <dl className="mt-5 grid grid-cols-2 gap-5">
                  {(r.trackingType === "reps" ||
                    r.trackingType === "weighted_time") && (
                    <div>
                      <dt className="muted text-xs">Heaviest working set</dt>
                      <dd className="mt-1 text-xl font-semibold">
                        {r.weight} kg
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="muted text-xs">
                      {r.seconds ? "Longest working set" : "Most reps in a set"}
                    </dt>
                    <dd className="mt-1 text-xl font-semibold">
                      {r.seconds ? `${r.seconds} sec` : r.reps}
                    </dd>
                  </div>
                  {r.estimate > 0 && (
                    <div>
                      <dt className="muted text-xs">Best strength estimate</dt>
                      <dd className="mt-1 text-xl font-semibold">
                        {r.estimate} kg
                      </dd>
                    </div>
                  )}
                </dl>
              </article>
            ))}
          </div>
          {!records.length && (
            <p className="empty-state">
              No working-set records match this view.
            </p>
          )}
        </>
      ) : (
        <div className="space-y-4">
          {filtered.map((s) => (
            <details className="surface" key={s.id}>
              <summary>
                <span className="flex flex-wrap items-center justify-between gap-3">
                  <span>
                    {s.day}
                    <span className="muted mt-1 block text-sm font-normal">
                      {s.gym} ·{" "}
                      {new Date(s.performed_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        timeZone: "Asia/Kolkata",
                      })}
                    </span>
                  </span>
                  <span className="badge">
                    {s.status === "completed" ? "Completed" : "Ended early"}
                  </span>
                </span>
              </summary>
              {s.notes && (
                <p className="muted my-4 whitespace-pre-wrap text-sm">
                  {s.notes}
                </p>
              )}
              {s.bodyweight_kg && (
                <p className="muted mt-3 text-sm">
                  Body weight: {s.bodyweight_kg} kg
                </p>
              )}
              <div className="mt-5 space-y-6">
                {s.exercises.map((e) => (
                  <section key={e.id}>
                    <h3 className="font-semibold">{e.name}</h3>
                    {e.equipmentLabel && (
                      <p className="muted mt-1 text-xs">{e.equipmentLabel}</p>
                    )}
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <caption className="sr-only">
                          {e.name} saved sets
                        </caption>
                        <thead>
                          <tr className="muted">
                            <th className="py-2 font-normal">Set</th>
                            <th className="py-2 font-normal">Weight</th>
                            <th className="py-2 font-normal">
                              {e.trackingType.includes("time")
                                ? "Seconds"
                                : "Reps"}
                            </th>
                            <th className="py-2 font-normal">Reps left</th>
                          </tr>
                        </thead>
                        <tbody>
                          {e.sets.map((set, i) => (
                            <tr key={set.id}>
                              <th className="py-2 pr-3 font-normal">
                                {i + 1} ·{" "}
                                {set.set_kind === "working"
                                  ? "Work"
                                  : set.set_kind === "warmup"
                                    ? "Warm-up"
                                    : "Drop"}
                              </th>
                              <td>
                                {set.weight_kg === null
                                  ? "—"
                                  : `${set.weight_kg} kg`}
                              </td>
                              <td>{set.reps ?? set.duration_seconds}</td>
                              <td>{set.rir ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {!e.sets.length && (
                      <p className="muted py-2 text-sm">
                        No sets saved for this exercise.
                      </p>
                    )}
                    {e.notes && (
                      <p className="muted mt-3 whitespace-pre-wrap text-sm">
                        {e.notes}
                      </p>
                    )}
                    {e.pump && (
                      <p className="muted mt-2 text-sm">
                        Muscle pump: {e.pump}/5
                      </p>
                    )}
                    {s.status === "completed" && (
                      <form
                        className="mt-4 flex flex-wrap items-end gap-3"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void soreness(
                            e.id,
                            String(
                              new FormData(event.currentTarget).get("rating"),
                            ),
                          );
                        }}
                      >
                        <label className="field min-w-36 flex-1">
                          Soreness afterward
                          <select
                            name="rating"
                            defaultValue={e.soreness ?? ""}
                            required
                          >
                            <option value="">How did it feel later?</option>
                            <option value="1">1 · None</option>
                            <option value="2">2 · Mild</option>
                            <option value="3">3 · Moderate</option>
                            <option value="4">4 · High</option>
                            <option value="5">5 · Very high</option>
                          </select>
                        </label>
                        <button
                          disabled={Boolean(busy)}
                          className="secondary-action"
                        >
                          {busy === e.id ? "Saving…" : "Save feedback"}
                        </button>
                      </form>
                    )}
                  </section>
                ))}
              </div>
            </details>
          ))}
          {!filtered.length && (
            <div className="empty-state">
              <h2>
                {sessions.length
                  ? "No matches on this page."
                  : "Your story starts with a session."}
              </h2>
              {sessions.length ? (
                "Try a different search or browse another page."
              ) : (
                <Link className="underline" href="/workout">
                  Start a workout to build your history.
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
