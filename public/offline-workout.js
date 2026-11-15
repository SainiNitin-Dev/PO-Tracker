/* This public shell renders only the training day explicitly saved on this device. */
const ownerKey = "progressive:offline-owner";
const title = document.querySelector("#title");
const description = document.querySelector("#description");
const status = document.querySelector("#status");
const container = document.querySelector("#session");

let owner;
let key;
let state;
let syncing = false;

function element(tag, text = "") {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

function button(text, action, className = "") {
  const control = element("button", text);
  control.type = "button";
  control.className = className;
  control.addEventListener("click", action);
  return control;
}

function field(label, input) {
  const wrapper = element("label", label);
  wrapper.append(input);
  return wrapper;
}

function numberInput(min, max, step, required = false) {
  const control = element("input");
  Object.assign(control, {
    type: "number",
    min,
    max,
    step,
    required,
    inputMode: step === 1 ? "numeric" : "decimal",
  });
  return control;
}

function restore() {
  try {
    owner = localStorage.getItem(ownerKey);
    key = `progressive:offline-workout:${owner}`;
    state = owner ? JSON.parse(localStorage.getItem(key) ?? "null") : null;
    if (state?.plan.userId !== owner) state = null;
  } catch {
    state = null;
    status.textContent = "Offline storage is unavailable on this device.";
  }
}

function persist(next) {
  try {
    if (
      localStorage.getItem(ownerKey) !== owner ||
      localStorage.getItem(key) !== JSON.stringify(state)
    ) {
      throw new Error(
        "This download changed in another tab. Reopen the offline workout to continue.",
      );
    }
    localStorage.setItem(key, JSON.stringify(next));
    state = next;
    return true;
  } catch (error) {
    status.textContent =
      error.name === "QuotaExceededError"
        ? "Device storage is full. This change was not saved."
        : error.message;
    return false;
  }
}

function renderExercise(exercise, index) {
  const section = element("section");
  const timed = ["time", "weighted_time"].includes(exercise.trackingType);
  const weighted = ["reps", "weighted_time"].includes(exercise.trackingType);
  const target = timed
    ? `${exercise.timeTargetSeconds} seconds`
    : `${exercise.repMin}–${exercise.repMax} reps`;
  const list = element("ul");
  const form = element("form");
  const kind = element("select");
  const weight = numberInput(0, 9999.99, 0.01, weighted);
  const amount = numberInput(1, timed ? 86400 : 1000, 1, true);
  const rir = numberInput(0, 10, 1);
  const submit = element("button", "Save set");
  submit.type = "submit";
  let editingId = null;

  for (const [value, label] of [
    ["working", "Working"],
    ["warmup", "Warm-up"],
    ["drop", "Drop"],
  ]) {
    const option = element("option", label);
    option.value = value;
    kind.append(option);
  }

  const updateSets = (sets) => {
    const exercises = state.workout.exercises.map((item, position) =>
      position === index ? { ...item, sets } : item,
    );
    return persist({ ...state, workout: { ...state.workout, exercises } });
  };

  function showSets() {
    list.replaceChildren();
    const sets = state.workout.exercises[index].sets;
    for (const [position, set] of sets.entries()) {
      const item = element("li");
      const summary = `${set.setKind} · ${set.weightKg === "" ? "" : `${set.weightKg} kg × `}${timed ? `${set.durationSeconds}s` : `${set.reps} reps`}`;
      const controls = element("div");
      controls.className = "row";
      controls.append(element("span", summary));
      controls.append(
        button(
          `Edit ${position + 1}`,
          () => {
            editingId = set.id;
            kind.value = set.setKind;
            weight.value = set.weightKg;
            amount.value = timed ? set.durationSeconds : set.reps;
            rir.value = set.rir ?? "";
            submit.textContent = "Update set";
            amount.focus();
          },
          "secondary",
        ),
      );
      controls.append(
        button(
          `Delete ${position + 1}`,
          () => {
            if (!updateSets(sets.filter(({ id }) => id !== set.id))) return;
            if (editingId === set.id) {
              editingId = null;
              submit.textContent = "Save set";
              form.reset();
            }
            showSets();
            status.textContent = "Set deleted on this device.";
          },
          "secondary",
        ),
      );
      item.append(controls);
      list.append(item);
    }
  }

  form.append(
    field("Set type", kind),
    field(weighted ? "Weight (kg)" : "Added weight (kg)", weight),
    field(timed ? "Seconds" : "Reps", amount),
  );
  if (!timed) form.append(field("Reps left (optional)", rir));
  form.append(submit);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const sets = [...state.workout.exercises[index].sets];
    if (!editingId && sets.length >= 100) {
      status.textContent = "This exercise has reached its 100-set limit.";
      return;
    }
    const set = {
      id: editingId ?? crypto.randomUUID(),
      setKind: kind.value,
      weightKg: weight.value,
      reps: timed ? null : amount.value,
      durationSeconds: timed ? amount.value : null,
      rir: timed ? null : rir.value,
    };
    if (editingId) sets[sets.findIndex(({ id }) => id === editingId)] = set;
    else sets.push(set);
    if (!updateSets(sets)) return;
    editingId = null;
    submit.textContent = "Save set";
    showSets();
    status.textContent = "Set saved on this device.";
  });

  section.append(
    element("h2", exercise.name),
    element("p", `${exercise.targetSets} working sets · ${target}`),
    list,
    form,
  );
  showSets();
  return section;
}

