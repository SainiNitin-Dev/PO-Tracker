"use client";
import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ConfirmDialog, { type Confirmation } from "@/components/confirm-dialog";
import { requestJson } from "@/lib/client-request";

type Gym = { id: string; name: string; weight_increment_kg: number };
type Exercise = { id: string; name: string; tracking_type: string };
type GymExercise = {
  id: string;
  gym_id: string;
  exercise_id: string;
  equipment_label: string | null;
};
const kinds: Record<string, string> = {
  reps: "Weight & reps",
  bodyweight_reps: "Bodyweight reps",
  time: "Time",
  weighted_time: "Weight & time",
};
type Tab = "gyms" | "exercises" | "equipment" | "invite";

export default function AdminConsole({
  gyms,
  exercises,
  gymExercises,
}: {
  gyms: Gym[];
  exercises: Exercise[];
  gymExercises: GymExercise[];
}) {
  const [tab, setTab] = useState<Tab>("gyms");
  const [search, setSearch] = useState("");
  const [gymFilter, setGymFilter] = useState("");
  const [editingGym, setEditingGym] = useState<Gym | null>(null);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [message, setMessage] = useState<{
    text: string;
    error?: boolean;
  } | null>(null);
  const [working, setWorking] = useState("");
  const [refreshing, startTransition] = useTransition();
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const busy = Boolean(working) || refreshing;
  const router = useRouter();
  const run = async (
    key: string,
    path: string,
    body: object,
    method: string,
    success: string,
    after?: () => void,
  ) => {
    setWorking(key);
    setMessage(null);
    try {
      await requestJson(path, body, method);
      after?.();
      setMessage({ text: success });
      startTransition(() => router.refresh());
    } catch (error) {
      setMessage({
        text:
          error instanceof Error
            ? error.message
            : "That did not save. Please try again.",
        error: true,
      });
    } finally {
      setWorking("");
    }
  };
  const submit =
    (
      key: string,
      path: string,
      success: string,
      editId?: string,
      after?: () => void,
    ) =>
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      void run(
        key,
        path,
        {
          ...Object.fromEntries(new FormData(form)),
          ...(editId ? { id: editId } : {}),
        },
        editId ? "PATCH" : "POST",
        success,
        () => {
          form.reset();
          after?.();
        },
      );
    };
  const remove = (path: string, body: object, title: string) =>
    setConfirmation({
      title,
      description:
        "This removes the selection from the active catalog. Past workouts stay intact. It will no longer be available for new workouts.",
      label: "Remove",
      onConfirm: () =>
        void run(
          "remove",
          path,
          body,
          "DELETE",
          "Removed from the active catalog.",
        ),
    });
  const matches = (text: string) =>
    text.toLowerCase().includes(search.toLowerCase().trim());
  const available = gymExercises.filter(
    (g) =>
      (!gymFilter || g.gym_id === gymFilter) &&
      matches(
        `${gyms.find((x) => x.id === g.gym_id)?.name} ${exercises.find((x) => x.id === g.exercise_id)?.name} ${g.equipment_label ?? ""}`,
      ),
  );
  const switchTab = (next: Tab) => {
    setTab(next);
    setSearch("");
    setMessage(null);
  };
  return (
    <main className="app-page">
      <header className="page-header">
        <p className="eyebrow">Gym management</p>
        <h1>Gym catalog</h1>
        <p>
          Set up your gyms, organize exercises, and invite your members. Their
          training logs and photos stay private.
        </p>
      </header>
      <div
        className="mb-6 flex flex-wrap gap-2"
        role="group"
        aria-label="Catalog sections"
      >
        {(
          [
            { id: "gyms", label: "Gyms", count: gyms.length },
            { id: "exercises", label: "Exercises", count: exercises.length },
            {
              id: "equipment",
              label: "Gym exercises",
              count: gymExercises.length,
            },
            { id: "invite", label: "Invite member" },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            aria-pressed={tab === item.id}
            onClick={() => switchTab(item.id)}
            className={tab === item.id ? "primary-action" : "secondary-action"}
          >
            {item.label}
            {"count" in item && (
              <span className="opacity-70">{item.count}</span>
            )}
          </button>
        ))}
      </div>
      {message && (
        <p
          role={message.error ? "alert" : "status"}
          className="status-message mb-6"
          data-tone={message.error ? "error" : "success"}
        >
          {message.text}
        </p>
      )}
      {busy && (
        <p role="status" className="muted mb-4 flex items-center gap-2 text-sm">
          <span className="spinner" />
          {refreshing ? "Updating your catalog…" : "Saving your change…"}
        </p>
      )}

      {tab === "gyms" && (
        <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <form
            key={editingGym?.id ?? "new-gym"}
            onSubmit={submit(
              "gym",
              "/api/admin/gyms",
              editingGym
                ? "Gym updated."
                : "Gym added. Add its exercises next.",
              editingGym?.id,
              () => setEditingGym(null),
            )}
            className="surface space-y-4"
          >
            <h2 className="text-lg font-semibold">
              {editingGym ? "Edit gym" : "Add a gym"}
            </h2>
            <label className="field">
              Gym name
              <input
                name="name"
                required
                maxLength={120}
                defaultValue={editingGym?.name}
                placeholder="e.g. Sai Gold Gym"
              />
            </label>
            <label className="field">
              Smallest weight increase (kg)
              <input
                name="weightIncrementKg"
                required
                type="number"
                step="0.25"
                min="0.25"
                max="100"
                defaultValue={editingGym?.weight_increment_kg ?? 2.5}
              />
              <small>
                The smallest extra weight you can add. Used for your members’
                progression suggestions.
              </small>
            </label>
            <div className="flex flex-wrap gap-2">
              <button disabled={busy} className="primary-action">
                {working === "gym"
                  ? "Saving…"
                  : editingGym
                    ? "Save gym"
                    : "Add gym"}
              </button>
              {editingGym && (
                <button
                  type="button"
                  className="quiet-action"
                  onClick={() => setEditingGym(null)}
                >
                  Cancel edit
                </button>
              )}
            </div>
          </form>
          <section className="surface">
            <div className="section-heading">
              <h2>Your gyms</h2>
              <button
                className="danger-action"
                disabled={busy || !gyms.length}
                onClick={() =>
                  remove(
                    "/api/admin/gyms",
                    { all: true },
                    `Remove all ${gyms.length} gyms?`,
                  )
                }
              >
                Remove all
              </button>
            </div>
            <label className="field">
              <span className="sr-only">Find a gym</span>
              <input
                type="search"
                placeholder="Find a gym…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            {gyms
              .filter((g) => matches(g.name))
              .map((g) => (
                <div key={g.id} className="data-row">
                  <div className="min-w-0">
                    <h3 className="break-words font-semibold">{g.name}</h3>
                    <p className="muted mt-1 text-xs">
                      {g.weight_increment_kg} kg increases ·{" "}
                      {gymExercises.filter((e) => e.gym_id === g.id).length}{" "}
                      exercises
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      disabled={busy}
                      className="quiet-action"
                      onClick={() => {
                        setEditingGym(g);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      Edit<span className="sr-only"> {g.name}</span>
                    </button>
                    <button
                      disabled={busy}
                      className="danger-action"
                      onClick={() =>
                        remove(
                          "/api/admin/gyms",
                          { id: g.id },
                          `Remove ${g.name}?`,
                        )
                      }
                    >
                      Remove<span className="sr-only"> {g.name}</span>
                    </button>
                  </div>
                </div>
              ))}
            {!gyms.length ? (
              <div className="empty-state">
                <h3>Your first gym goes here.</h3>Add its name and weight
                increase, then choose which exercises members can do there.
              </div>
            ) : (
              !gyms.some((g) => matches(g.name)) && (
                <p className="empty-state">No gyms match your search.</p>
              )
            )}
          </section>
        </div>
      )}

      {tab === "exercises" && (
        <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <form
            key={editingExercise?.id ?? "new-exercise"}
            onSubmit={submit(
              "exercise",
              "/api/admin/exercises",
              editingExercise
                ? "Exercise updated."
                : "Exercise added. Make it available at a gym next.",
              editingExercise?.id,
              () => setEditingExercise(null),
            )}
            className="surface space-y-4"
          >
            <h2 className="text-lg font-semibold">
              {editingExercise ? "Edit exercise" : "Add an exercise"}
            </h2>
            <label className="field">
              Exercise name
              <input
                name="name"
                required
                maxLength={120}
                defaultValue={editingExercise?.name}
                placeholder="e.g. Flat Bench Press"
              />
            </label>
            <label className="field">
              What do members track?
              <select
                name="trackingType"
                disabled={Boolean(editingExercise)}
                defaultValue={editingExercise?.tracking_type ?? "reps"}
              >
                {Object.entries(kinds).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {editingExercise && <><input type="hidden" name="trackingType" value={editingExercise.tracking_type} /><p className="muted text-sm">Tracking stays the same to keep past workouts accurate. Add a new exercise for a different tracking type.</p></>}
            <div className="flex flex-wrap gap-2">
              <button disabled={busy} className="primary-action">
                {working === "exercise"
                  ? "Saving…"
                  : editingExercise
                    ? "Save exercise"
                    : "Add exercise"}
              </button>
              {editingExercise && (
                <button
                  className="quiet-action"
                  type="button"
                  onClick={() => setEditingExercise(null)}
                >
                  Cancel edit
                </button>
              )}
            </div>
            <Link href="/admin/muscles" className="quiet-action -ml-4">
              Set up muscle groups →
            </Link>
          </form>
          <section className="surface">
            <div className="section-heading">
              <h2>Exercise library</h2>
              <button
                disabled={busy || !exercises.length}
                className="danger-action"
                onClick={() =>
                  remove(
                    "/api/admin/exercises",
                    { all: true },
                    `Remove all ${exercises.length} exercises?`,
                  )
                }
              >
                Remove all
              </button>
            </div>
            <label className="field">
              <span className="sr-only">Find an exercise</span>
              <input
                type="search"
                placeholder="Find an exercise…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            {exercises
              .filter((e) => matches(e.name))
              .map((e) => (
                <div className="data-row" key={e.id}>
                  <div className="min-w-0">
                    <h3 className="break-words font-semibold">{e.name}</h3>
                    <p className="muted mt-1 text-xs">
                      {kinds[e.tracking_type]}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      className="quiet-action"
                      disabled={busy}
                      onClick={() => {
                        setEditingExercise(e);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      Edit<span className="sr-only"> {e.name}</span>
                    </button>
                    <button
                      disabled={busy}
                      className="danger-action"
                      onClick={() =>
                        remove(
                          "/api/admin/exercises",
                          { id: e.id },
                          `Remove ${e.name}?`,
                        )
                      }
                    >
                      Remove<span className="sr-only"> {e.name}</span>
                    </button>
                  </div>
                </div>
              ))}
            {!exercises.length ? (
              <div className="empty-state">
                <h3>A clean slate.</h3>Add the movements your members use.
                Clearing this library never creates replacement exercises.
              </div>
            ) : (
              !exercises.some((e) => matches(e.name)) && (
                <p className="empty-state">No exercises match your search.</p>
              )
            )}
          </section>
        </div>
      )}

      {tab === "equipment" && (
        <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <form
            className="surface space-y-4"
            onSubmit={submit(
              "equipment",
              "/api/admin/gym-exercises",
              "Exercise available at this gym.",
            )}
          >
            <h2 className="text-lg font-semibold">Add an exercise to a gym</h2>
            <label className="field">
              Gym
              <select name="gymId" required>
                <option value="">Choose a gym</option>
                {gyms.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
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
              Machine label (optional)
              <input
                name="equipmentLabel"
                maxLength={120}
                placeholder="e.g. Cable Station"
              />
              <small>A label to help members find the right equipment.</small>
            </label>
            <button
              disabled={busy || !gyms.length || !exercises.length}
              className="primary-action"
            >
              {working === "equipment" ? "Saving…" : "Add to gym"}
            </button>
            {(!gyms.length || !exercises.length) && (
              <p className="muted text-sm">
                Create a gym and an exercise first.
              </p>
            )}
          </form>
          <section className="surface">
            <div className="section-heading">
              <h2>Available exercises</h2>
              <button
                className="danger-action"
                disabled={
                  busy ||
                  !(gymFilter
                    ? gymExercises.some((g) => g.gym_id === gymFilter)
                    : gymExercises.length)
                }
                onClick={() =>
                  remove(
                    "/api/admin/gym-exercises",
                    { all: true, ...(gymFilter ? { gymId: gymFilter } : {}) },
                    gymFilter
                      ? "Remove every exercise from this gym?"
                      : "Remove all gym exercises?",
                  )
                }
              >
                Remove all{gymFilter ? " here" : ""}
              </button>
            </div>
            <div className="space-y-3">
              <label className="field">
                Filter by gym
                <select
                  value={gymFilter}
                  onChange={(e) => setGymFilter(e.target.value)}
                >
                  <option value="">All gyms</option>
                  {gyms.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="sr-only">Search gym exercises</span>
                <input
                  value={search}
                  type="search"
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Find an exercise or machine…"
                />
              </label>
            </div>
            {available.map((item) => (
              <div className="data-row" key={item.id}>
                <div>
                  <h3 className="font-semibold">
                    {exercises.find((e) => e.id === item.exercise_id)?.name}
                  </h3>
                  <p className="muted mt-1 text-xs">
                    {gyms.find((g) => g.id === item.gym_id)?.name}
                    {item.equipment_label ? ` · ${item.equipment_label}` : ""}
                  </p>
                </div>
                <button
                  className="danger-action"
                  disabled={busy}
                  onClick={() =>
                    remove(
                      "/api/admin/gym-exercises",
                      { id: item.id },
                      "Remove this gym exercise?",
                    )
                  }
                >
                  Remove
                </button>
              </div>
            ))}
            {!available.length && (
              <p className="empty-state">
                No exercises here yet. Add one using the form, or change your
                filters.
              </p>
            )}
          </section>
        </div>
      )}

      {tab === "invite" && (
        <section className="grid gap-6 md:grid-cols-2">
          <form
            className="surface space-y-4"
            onSubmit={submit(
              "invite",
              "/api/admin/invites",
              "Invitation sent. Your member can open the email and choose a password.",
            )}
          >
            <h2 className="text-lg font-semibold">Welcome someone new</h2>
            <label className="field">
              Email address
              <input
                name="email"
                required
                type="email"
                autoComplete="email"
                maxLength={254}
                placeholder="member@example.com"
              />
            </label>
            <label className="field">
              Name
              <input
                name="displayName"
                required
                autoComplete="name"
                maxLength={120}
                placeholder="Their preferred name"
              />
            </label>
            <button disabled={busy} className="primary-action">
              {working === "invite" ? "Sending invitation…" : "Send invitation"}
            </button>
          </form>
          <div className="px-1 py-5">
            <h2 className="text-lg font-semibold">What happens next?</h2>
            <ol className="muted mt-4 list-inside list-decimal space-y-4 text-sm leading-relaxed">
              <li>They open the invitation email on their preferred device.</li>
              <li>They choose a password to activate their account.</li>
              <li>They build a plan, select a gym, and start logging.</li>
            </ol>
            <p className="muted mt-6 text-sm">
              You manage the catalog. Only members can view their own training,
              conversations, and photos.
            </p>
          </div>
        </section>
      )}
      <ConfirmDialog
        confirmation={confirmation}
        onClose={() => setConfirmation(null)}
      />
    </main>
  );
}
