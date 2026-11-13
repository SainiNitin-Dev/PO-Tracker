"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { requestJson } from "@/lib/client-request";
import ConfirmDialog, { type Confirmation } from "@/components/confirm-dialog";
type Muscle = { id: string; name: string };
type Exercise = { id: string; name: string };
type Mapping = { exercise_id: string; muscle_id: string; contribution: number };
export default function MuscleManager({
  muscles,
  exercises,
  mappings,
}: {
  muscles: Muscle[];
  exercises: Exercise[];
  mappings: Mapping[];
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
  const save = async (
    body: object,
    method = "POST",
    form?: HTMLFormElement,
  ) => {
    setWorking(true);
    setMessage(null);
    try {
      await requestJson("/api/admin/muscles", body, method);
      form?.reset();
      setMessage({
        text:
          method === "DELETE"
            ? "Removed."
            : "Saved. Training volume will use this mapping.",
      });
      transition(() => router.refresh());
    } catch (e) {
      setMessage({
        text: e instanceof Error ? e.message : "Could not save.",
        error: true,
      });
    } finally {
      setWorking(false);
    }
  };
  const submit = (action: string) => (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    void save(
      { action, ...Object.fromEntries(new FormData(form)) },
      "POST",
      form,
    );
  };
  return (
    <main className="app-page">
      <header className="page-header">
        <Link href="/admin" className="quiet-action -ml-4 mb-3">
          ← Gym catalog
        </Link>
        <p className="eyebrow">Exercise setup</p>
        <h1>Muscle groups</h1>
        <p>
          Choose the main muscles each exercise works. A main muscle counts as
          one full set; a supporting muscle counts as half a set in progress
          tracking.
        </p>
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
      <div className="grid items-start gap-6 md:grid-cols-2">
        <section className="surface">
          <h2 className="text-lg font-semibold">Your muscle groups</h2>
          <form
            onSubmit={submit("create")}
            className="mt-4 flex flex-wrap items-end gap-3"
          >
            <label className="field min-w-40 flex-1">
              Muscle group
              <input
                name="name"
                required
                maxLength={120}
                placeholder="e.g. Chest"
              />
            </label>
            <button disabled={busy} className="primary-action">
              {busy ? "Saving…" : "Add group"}
            </button>
          </form>
          <div className="mt-4">
            {muscles.map((m) => (
              <div className="data-row" key={m.id}>
                <span>{m.name}</span>
                <button
                  disabled={busy}
                  className="danger-action"
                  onClick={() =>
                    setConfirmation({
                      title: `Remove ${m.name}?`,
                      description:
                        "Groups used by exercises or member targets cannot be removed. Remove unused groups to keep your list tidy.",
                      label: "Remove group",
                      onConfirm: () => void save({ id: m.id }, "DELETE"),
                    })
                  }
                >
                  Remove
                </button>
              </div>
            ))}
            {!muscles.length && (
              <p className="empty-state">
                Add a muscle group, then link your exercises to it.
              </p>
            )}
          </div>
        </section>
        <form onSubmit={submit("map")} className="surface space-y-4">
          <h2 className="text-lg font-semibold">Link an exercise</h2>
          <label className="field">
            Exercise
            <select name="exerciseId" required>
              <option value="">Choose an exercise</option>
              {exercises.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
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
            How much does it contribute?
            <select name="contribution">
              <option value="1">Main muscle · one set</option>
              <option value="0.5">Supporting muscle · half a set</option>
            </select>
          </label>
          <p className="muted text-xs">
            Saving an existing exercise and muscle pair updates its
            contribution.
          </p>
          <button
            disabled={busy || !muscles.length || !exercises.length}
            className="primary-action"
          >
            {busy ? "Saving…" : "Save link"}
          </button>
        </form>
      </div>
      <section className="surface mt-6">
        <div className="section-heading">
          <h2>Exercise links</h2>
          <span className="badge">{mappings.length}</span>
        </div>
        {mappings.map((m) => (
          <div className="data-row" key={`${m.exercise_id}-${m.muscle_id}`}>
            <div>
              <p className="font-semibold">
                {exercises.find((e) => e.id === m.exercise_id)?.name}
              </p>
              <p className="muted mt-1 text-sm">
                {muscles.find((x) => x.id === m.muscle_id)?.name} ·{" "}
                {Number(m.contribution) === 1
                  ? "Main muscle"
                  : "Supporting muscle"}
              </p>
            </div>
            <button
              className="danger-action"
              disabled={busy}
              onClick={() =>
                setConfirmation({
                  title: "Remove this muscle link?",
                  description:
                    "This muscle will no longer contribute to volume calculations for this exercise.",
                  label: "Remove link",
                  onConfirm: () =>
                    void save(
                      { exerciseId: m.exercise_id, muscleId: m.muscle_id },
                      "DELETE",
                    ),
                })
              }
            >
              Remove
            </button>
          </div>
        ))}
        {!mappings.length && (
          <p className="empty-state">
            No exercise links yet. Choose an exercise and muscle above.
          </p>
        )}
      </section>
      <ConfirmDialog
        confirmation={confirmation}
        onClose={() => setConfirmation(null)}
      />
    </main>
  );
}
