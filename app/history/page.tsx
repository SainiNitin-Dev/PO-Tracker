import Link from "next/link";
import { requireUser } from "@/lib/user";
import { type HistorySession, type HistorySet } from "@/lib/history";
import HistoryList from "./history-list";
type Relation<T> = T | T[] | null;
const one = <T,>(value: Relation<T>) =>
  Array.isArray(value) ? value[0] : value;
type Raw = {
  id: string;
  performed_at: string;
  status: string;
  notes: string | null;
  bodyweight_kg: number | null;
  gym: Relation<{ name: string }>;
  day: Relation<{ name: string }>;
  workout_exercises: {
    id: string;
    sort_order: number;
    gym_exercise_id: string;
    pump_rating: number | null;
    notes: string | null;
    equipment: Relation<{
      equipment_label: string | null;
      exercise: Relation<{ name: string; tracking_type: string }>;
    }>;
    workout_sets: HistorySet[];
    exercise_soreness_feedback: Relation<{ soreness_rating: number }>;
  }[];
};
export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { supabase, user } = await requireUser();
  const params = await searchParams;
  const page = Math.max(
    1,
    Math.min(10000, Number.parseInt(params.page ?? "1", 10) || 1),
  );
  const { data, error, count } = await supabase
    .from("workout_sessions")
    .select(
      "id,performed_at,status,notes,bodyweight_kg,gym:gyms(name),day:program_days(name),workout_exercises(id,sort_order,gym_exercise_id,pump_rating,notes,equipment:gym_exercises(equipment_label,exercise:exercises(name,tracking_type)),workout_sets(id,set_number,set_kind,weight_kg,reps,duration_seconds,rir),exercise_soreness_feedback(soreness_rating))",
      { count: "exact" },
    )
    .eq("user_id", user.id)
    .in("status", ["completed", "abandoned"])
    .order("performed_at", { ascending: false })
    .range((page - 1) * 30, page * 30 - 1);
  if (error) throw new Error("Your workout history could not be loaded.");
  const sessions: HistorySession[] = ((data ?? []) as unknown as Raw[]).map(
    (s) => ({
      id: s.id,
      performed_at: s.performed_at,
      status: s.status,
      notes: s.notes,
      bodyweight_kg: s.bodyweight_kg,
      gym: one(s.gym)?.name ?? "Saved gym",
      day: one(s.day)?.name ?? "Saved workout",
      exercises: [...s.workout_exercises]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((e) => {
          const equipment = one(e.equipment);
          const movement = one(equipment?.exercise ?? null);
          return {
            id: e.id,
            equipmentId: e.gym_exercise_id,
            name: movement?.name ?? "Archived Exercise",
            gym: one(s.gym)?.name ?? "Saved gym",
            equipmentLabel: equipment?.equipment_label ?? null,
            trackingType: movement?.tracking_type ?? "reps",
            notes: e.notes,
            pump: e.pump_rating,
            soreness:
              one(e.exercise_soreness_feedback)?.soreness_rating ?? null,
            sets: [...e.workout_sets].sort(
              (a, b) => a.set_number - b.set_number,
            ),
          };
        }),
    }),
  );
  return (
    <>
      <HistoryList sessions={sessions} />
      <nav
        aria-label="History pages"
        className="mx-auto -mt-24 mb-32 flex max-w-5xl items-center justify-center gap-6 px-5"
      >
        {page > 1 && (
          <Link className="secondary-action" href={`/history?page=${page - 1}`}>
            Newer workouts
          </Link>
        )}
        <span className="muted text-sm">Page {page}</span>
        {(count ?? 0) > page * 30 && (
          <Link className="secondary-action" href={`/history?page=${page + 1}`}>
            Older workouts
          </Link>
        )}
      </nav>
    </>
  );
}
