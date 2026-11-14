"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { requestJson } from "@/lib/client-request";
import ConfirmDialog, { type Confirmation } from "@/components/confirm-dialog";

type Muscle = { id: string; name: string };
type Exercise = { id: string; name: string };
type Mapping = { exercise_id: string; muscle_id: string; contribution: number };
type Role = "primary" | "secondary";
type Selection = Record<string, Role | undefined>;

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
  const [exerciseId, setExerciseId] = useState(exercises[0]?.id ?? "");
  const [draft, setDraft] = useState<Selection | null>(null);
  const [working, setWorking] = useState("");
  const [refreshing, transition] = useTransition();
  const [message, setMessage] = useState<{
    text: string;
    error?: boolean;
  } | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const busy = Boolean(working) || refreshing;
  const exercise = exercises.find((item) => item.id === exerciseId);
  const saved = Object.fromEntries(
    mappings
      .filter((item) => item.exercise_id === exerciseId)
      .map((item) => [
        item.muscle_id,
        Number(item.contribution) === 1 ? "primary" : "secondary",
      ]),
  ) as Selection;
  const selection = draft ?? saved;
  const dirty = muscles.some(({ id }) => selection[id] !== saved[id]);
  const primary = muscles.filter(({ id }) => selection[id] === "primary");
  const secondary = muscles.filter(({ id }) => selection[id] === "secondary");

  async function save(
    body: object,
    action: string,
    success: string,
    method = "POST",
    form?: HTMLFormElement,
  ) {
    setWorking(action);
    setMessage(null);
    try {
      await requestJson("/api/admin/muscles", body, method);
      form?.reset();
      setMessage({ text: success });
      transition(() => router.refresh());
    } catch (error) {
      setMessage({
        text:
          error instanceof Error ? error.message : "Could not save. Try again.",
        error: true,
      });
    } finally {
      setWorking("");
    }
  }

  function chooseExercise(id: string) {
    const change = () => {
      setExerciseId(id);
      setDraft(null);
      setMessage(null);
    };
    if (dirty) {
      setConfirmation({
        title: "Switch exercises?",
        description: "You have unsaved muscle assignments for this exercise.",
        label: "Discard and switch",
        onConfirm: change,
      });
    } else change();
  }

  function saveMapping(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!exercise || !dirty || busy) return;
    const submit = () =>
      void save(
        {
          action: "replace",
          exerciseId,
          primary: primary.map(({ id }) => id),
          secondary: secondary.map(({ id }) => id),
        },
        "mapping",
        `Muscles saved for ${exercise.name}.`,
      );
    if (!primary.length && !secondary.length) {
      setConfirmation({
        title: `Clear muscles for ${exercise.name}?`,
        description:
          "This exercise will no longer count toward any muscle’s training volume.",
        label: "Clear muscles",
        onConfirm: submit,
      });
    } else submit();
  }

  return (
    <main className="app-page">
      <header className="page-header">
        <Link href="/admin" className="quiet-action -ml-4 mb-3">
          ← Gym catalog
        </Link>
        <h1>Assign muscles to exercises</h1>
        <p>
          Choose an exercise, select its muscles, and save all assignments
          together.
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
      <form
        onSubmit={saveMapping}
        className="surface space-y-5"
        aria-busy={working === "mapping"}
      >
        <label className="field max-w-md">
          Exercise
          <select
            value={exerciseId}
            onChange={(event) => chooseExercise(event.target.value)}
            disabled={busy || !exercises.length}
          >
            <option value="" disabled>
              Choose an exercise
            </option>
            {exercises.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        {!exercises.length && (
          <p className="muted">
            Add an exercise in the{" "}
            <Link href="/admin" className="underline">
              gym catalog
            </Link>{" "}
            first.
          </p>
        )}
        {!muscles.length && (
          <p className="muted">Add a muscle group using the form below.</p>
        )}
        {exercise && muscles.length > 0 && (
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              {(["primary", "secondary"] as const).map((role) => (
                <fieldset key={role} className="min-w-0" disabled={busy}>
                  <legend className="font-semibold">
                    {role === "primary"
                      ? "Primary muscles"
                      : "Secondary muscles"}
                  </legend>
                  <p className="muted mb-2 text-sm">
                    {role === "primary"
                      ? "Count as one full set each."
                      : "Count as half a set each."}
                  </p>
                  <div className="max-h-80 overflow-y-auto rounded-lg border border-[#ded9ce] p-1">
                    {muscles.map((muscle) => (
                      <label
                        key={muscle.id}
                        className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 py-2 hover:bg-[#eeece4]"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 shrink-0 accent-[#4c5c3e]"
                          checked={selection[muscle.id] === role}
                          onChange={(event) =>
                            setDraft({
                              ...selection,
                              [muscle.id]: event.target.checked
                                ? role
                                : undefined,
                            })
                          }
                        />
                        {muscle.name}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
            <div className="text-sm">
              <p>
                <strong>Primary:</strong>{" "}
                {primary.map(({ name }) => name).join(", ") || "None"}
              </p>
              <p>
                <strong>Secondary:</strong>{" "}
                {secondary.map(({ name }) => name).join(", ") || "None"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="primary-action" disabled={!dirty || busy}>
                {working === "mapping"
                  ? "Saving muscles…"
                  : "Save muscle assignments"}
              </button>
              {dirty && (
                <button
                  type="button"
                  className="secondary-action"
                  disabled={busy}
                  onClick={() => setDraft(null)}
                >
                  Undo changes
                </button>
              )}
            </div>
          </>
        )}
      </form>
      <details
        className="surface mt-6"
        open={muscles.length ? undefined : true}
      >
        <summary className="cursor-pointer font-semibold">
          Manage muscle groups ({muscles.length})
        </summary>
        <form
          className="mt-4 flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            void save(
              { action: "create", name: new FormData(form).get("name") },
              "create",
              "Muscle group added.",
              "POST",
              form,
            );
          }}
        >
          <label className="field min-w-40 flex-1">
            Muscle group
            <input
              name="name"
              required
              maxLength={80}
              placeholder="e.g. Chest"
              disabled={busy}
            />
          </label>
          <button disabled={busy} className="primary-action">
            {working === "create" ? "Adding…" : "Add group"}
          </button>
        </form>
        <div className="mt-4">
          {muscles.map((muscle) => (
            <div className="data-row" key={muscle.id}>
              <span>{muscle.name}</span>
              <button
                disabled={busy}
                className="danger-action"
                aria-label={`Remove ${muscle.name}`}
                onClick={() =>
                  setConfirmation({
                    title: `Remove ${muscle.name}?`,
                    description:
                      "Groups used by exercises or member targets cannot be removed.",
                    label: "Remove group",
                    onConfirm: () =>
                      void save(
                        { id: muscle.id },
                        "delete",
                        `${muscle.name} removed.`,
                        "DELETE",
                      ),
                  })
                }
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </details>
      <ConfirmDialog
        confirmation={confirmation}
        onClose={() => setConfirmation(null)}
      />
    </main>
  );
}
