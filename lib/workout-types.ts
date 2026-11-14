import type { TrackingType, Suggestion } from "@/lib/progression";
export type WorkoutSet = {
  id: string;
  set_number: number;
  set_kind: "working" | "warmup" | "drop";
  weight_kg: number | null;
  reps: number | null;
  duration_seconds: number | null;
  rir: number | null;
};
export type WorkoutExercise = {
  id: string;
  gym_exercise_id: string;
  name: string;
  equipmentLabel: string | null;
  trackingType: TrackingType;
  targetSets: number;
  repMin: number | null;
  repMax: number | null;
  timeTargetSeconds: number | null;
  sets: WorkoutSet[];
  lastPerformance: {
    performedAt: string;
    dayName: string | null;
    sets: WorkoutSet[];
  } | null;
  suggestion: Suggestion;
  pumpRating: number | null;
  notes: string | null;
};
export type ActiveWorkout = {
  id: string;
  performed_at: string;
  gymName: string;
  dayName: string;
  notes: string | null;
  bodyweight_kg: number | null;
  exercises: WorkoutExercise[];
};
export type WorkoutOptions = {
  userId: string;
  gyms: { id: string; name: string }[];
  days: { id: string; name: string; weekday: number | null }[];
  entries: {
    id: string;
    program_day_id: string;
    exercise_id: string;
    name: string;
    archived: boolean;
  }[];
  availability: { gym_id: string; exercise_id: string }[];
};
