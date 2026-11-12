import { requireUser } from "@/lib/user";
import { estimateOneRepMax } from "@/lib/progression";

type Set = { weight_kg: number | null; reps: number | null; duration_seconds: number | null; set_kind: string };
export default async function HistoryPage() {
  const { supabase, user } = await requireUser();
  const { data: rows } = await supabase.from("workout_exercises").select("id,gym_exercise_id,workout_sets(weight_kg,reps,duration_seconds,set_kind),workout_sessions!inner(user_id,status,performed_at)").eq("workout_sessions.user_id", user.id).eq("workout_sessions.status", "completed").order("performed_at", { referencedTable: "workout_sessions", ascending: false }).limit(200);
  const gymIds = (rows ?? []).map((row) => row.gym_exercise_id);
  const { data: gymExercises } = gymIds.length ? await supabase.from("gym_exercises").select("id,equipment_label,exercise:exercises(name,tracking_type),gym:gyms(name)").in("id", gymIds) : { data: [] };
  const stats = new Map<string, { name: string; gym: string; bestWeight: number; bestReps: number; bestTime: number; bestE1rm: number; latest: string }>();
  for (const row of rows ?? []) {
    const linked = (gymExercises ?? []).find((item) => item.id === row.gym_exercise_id);
    const exercise = Array.isArray(linked?.exercise) ? linked?.exercise[0] : linked?.exercise;
    const gym = Array.isArray(linked?.gym) ? linked?.gym[0] : linked?.gym;
    const session = Array.isArray(row.workout_sessions) ? row.workout_sessions[0] : row.workout_sessions;
    if (!exercise || !session) continue;
    const key = row.gym_exercise_id;
    const current = stats.get(key) ?? { name: exercise.name, gym: gym?.name ?? "Gym", bestWeight: 0, bestReps: 0, bestTime: 0, bestE1rm: 0, latest: session.performed_at };
    for (const set of (row.workout_sets as Set[] ?? []).filter((set) => set.set_kind === "working")) { current.bestWeight = Math.max(current.bestWeight, Number(set.weight_kg ?? 0)); current.bestReps = Math.max(current.bestReps, Number(set.reps ?? 0)); current.bestTime = Math.max(current.bestTime, Number(set.duration_seconds ?? 0)); if (set.weight_kg && set.reps) current.bestE1rm = Math.max(current.bestE1rm, estimateOneRepMax(Number(set.weight_kg), Number(set.reps))); }
    if (session.performed_at > current.latest) current.latest = session.performed_at;
    stats.set(key, current);
  }
  return <main className="mx-auto max-w-xl space-y-6 p-5 pb-24"><header><p className="text-sm font-medium text-lime-400">HISTORY</p><h1 className="text-3xl font-bold">Personal records</h1><p className="mt-2 text-sm text-zinc-400">Records are specific to an exercise at a gym or machine.</p></header>{stats.size ? <section className="space-y-3">{[...stats.values()].sort((a, b) => b.latest.localeCompare(a.latest)).map((stat) => <article className="rounded-xl border border-zinc-800 p-4" key={`${stat.name}-${stat.gym}`}><div className="flex justify-between gap-3"><div><h2 className="font-semibold">{stat.name}</h2><p className="text-sm text-zinc-400">{stat.gym}</p></div><p className="text-xs text-zinc-500">Last logged {new Date(stat.latest).toLocaleDateString()}</p></div><div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm"><div className="rounded bg-zinc-900 p-2"><strong className="block text-lg">{stat.bestWeight || "—"}</strong>kg best load</div><div className="rounded bg-zinc-900 p-2"><strong className="block text-lg">{stat.bestReps || stat.bestTime || "—"}</strong>{stat.bestTime ? " sec" : " reps"}</div><div className="rounded bg-zinc-900 p-2"><strong className="block text-lg">{stat.bestE1rm || "—"}</strong>kg e1RM</div></div></article>)}</section> : <section className="rounded-xl bg-zinc-900 p-5 text-sm text-zinc-400">Complete a workout with working sets to see your exercise history and PRs here.</section>}</main>;
}
