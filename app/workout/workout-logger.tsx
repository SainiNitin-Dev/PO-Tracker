"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ActiveWorkout,
  WorkoutExercise,
  WorkoutOptions,
  WorkoutSet,
} from "@/lib/workout-types";
import { validateSet } from "@/lib/training-validation";
import { requestJson } from "@/lib/client-request";

async function save(body: object) {
  return requestJson<{ workout: ActiveWorkout | null; set: WorkoutSet }>("/api/workouts", body);
}

export default function WorkoutLogger({
  options,
  initialWorkout,
}: {
  options: WorkoutOptions;
  initialWorkout: ActiveWorkout | null;
}) {
  const [workout, setWorkout] = useState(initialWorkout);
  const [gymId, setGymId] = useState(options.gyms[0]?.id ?? "");
  const [dayId, setDayId] = useState(options.days[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [setBusyCount, setSetBusyCount] = useState(0);
  const [unsaved, setUnsaved] = useState<Record<string, boolean>>({});
  const onDirty = useCallback((id: string, dirty: boolean) => setUnsaved(current => current[id] === dirty ? current : { ...current, [id]: dirty }), []);
  const hasUnsaved = Object.values(unsaved).some(Boolean);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [online, setOnline] = useState(true);
  const [endAction, setEndAction] = useState<"complete" | "abandon" | null>(
    null,
  );
  const [notes, setNotes] = useState(initialWorkout?.notes ?? "");
  const [bodyweight, setBodyweight] = useState(
    initialWorkout?.bodyweight_kg?.toString() ?? "",
  );
  const [restUntil, setRestUntil] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const restKey = workout
    ? `progressive:rest:${options.userId}:${workout.id}`
    : null;
  const notesKey = workout
    ? `progressive:workout:${options.userId}:${workout.id}`
    : null;
  const selected = useMemo(
    () => options.entries.filter((entry) => entry.program_day_id === dayId),
    [options.entries, dayId],
  );
  const unavailable = selected.filter(
    (entry) =>
      entry.archived ||
      !options.availability.some(
        (item) =>
          item.gym_id === gymId && item.exercise_id === entry.exercise_id,
      ),
  );

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    const today = options.days.find(
      (day) => day.weekday === new Date().getDay(),
    );
    if (today) setDayId(today.id);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [options.days]);

  useEffect(() => {
    if (!restKey) {
      setRestUntil(null);
      return;
    }
    try {
      const deadline = Number(localStorage.getItem(restKey));
      if (deadline > Date.now()) setRestUntil(deadline);
    } catch {
      /* Storage can be disabled in private browsing. */
    }
  }, [restKey]);

  useEffect(() => {
    if (!notesKey) return;
    try {
      const saved = localStorage.getItem(notesKey);
      if (saved) {
        const draft = JSON.parse(saved);
        setNotes(draft.notes ?? "");
        setBodyweight(draft.bodyweight ?? "");
      }
    } catch {
      /* Server-saved workout stays available if local storage is unavailable. */
    }
  }, [notesKey]);

  useEffect(() => {
    if (!restUntil) {
      setSecondsLeft(0);
      return;
    }
    const tick = () =>
      setSecondsLeft(Math.max(0, Math.ceil((restUntil - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [restUntil]);

  function rememberNotes(nextNotes: string, nextWeight: string) {
    setNotes(nextNotes);
    setBodyweight(nextWeight);
    try {
      if (notesKey)
        localStorage.setItem(
          notesKey,
          JSON.stringify({ notes: nextNotes, bodyweight: nextWeight }),
        );
    } catch {
      /* Keep fields in memory. */
    }
  }

  function startRest(seconds = 90) {
    const deadline = Date.now() + seconds * 1000;
    setRestUntil(deadline);
    try {
      if (restKey) localStorage.setItem(restKey, String(deadline));
    } catch {
      /* Timer still works in this tab. */
    }
  }

  async function begin() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await save({
        action: "start",
        gymId,
        programDayId: dayId,
      });
      setWorkout(result.workout);
      setNotes(result.workout?.notes ?? "");
      setBodyweight(result.workout?.bodyweight_kg?.toString() ?? "");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "We could not start your workout. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (!workout || !endAction || hasUnsaved || setBusyCount > 0) return;
    setBusy(true);
    setError("");
    try {
      await save({
        action: endAction,
        sessionId: workout.id,
        notes,
        bodyweightKg: bodyweight,
      });
      try {
        if (restKey) localStorage.removeItem(restKey);
        if (notesKey) localStorage.removeItem(notesKey);
        for (const exercise of workout.exercises)
          localStorage.removeItem(
            `progressive:set:${options.userId}:${workout.id}:${exercise.id}`,
          );
      } catch {
        /* Saved data lives on the server. */
      }
      setNotice(
        endAction === "complete"
          ? "Workout complete. Your sets are saved in your history."
          : "Workout ended. Any saved sets are kept in your history.",
      );
      setWorkout(null);
      setUnsaved({});
      setEndAction(null);
      setRestUntil(null);
      // Older versions could leave several unfinished sessions. Offer the next one without losing it.
      try {
        const result = await requestJson<{workout: ActiveWorkout | null}>("/api/workouts", undefined, "GET");
        setWorkout(result.workout);
        setNotes(result.workout?.notes ?? "");
        setBodyweight(result.workout?.bodyweight_kg?.toString() ?? "");
      } catch { /* The finished workout is saved. Any older open session loads on the next visit. */ }
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "We could not finish your workout. Your saved sets are safe.",
      );
    } finally {
      setBusy(false);
    }
  }

  function updateSets(exerciseId: string, sets: WorkoutSet[]) {
    setWorkout(
      (current) =>
        current && {
          ...current,
          exercises: current.exercises.map((exercise) =>
            exercise.id === exerciseId ? { ...exercise, sets } : exercise,
          ),
        },
    );
  }

  const workingCount =
    workout?.exercises.reduce(
      (sum, exercise) =>
        sum + exercise.sets.filter((set) => set.set_kind === "working").length,
      0,
    ) ?? 0;
  const plannedCount =
    workout?.exercises.reduce(
      (sum, exercise) => sum + exercise.targetSets,
      0,
    ) ?? 0;

  return (
    <main className="app-page space-y-6">
      <header className="page-header">
        <p className="eyebrow">Training</p>
        <h1>{workout ? workout.dayName : "Make time for progress."}</h1>
        <p className="muted">
          {workout
            ? `${workout.gymName} · Started ${new Date(workout.performed_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}`
            : "Pick your gym and training day. We’ll keep track of every set."}
        </p>
      </header>
      {!online && (
        <p className="status-message" role="status">
          You’re offline. Your unsaved set stays on this device. Reconnect and
          tap Save Set to retry.
        </p>
      )}
      {error && (
        <p className="status-message" data-tone="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="status-message" data-tone="success" role="status">
          {notice} <Link href="/history">View history →</Link>
        </p>
      )}
      {!workout ? (
        <>
          {!options.gyms.length || !options.days.length ? (
            <section className="empty-state">
              <h2>
                {!options.gyms.length
                  ? "Your gym is not set up yet"
                  : "Start with a training plan"}
              </h2>
              <p>
                {!options.gyms.length
                  ? "Ask your admin to add a gym and its exercises. Your training plan will be ready to use here."
                  : "Create a plan with the days and exercises you want to train."}
              </p>
              <Link className="secondary-action" href="/program">
                Open my plan
              </Link>
            </section>
          ) : (
            <section className="surface space-y-5 p-5 sm:p-6">
              <label className="field">
                Gym
                <select
                  value={gymId}
                  onChange={(event) => setGymId(event.target.value)}
                >
                  {options.gyms.map((gym) => (
                    <option key={gym.id} value={gym.id}>
                      {gym.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Training day
                <select
                  value={dayId}
                  onChange={(event) => setDayId(event.target.value)}
                >
                  {options.days.map((day) => (
                    <option key={day.id} value={day.id}>
                      {day.name}
                    </option>
                  ))}
                </select>
              </label>
              {selected.length ? (
                <div>
                  <p className="mb-2 text-sm font-semibold">
                    {selected.length} exercises in this session
                  </p>
                  <ol className="space-y-2 text-sm">
                    {selected.map((entry, index) => (
                      <li key={entry.id} className="flex gap-3">
                        <span className="muted tabular-nums">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span>
                          {entry.name}
                          {unavailable.some((item) => item.id === entry.id) && (
                            <span className="ml-2 text-[#9c422b]">
                              Unavailable
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : (
                <p className="muted">
                  This day has no exercises.{" "}
                  <Link href="/program">Add exercises to your plan.</Link>
                </p>
              )}
              {unavailable.length > 0 && (
                <p className="status-message" data-tone="error">
                  Some exercises are unavailable at this gym. Choose another
                  gym, edit your plan, or ask your admin to add them.
                </p>
              )}
              <button
                className="primary-action w-full"
                disabled={
                  busy || !online || !selected.length || unavailable.length > 0
                }
                onClick={begin}
              >
                {busy ? "Starting…" : "Start Workout"}
              </button>
              <Link href="/program" className="quiet-action block text-center">
                Edit My Plan
              </Link>
            </section>
          )}
        </>
      ) : (
        <>
          <section className="space-y-2" aria-label="Workout progress">
            <div className="flex justify-between text-sm">
              <span>{workingCount} working sets saved</span>
              <span className="muted">{plannedCount} planned</span>
            </div>
            <progress
              className="h-2 w-full accent-[#566146]"
              value={Math.min(workingCount, plannedCount)}
              max={plannedCount || 1}
              aria-label="Working sets completed"
            />
          </section>
          {restUntil && (
            <section
              className="surface flex flex-wrap items-center justify-between gap-3 p-4"
              aria-label="Rest timer"
            >
              <div>
                <p className="eyebrow">Rest timer</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {secondsLeft
                    ? `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`
                    : "Ready for your next set"}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  className="quiet-action"
                  onClick={() => startRest(secondsLeft + 30)}
                >
                  +30s
                </button>
                <button
                  className="quiet-action"
                  onClick={() => {
                    setRestUntil(null);
                    try {
                      if (restKey) localStorage.removeItem(restKey);
                    } catch {}
                  }}
                >
                  Dismiss
                </button>
              </div>
            </section>
          )}
          {workout.exercises.map((exercise, index) => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              index={index}
              draftKey={`progressive:set:${options.userId}:${workout.id}:${exercise.id}`}
              disabled={busy}
              onDirty={onDirty}
              onBusy={(active) =>
                setSetBusyCount((count) => count + (active ? 1 : -1))
              }
              onSets={(sets) => updateSets(exercise.id, sets)}
              onSaved={() => startRest()}
            />
          ))}
          <section className="surface space-y-4 p-5">
            <h2 className="section-heading">How did it feel?</h2>
            <label className="field">
              Workout notes{" "}
              <span className="muted font-normal">(optional)</span>
              <textarea
                disabled={busy}
                value={notes}
                onChange={(event) =>
                  rememberNotes(event.target.value, bodyweight)
                }
                maxLength={2000}
                rows={3}
                placeholder="Energy, form, pain, or anything to remember"
              />
            </label>
            <label className="field">
              Body weight in kg{" "}
              <span className="muted font-normal">(optional)</span>
              <input
                disabled={busy}
                inputMode="decimal"
                type="number"
                min="20"
                max="500"
                step="0.1"
                value={bodyweight}
                onChange={(event) => rememberNotes(notes, event.target.value)}
              />
            </label>
            {hasUnsaved && <p className="status-message" role="status">You have unsaved set or exercise-note changes. Save them, or discard those changes below the exercise, before ending this workout.</p>}
            {endAction ? (
              <div
                className="space-y-3"
                role="group"
                aria-label="Confirm ending workout"
              >
                <p>
                  {endAction === "complete"
                    ? "Finish this workout? Saved sets will appear in your progress."
                    : "End without completing? Your saved sets will be kept, but this workout won’t count towards progress."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="primary-action"
                    disabled={busy || setBusyCount > 0 || hasUnsaved}
                    onClick={finish}
                  >
                    {busy
                      ? "Saving…"
                      : endAction === "complete"
                        ? "Finish Workout"
                        : "End Workout"}
                  </button>
                  <button
                    disabled={busy}
                    className="secondary-action"
                    onClick={() => setEndAction(null)}
                  >
                    Keep Training
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <button
                  className="primary-action"
                  disabled={busy || setBusyCount > 0 || hasUnsaved || workingCount === 0}
                  onClick={() => setEndAction("complete")}
                >
                  Finish Workout
                </button>
                <button
                  className="quiet-action"
                  disabled={busy || setBusyCount > 0 || hasUnsaved}
                  onClick={() => setEndAction("abandon")}
                >
                  End Without Completing
                </button>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

type Draft = {
  id: string;
  kind: "working" | "warmup" | "drop";
  weight: string;
  amount: string;
  rir: string;
};
const blankDraft = (): Draft => ({
  id: "",
  kind: "working",
  weight: "",
  amount: "",
  rir: "",
});

function ExerciseCard({
  exercise,
  index,
  draftKey,
  disabled,
  onBusy,
  onSets,
  onSaved,
  onDirty,
}: {
  exercise: WorkoutExercise;
  index: number;
  draftKey: string;
  disabled: boolean;
  onBusy: (busy: boolean) => void;
  onSets: (sets: WorkoutSet[]) => void;
  onSaved: () => void;
  onDirty: (id: string, dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [pump, setPump] = useState(exercise.pumpRating?.toString() ?? "");
  const [notes, setNotes] = useState(exercise.notes ?? "");
  const [dirty, setDirty] = useState(false);
  const [feedbackDirty, setFeedbackDirty] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState({pump: exercise.pumpRating?.toString() ?? "", notes: exercise.notes ?? ""});
  const feedbackKey = `${draftKey}:feedback`;
  useEffect(() => { onDirty(exercise.id, dirty || feedbackDirty); }, [exercise.id, dirty, feedbackDirty, onDirty]);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(feedbackKey);
      if (stored) { const value = JSON.parse(stored); if (typeof value.notes === "string" && typeof value.pump === "string") { setPump(value.pump); setNotes(value.notes); setFeedbackDirty(true); } }
    } catch { /* Keep server feedback when local storage is unavailable. */ }
  }, [feedbackKey]);
  function changeFeedback(nextPump: string, nextNotes: string) {
    setPump(nextPump); setNotes(nextNotes); setFeedbackDirty(true);
    try { localStorage.setItem(feedbackKey, JSON.stringify({pump: nextPump, notes: nextNotes})); } catch { /* Keep values in memory. */ }
  }
  const timed =
    exercise.trackingType === "time" ||
    exercise.trackingType === "weighted_time";
  const weighted =
    exercise.trackingType === "reps" ||
    exercise.trackingType === "weighted_time";
  const editing = exercise.sets.some((set) => set.id === draft.id);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(draftKey);
      if (stored) {
        const value = JSON.parse(stored);
        if (typeof value.amount === "string") {
          setDraft(value);
          setDirty(true);
        }
      }
    } catch {
      /* The server copy remains the source of truth. */
    }
  }, [draftKey]);

  function change(next: Draft) {
    setDraft(next);
    setDirty(true);
    setMessage("");
    try {
      localStorage.setItem(draftKey, JSON.stringify(next));
    } catch {
      /* Keep inputs in memory when storage is unavailable. */
    }
  }

  async function perform(action: () => Promise<void>) {
    setBusy(true);
    onBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Not saved. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = {
      action: "set",
      workoutExerciseId: exercise.id,
      setId: draft.id || crypto.randomUUID(),
      setKind: draft.kind,
      weightKg: draft.weight,
      reps: timed ? null : draft.amount,
      durationSeconds: timed ? draft.amount : null,
      rir: timed ? null : draft.rir,
    };
    change({ ...draft, id: body.setId });
    await perform(async () => {
      validateSet(body, exercise.trackingType);
      const result = await save(body);
      const next = exercise.sets
        .filter((set) => set.id !== result.set.id)
        .concat(result.set)
        .sort((a, b) => a.set_number - b.set_number);
      onSets(next);
      setMessage(editing ? "Set updated." : "Set saved.");
      setDirty(false);
      // Keep the last values for fast repeat sets, but issue a fresh ID next time.
      setDraft({ ...draft, id: "" });
      try {
        localStorage.removeItem(draftKey);
      } catch {}
      onSaved();
    });
  }

  function copy(set: WorkoutSet, edit = false) {
    change({
      id: edit ? set.id : "",
      kind: set.set_kind,
      weight: set.weight_kg?.toString() ?? "",
      amount: (set.reps ?? set.duration_seconds)?.toString() ?? "",
      rir: set.rir?.toString() ?? "",
    });
    setError("");
  }

  return (
    <section className="surface p-5 sm:p-6"><fieldset disabled={busy || disabled} className="min-w-0 space-y-4">
      <header>
        <p className="eyebrow">Exercise {String(index + 1).padStart(2, "0")}</p>
        <h2 className="mt-1 text-xl font-semibold">{exercise.name}</h2>
        {exercise.equipmentLabel && (
          <p className="muted text-sm">{exercise.equipmentLabel}</p>
        )}
        <p className="muted mt-1 text-sm">
          {exercise.targetSets} working sets ·{" "}
          {timed
            ? `${exercise.timeTargetSeconds ?? "—"} seconds`
            : `${exercise.repMin ?? "—"}–${exercise.repMax ?? "—"} reps`}
        </p>
      </header>
      <p className="status-message text-sm">{exercise.suggestion.message}</p>
      {exercise.sets.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Saved sets</p>
          <ol className="divide-y divide-[#ded9ce]">
            {exercise.sets.map((set, setIndex) => (
              <li
                key={set.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <div className="text-sm">
                  <span className="muted mr-3 tabular-nums">
                    {setIndex + 1}
                  </span>
                  <strong>
                    {set.weight_kg !== null ? `${set.weight_kg} kg · ` : ""}
                    {set.reps !== null
                      ? `${set.reps} reps`
                      : `${set.duration_seconds}s`}
                  </strong>
                  <p className="muted ml-5 text-xs">
                    {set.set_kind === "warmup"
                      ? "Warm-up"
                      : set.set_kind === "drop"
                        ? "Drop set"
                        : "Working set"}
                    {set.rir !== null ? ` · ${set.rir} reps left` : ""}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    className="quiet-action text-sm"
                    disabled={busy || disabled}
                    onClick={() => copy(set, true)}
                    aria-label={`Edit set ${setIndex + 1}`}
                  >
                    Edit
                  </button>
                  <button
                    className="quiet-action text-sm"
                    disabled={busy || disabled}
                    onClick={() => setRemoveId(set.id)}
                    aria-label={`Delete set ${setIndex + 1}`}
                  >
                    Delete
                  </button>
                </div>
                {removeId === set.id && (
                  <div className="w-full space-y-2 rounded-lg bg-[#eee9df] p-3">
                    <p className="text-sm">Delete this set?</p>
                    <div className="flex gap-2">
                      <button
                        className="danger-action"
                        disabled={busy || disabled}
                        onClick={() =>
                          perform(async () => {
                            await save({
                              action: "delete-set",
                              workoutExerciseId: exercise.id,
                              setId: set.id,
                            });
                            onSets(
                              exercise.sets.filter(
                                (item) => item.id !== set.id,
                              ),
                            );
                            setRemoveId(null);
                            if (draft.id === set.id) {
                              setDraft(blankDraft());
                              setDirty(false);
                              try {
                                localStorage.removeItem(draftKey);
                              } catch {}
                            }
                            setMessage("Set deleted.");
                          })
                        }
                      >
                        {busy ? "Deleting…" : "Delete Set"}
                      </button>
                      <button
                        className="secondary-action"
                        disabled={busy}
                        onClick={() => setRemoveId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
      {error && (
        <p className="status-message" data-tone="error" role="alert">
          {error} Your inputs have been kept. Retry when you’re ready.
        </p>
      )}
      {message && (
        <p className="status-message" data-tone="success" role="status">
          {message}
        </p>
      )}
      <form className="space-y-3" onSubmit={submit}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">
            {editing ? "Edit set" : "Log a set"}
          </h3>
          {exercise.sets.length > 0 && (
            <button
              type="button"
              className="quiet-action text-sm"
              disabled={busy || disabled}
              onClick={() => copy(exercise.sets[exercise.sets.length - 1])}
            >
              Copy Last Set
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="field">
            Set type
            <select
              value={draft.kind}
              onChange={(event) =>
                change({ ...draft, kind: event.target.value as Draft["kind"] })
              }
            >
              <option value="working">Working</option>
              <option value="warmup">Warm-up</option>
              <option value="drop">Drop</option>
            </select>
          </label>
          <label className="field">
            {weighted ? "Weight (kg)" : "Added weight (kg)"}
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              max="9999.99"
              required={weighted}
              value={draft.weight}
              onChange={(event) =>
                change({ ...draft, weight: event.target.value })
              }
              placeholder={weighted ? "0" : "Optional"}
            />
          </label>
          <label className="field">
            {timed ? "Seconds" : "Reps"}
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max={timed ? 86400 : 1000}
              step="1"
              required
              value={draft.amount}
              onChange={(event) =>
                change({ ...draft, amount: event.target.value })
              }
            />
          </label>
          {!timed && (
            <label className="field">
              Reps left <span className="muted font-normal">(optional)</span>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                max="10"
                step="1"
                value={draft.rir}
                onChange={(event) =>
                  change({ ...draft, rir: event.target.value })
                }
                placeholder="0–10"
              />
            </label>
          )}
        </div>
        {!timed && (
          <p className="muted text-xs">
            Reps left: how many more reps you could have done with good form.
          </p>
        )}
        {dirty && (
          <p className="muted text-xs">
            Unsaved changes · tap {editing ? "Update" : "Save"} Set to sync.
          </p>
        )}
        <div className="flex gap-2">
          <button className="primary-action flex-1" disabled={busy || disabled}>
            {busy ? "Saving…" : editing ? "Update Set" : "Save Set"}
          </button>
          {dirty && (
            <button
              type="button"
              className="secondary-action"
              disabled={busy}
              onClick={() => {
                setDraft(blankDraft());
                setDirty(false);
                try {
                  localStorage.removeItem(draftKey);
                } catch {}
              }}
            >
              Discard Changes
            </button>
          )}
        </div>
      </form>
      <details className="text-sm">
        <summary className="quiet-action cursor-pointer">
          Exercise notes & feeling
        </summary>
        <div className="mt-3 space-y-3">
          <label className="field">
            Muscle pump
            <select
              value={pump}
              onChange={(event) => changeFeedback(event.target.value, notes)}
            >
              <option value="">Not recorded</option>
              {[1, 2, 3, 4, 5].map((rating) => (
                <option key={rating} value={rating}>
                  {rating} / 5
                  {rating === 1
                    ? " — Minimal"
                    : rating === 5
                      ? " — Strong"
                      : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Exercise notes
            <textarea
              rows={2}
              maxLength={1000}
              value={notes}
              onChange={(event) => changeFeedback(pump, event.target.value)}
              placeholder="Form, discomfort, or equipment settings"
            />
          </label>
          <button
            className="secondary-action"
            disabled={busy || disabled}
            onClick={() =>
              perform(async () => {
                await save({
                  action: "feedback",
                  workoutExerciseId: exercise.id,
                  pumpRating: pump,
                  notes,
                });
                setMessage("Exercise notes saved.");
                setFeedbackDirty(false); setSavedFeedback({pump, notes});
                try { localStorage.removeItem(feedbackKey); } catch {}
              })
            }
          >
            {busy ? "Saving…" : "Save Notes"}
          </button>
          {feedbackDirty && <><p className="muted text-xs">Exercise notes have unsaved changes.</p><button className="quiet-action" onClick={() => { setPump(savedFeedback.pump); setNotes(savedFeedback.notes); setFeedbackDirty(false); try { localStorage.removeItem(feedbackKey); } catch {} }}>Discard Note Changes</button></>}
        </div>
      </details>
    </fieldset></section>
  );
}
