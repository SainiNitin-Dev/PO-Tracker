"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { requestJson } from "@/lib/client-request";
import ConfirmDialog, { type Confirmation } from "@/components/confirm-dialog";

type Program = { id: string; name: string; is_active: boolean };
type Day = {
  id: string;
  program_id: string;
  name: string;
  weekday: number | null;
  sort_order: number;
};
type Exercise = { id: string; name: string; tracking_type: string };
type Entry = {
  id: string;
  program_day_id: string;
  exercise_id: string;
  target_sets: number;
  rep_min: number | null;
  rep_max: number | null;
  time_target_seconds: number | null;
  sort_order: number;
  exercise: {
    name: string;
    tracking_type: string;
    archived_at: string | null;
  } | null;
};
const weekdays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
type Save = (
  path: string,
  body: object,
  method?: string,
  after?: (result: { id?: string }) => void,
  success?: string,
) => Promise<void>;

export default function ProgramEditor({
  programs,
  days,
  exercises,
  entries,
}: {
  programs: Program[];
  days: Day[];
  exercises: Exercise[];
  entries: Entry[];
}) {
  const [selectedId, setSelectedId] = useState(
    programs.find((p) => p.is_active)?.id ?? programs[0]?.id ?? "",
  );
  const [working, setWorking] = useState(false);
  const [refreshing, transition] = useTransition();
  const busy = working || refreshing;
  const [message, setMessage] = useState<{
    text: string;
    error?: boolean;
  } | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const copyRequest = useRef<{
    planId: string;
    recipientId: string;
    requestId: string;
  } | null>(null);
  const router = useRouter();
  const program =
    programs.find((p) => p.id === selectedId) ??
    programs.find((p) => p.is_active) ??
    programs[0];
  const selectedDays = days
    .filter((d) => d.program_id === program?.id)
    .sort((a, b) => a.sort_order - b.sort_order);
  const save: Save = async (path, body, method = "POST", after, success) => {
    setWorking(true);
    setMessage(null);
    try {
      const result = await requestJson<{ id?: string }>(path, body, method);
      after?.(result);
      setMessage({
        text: success ?? "Plan saved. Your past workouts are unchanged.",
      });
      transition(() => router.refresh());
    } catch (e) {
      setMessage({
        text:
          e instanceof Error
            ? e.message
            : "That did not save. Please try again.",
        error: true,
      });
    } finally {
      setWorking(false);
    }
  };
  const remove = (path: string, id: string, title: string) =>
    setConfirmation({
      title,
      description:
        "This removes the selection from your plan. Your completed workouts and saved sets stay intact.",
      label: "Remove",
      onConfirm: () => void save(path, { id }, "DELETE"),
    });
  const createPlan = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    void save(
      "/api/programs",
      { name: new FormData(form).get("name") },
      "POST",
      (result) => {
        form.reset();
        if (result.id) setSelectedId(result.id);
      },
    );
  };
  return (
    <main className="app-page">
      <header className="page-header">
        <p className="eyebrow">Train your way</p>
        <h1>Your training plan</h1>
        <p>
          Set your days, choose your exercises, and adjust your targets as you
          go. Your active plan is the one you’ll see when starting a workout.
        </p>
        <Link href="/workout" className="quiet-action -ml-4 mt-2">
          Go to training →
        </Link>
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
      {busy && (
        <p className="muted mb-4 flex items-center gap-2 text-sm" role="status">
          <span className="spinner" />
          {refreshing ? "Updating your plan…" : "Saving…"}
        </p>
      )}
      <section className="surface mb-6">
        {programs.length > 0 && (
          <>
            <div className="flex flex-wrap items-end gap-4">
              <label className="field min-w-48 flex-1">
                Choose a plan
                <select
                  value={program?.id ?? ""}
                  onChange={(e) => setSelectedId(e.target.value)}
                  disabled={busy}
                >
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.is_active ? " · Active" : ""}
                    </option>
                  ))}
                </select>
              </label>
              {program?.is_active ? (
                <span className="badge mb-3">Active plan</span>
              ) : (
                program && (
                  <button
                    className="primary-action"
                    disabled={busy}
                    onClick={() =>
                      void save(
                        "/api/programs",
                        { id: program.id, name: program.name, activate: true },
                        "PATCH",
                      )
                    }
                  >
                    Use this plan
                  </button>
                )
              )}
            </div>
            <details className="mt-4">
              <summary>Rename or remove this plan</summary>
              {program && (
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <form
                    key={program.id + program.name}
                    onSubmit={(e) => {
                      e.preventDefault();
                      void save(
                        "/api/programs",
                        {
                          id: program.id,
                          name: new FormData(e.currentTarget).get("name"),
                          activate: false,
                        },
                        "PATCH",
                      );
                    }}
                    className="flex flex-1 flex-wrap items-end gap-3"
                  >
                    <label className="field min-w-40 flex-1">
                      Plan name
                      <input
                        name="name"
                        required
                        maxLength={100}
                        defaultValue={program.name}
                      />
                    </label>
                    <button className="secondary-action" disabled={busy}>
                      Save name
                    </button>
                  </form>
                  <button
                    className="danger-action"
                    disabled={busy}
                    onClick={() =>
                      remove(
                        "/api/programs",
                        program.id,
                        `Remove ${program.name}?`,
                      )
                    }
                  >
                    Remove plan
                  </button>
                </div>
              )}
            </details>
            {program && (
              <details key={program.id} className="mt-3">
                <summary>Copy to a member</summary>
                <p className="muted my-3 text-sm">
                  Ask your friend to copy their member ID from Profile. They can
                  find the copy under Your training plan and select Use this
                  plan. The copy includes days, exercises, and targets.
                </p>
                <form
                  className="flex flex-wrap items-end gap-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = event.currentTarget;
                    const recipientId = String(
                      new FormData(form).get("recipientId"),
                    )
                      .trim()
                      .toLowerCase();
                    setConfirmation({
                      title: `Copy ${program.name} to this member?`,
                      description: `Member ID: ${recipientId}. They’ll receive a separate copy to use or edit.`,
                      label: "Copy plan",
                      onConfirm: () => {
                        if (
                          copyRequest.current?.planId !== program.id ||
                          copyRequest.current.recipientId !== recipientId
                        ) {
                          copyRequest.current = {
                            planId: program.id,
                            recipientId,
                            requestId: crypto.randomUUID(),
                          };
                        }
                        void save(
                          "/api/programs/copy",
                          copyRequest.current,
                          "POST",
                          () => {
                            form.reset();
                            copyRequest.current = null;
                          },
                          "Plan copied. Your friend can now choose it in their plan editor.",
                        );
                      },
                    });
                  }}
                >
                  <label className="field min-w-48 flex-1">
                    Member ID
                    <input
                      name="recipientId"
                      required
                      maxLength={40}
                      autoCapitalize="none"
                      autoComplete="off"
                      spellCheck={false}
                      disabled={busy}
                    />
                  </label>
                  <button className="secondary-action" disabled={busy}>
                    Copy plan
                  </button>
                </form>
              </details>
            )}
          </>
        )}
        <details
          open={!programs.length}
          className={programs.length ? "mt-3" : ""}
        >
          <summary>Create a new plan</summary>
          <p className="muted mb-4 text-sm">
            A new plan becomes active. Your other plans remain available to
            switch back to.
          </p>
          <form
            onSubmit={createPlan}
            className="flex flex-wrap items-end gap-3"
          >
            <label className="field min-w-40 flex-1">
              Plan name
              <input
                name="name"
                placeholder="e.g. My Weekly Routine"
                required
                maxLength={100}
              />
            </label>
            <button disabled={busy} className="primary-action">
              Create plan
            </button>
          </form>
        </details>
      </section>
      {program && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Training days</h2>
            <span className="muted text-sm">
              {selectedDays.length} day{selectedDays.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="space-y-5">
            {selectedDays.map((day, index) => (
              <DayEditor
                key={day.id}
                day={day}
                entries={entries
                  .filter((e) => e.program_day_id === day.id)
                  .sort((a, b) => a.sort_order - b.sort_order)}
                exercises={exercises}
                busy={busy}
                save={save}
                remove={remove}
                first={index === 0}
                last={index === selectedDays.length - 1}
              />
            ))}
          </div>
          {!selectedDays.length && (
            <div className="empty-state">
              <h2>Make room for your first day.</h2>Give it a name, like Push or
              Full Body, then add the exercises you want to do.
            </div>
          )}
          <section className="surface mt-6">
            <h2 className="text-lg font-semibold">Add a training day</h2>
            <form
              className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto]"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                void save(
                  "/api/program-days",
                  {
                    programId: program.id,
                    ...Object.fromEntries(new FormData(form)),
                  },
                  "POST",
                  () => form.reset(),
                );
              }}
            >
              <label className="field">
                Day name
                <input
                  name="name"
                  required
                  maxLength={80}
                  placeholder="e.g. Push"
                />
              </label>
              <label className="field">
                Day of the week
                <select name="weekday" defaultValue="1">
                  {weekdays.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <button disabled={busy} className="primary-action self-end">
                Add day
              </button>
            </form>
          </section>
        </>
      )}
      <ConfirmDialog
        confirmation={confirmation}
        onClose={() => setConfirmation(null)}
      />
    </main>
  );
}