async function sync() {
  if (syncing || !state?.workout?.finishedAt || !navigator.onLine) return;
  syncing = true;
  status.textContent = "Syncing workout…";
  const { plan, workout } = state;
  const saved = JSON.stringify(state);
  try {
    const response = await fetch("/api/workouts/offline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...plan, ...workout }),
      signal: AbortSignal.timeout(20000),
    });
    const body = await response.json();
    if (!response.ok || body.id !== workout.id)
      throw new Error(body.error ?? "The workout could not sync.");
    if (localStorage.getItem(key) === saved) localStorage.removeItem(key);
    restore();
    render();
    status.textContent = "Workout synced. You can see it in History.";
  } catch (error) {
    status.textContent = `${error.message} Your workout is still saved on this device.`;
  } finally {
    syncing = false;
  }
}

function render() {
  container.replaceChildren();
  title.textContent = state?.plan.dayName ?? "Offline workouts";
  description.textContent = state
    ? `${state.plan.gymName} · Downloaded on this device`
    : "Download a training day from Workout while connected to use it here.";
  if (!state) return;
  if (!state.workout) {
    container.append(
      button("Start offline workout", () => {
        const workout = {
          id: crypto.randomUUID(),
          startedAt: new Date().toISOString(),
          exercises: state.plan.exercises.map((exercise) => ({
            ...exercise,
            sets: [],
          })),
          notes: "",
          bodyweightKg: "",
        };
        if (persist({ ...state, workout })) render();
      }),
    );
    container.append(
      button(
        "Remove download",
        () => {
          try {
            if (localStorage.getItem(key) !== JSON.stringify(state))
              throw new Error("This download changed in another tab.");
            localStorage.removeItem(key);
            restore();
            render();
            status.textContent = "Download removed.";
          } catch (error) {
            status.textContent = error.message;
          }
        },
        "secondary",
      ),
    );
    return;
  }
  if (state.workout.finishedAt) {
    container.append(
      element(
        "p",
        "Workout finished on this device. It will sync when you reconnect and are signed in.",
      ),
      button("Sync workout", sync),
    );
    return;
  }

  state.workout.exercises.forEach((exercise, index) =>
    container.append(renderExercise(exercise, index)),
  );
  const finish = element("form");
  const notes = element("textarea");
  notes.maxLength = 2000;
  notes.value = state.workout.notes;
  const bodyweight = numberInput(20, 500, 0.01);
  bodyweight.value = state.workout.bodyweightKg;
  const submit = element("button", "Finish offline workout");
  submit.type = "submit";
  const remember = () =>
    persist({
      ...state,
      workout: {
        ...state.workout,
        notes: notes.value,
        bodyweightKg: bodyweight.value,
      },
    });
  notes.addEventListener("input", remember);
  bodyweight.addEventListener("input", remember);
  finish.append(
    field("Workout notes (optional)", notes),
    field("Body weight in kg (optional)", bodyweight),
    submit,
  );
  finish.addEventListener("submit", (event) => {
    event.preventDefault();
    if (
      !state.workout.exercises.some(({ sets }) =>
        sets.some(({ setKind }) => setKind === "working"),
      )
    ) {
      status.textContent = "Save at least one working set before finishing.";
      return;
    }
    if (
      !persist({
        ...state,
        workout: {
          ...state.workout,
          notes: notes.value,
          bodyweightKg: bodyweight.value,
          finishedAt: new Date().toISOString(),
        },
      })
    )
      return;
    status.textContent = "Workout finished and saved on this device.";
    render();
    void sync();
  });
  container.append(finish);
}

window.addEventListener("online", () => void sync());
window.addEventListener("storage", (event) => {
  if (event.key !== key && event.key !== ownerKey && event.key !== null) return;
  restore();
  render();
});
restore();
render();
void sync();