function DayEditor({
  day,
  entries,
  exercises,
  busy,
  save,
  remove,
  first,
  last,
}: {
  day: Day;
  entries: Entry[];
  exercises: Exercise[];
  busy: boolean;
  save: Save;
  remove: (path: string, id: string, title: string) => void;
  first: boolean;
  last: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  return (
    <section className="surface">
      <div className="section-heading">
        <div>
          <p className="eyebrow">
            {day.weekday === null ? "Flexible day" : weekdays[day.weekday]}
          </p>
          <h2 className="mt-1">{day.name}</h2>
        </div>
        <div className="flex gap-1">
          <button
            className="quiet-action"
            disabled={busy || first}
            aria-label={`Move ${day.name} up`}
            onClick={() =>
              void save(
                "/api/program-days",
                { id: day.id, direction: -1 },
                "PATCH",
              )
            }
          >
            ↑
          </button>
          <button
            className="quiet-action"
            disabled={busy || last}
            aria-label={`Move ${day.name} down`}
            onClick={() =>
              void save(
                "/api/program-days",
                { id: day.id, direction: 1 },
                "PATCH",
              )
            }
          >
            ↓
          </button>
        </div>
      </div>
      <details>
        <summary className="muted text-sm">Edit day</summary>
        <div className="mb-5 flex flex-wrap items-end gap-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save(
                "/api/program-days",
                {
                  id: day.id,
                  ...Object.fromEntries(new FormData(e.currentTarget)),
                },
                "PATCH",
              );
            }}
            className="flex flex-1 flex-wrap items-end gap-3"
          >
            <label className="field min-w-32 flex-1">
              Day name
              <input
                required
                name="name"
                maxLength={80}
                defaultValue={day.name}
              />
            </label>
            <label className="field min-w-32 flex-1">
              Weekday
              <select name="weekday" defaultValue={day.weekday ?? 1}>
                {weekdays.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <button className="secondary-action" disabled={busy}>
              Save day
            </button>
          </form>
          <button
            disabled={busy}
            className="danger-action"
            onClick={() =>
              remove(
                "/api/program-days",
                day.id,
                `Remove ${day.name} and its exercises?`,
              )
            }
          >
            Remove day
          </button>
        </div>
      </details>
      <ol>
        {entries.map((entry, index) => (
          <li
            key={entry.id}
            className="border-b border-[#e6e7dd] py-4 last:border-0"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-semibold">
                  {index + 1}. {entry.exercise?.name ?? "Unavailable exercise"}
                </h3>
                <p className="muted mt-1 text-sm">
                  {entry.target_sets} working sets ·{" "}
                  {entry.time_target_seconds
                    ? `${entry.time_target_seconds} seconds`
                    : `${entry.rep_min}–${entry.rep_max} reps`}
                </p>
                {entry.exercise?.archived_at && (
                  <p className="mt-2 text-sm text-[#9b3730]">
                    Removed from the gym library. Replace or remove this
                    exercise before training.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                <button
                  disabled={busy || index === 0}
                  className="quiet-action"
                  aria-label={`Move ${entry.exercise?.name} up`}
                  onClick={() =>
                    void save(
                      "/api/program-exercises",
                      { id: entry.id, direction: -1 },
                      "PATCH",
                    )
                  }
                >
                  ↑
                </button>
                <button
                  disabled={busy || index === entries.length - 1}
                  className="quiet-action"
                  aria-label={`Move ${entry.exercise?.name} down`}
                  onClick={() =>
                    void save(
                      "/api/program-exercises",
                      { id: entry.id, direction: 1 },
                      "PATCH",
                    )
                  }
                >
                  ↓
                </button>
                <button
                  disabled={busy}
                  className="quiet-action"
                  onClick={() =>
                    setEditingId(editingId === entry.id ? null : entry.id)
                  }
                >
                  Edit<span className="sr-only"> {entry.exercise?.name}</span>
                </button>
                <button
                  disabled={busy}
                  className="danger-action"
                  onClick={() =>
                    remove(
                      "/api/program-exercises",
                      entry.id,
                      `Remove ${entry.exercise?.name ?? "this exercise"}?`,
                    )
                  }
                >
                  Remove<span className="sr-only"> {entry.exercise?.name}</span>
                </button>
              </div>
            </div>
            {editingId === entry.id && (
              <ExerciseForm
                dayId={day.id}
                exercises={exercises}
                entry={entry}
                busy={busy}
                save={save}
                onSaved={() => setEditingId(null)}
              />
            )}
          </li>
        ))}
      </ol>
      {!entries.length && (
        <p className="empty-state !py-4">
          No exercises yet. Add a movement below.
        </p>
      )}
      <details className="mt-4">
        <summary>Add an exercise</summary>
        <ExerciseForm
          dayId={day.id}
          exercises={exercises}
          busy={busy}
          save={save}
        />
      </details>
    </section>
  );
}

function ExerciseForm({
  dayId,
  exercises,
  entry,
  busy,
  save,
  onSaved,
}: {
  dayId: string;
  exercises: Exercise[];
  entry?: Entry;
  busy: boolean;
  save: Save;
  onSaved?: () => void;
}) {
  const [exerciseId, setExerciseId] = useState(entry?.exercise_id ?? "");
  const type =
    exercises.find((e) => e.id === exerciseId)?.tracking_type ??
    entry?.exercise?.tracking_type;
  const timed = type === "time" || type === "weighted_time";
  return (
    <form
      className="mt-4 space-y-4 rounded-lg bg-[#f6f7ef] p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        void save(
          "/api/program-exercises",
          {
            ...Object.fromEntries(new FormData(form)),
            ...(entry ? { id: entry.id } : { programDayId: dayId }),
          },
          entry ? "PATCH" : "POST",
          () => {
            if (!entry) {
              form.reset();
              setExerciseId("");
            }
            onSaved?.();
          },
        );
      }}
    >
      <label className="field">
        Exercise
        <select
          name="exerciseId"
          required
          value={exerciseId}
          onChange={(e) => setExerciseId(e.target.value)}
        >
          <option value="">Choose an exercise</option>
          {entry?.exercise?.archived_at && (
            <option value={entry.exercise_id}>
              {entry.exercise.name} · Removed
            </option>
          )}
          {exercises.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className="field">
          Working sets
          <input
            name="targetSets"
            required
            type="number"
            inputMode="numeric"
            min={1}
            max={12}
            defaultValue={entry?.target_sets ?? 2}
          />
        </label>
        {timed ? (
          <label className="field">
            Seconds per set
            <input
              name="timeTargetSeconds"
              required
              type="number"
              inputMode="numeric"
              min={1}
              max={86400}
              defaultValue={entry?.time_target_seconds ?? 30}
            />
          </label>
        ) : (
          <>
            <label className="field">
              Minimum reps
              <input
                name="repMin"
                required
                type="number"
                inputMode="numeric"
                min={1}
                max={1000}
                defaultValue={entry?.rep_min ?? 6}
              />
            </label>
            <label className="field">
              Maximum reps
              <input
                name="repMax"
                required
                type="number"
                inputMode="numeric"
                min={1}
                max={1000}
                defaultValue={entry?.rep_max ?? 10}
              />
            </label>
          </>
        )}
      </div>
      <button className="primary-action" disabled={busy || !exerciseId}>
        {busy ? "Saving…" : entry ? "Save exercise" : "Add exercise"}
      </button>
      {!exercises.length && (
        <p className="muted text-sm">
          Your gym admin needs to add exercises to the library first.
        </p>
      )}
    </form>
  );
}
