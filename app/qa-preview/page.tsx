import { notFound } from "next/navigation";
import AdminConsole from "../admin/admin-console";
import MuscleManager from "../admin/muscles/muscle-manager";
import WorkoutLogger from "../workout/workout-logger";
import CoachChat from "../coach/coach-chat";
import ProfileCard from "../profile/profile-card";
import ProgressDashboard from "../progress/progress-dashboard";
import { summarizeProgress } from "@/lib/progress-summary";
import MobileNav from "@/components/mobile-nav";
export default async function Preview({
  searchParams,
}: {
  searchParams: Promise<{ screen?: string }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const screen = (await searchParams).screen ?? "admin";
  const id = "00000000-0000-0000-0000-000000000001";
  const gym = { id, name: "Preview Gym", weight_increment_kg: 2.5 };
  const exercise = { id, name: "Flat Bench Press", tracking_type: "reps" };
  return (
    <>
      <div className="bg-[#e5dfc9] p-2 text-center text-xs">
        LOCAL UI TEST FIXTURE — no real account or training data
      </div>
      <MobileNav
        role={screen === "admin" || screen === "muscles" ? "admin" : "user"}
        name="Preview"
      />
      {screen === "admin" && (
        <AdminConsole
          gyms={[gym]}
          exercises={[exercise]}
          gymExercises={[
            { id, gym_id: id, exercise_id: id, equipment_label: "Bench" },
          ]}
        />
      )}
      {screen === "muscles" && (
        <MuscleManager
          muscles={[{ id, name: "Chest" }]}
          exercises={[exercise]}
          mappings={[{ exercise_id: id, muscle_id: id, contribution: 1 }]}
        />
      )}
      {screen === "workout" && (
        <WorkoutLogger
          options={{
            userId: "preview-user",
            gyms: [gym],
            days: [{ id, name: "Push", weekday: 1 }],
            entries: [
              {
                id,
                program_day_id: id,
                exercise_id: id,
                name: exercise.name,
                archived: false,
              },
            ],
            availability: [{ gym_id: id, exercise_id: id }],
          }}
          initialWorkout={{
            id,
            performed_at: "2026-11-13T12:00:00Z",
            gymName: gym.name,
            dayName: "Push",
            notes: null,
            bodyweight_kg: null,
            exercises: [
              {
                id,
                gym_exercise_id: id,
                name: exercise.name,
                equipmentLabel: "Bench",
                trackingType: "reps",
                targetSets: 2,
                repMin: 6,
                repMax: 10,
                timeTargetSeconds: null,
                sets: [],
                suggestion: {
                  action: "hold",
                  reason: "Find a comfortable working weight.",
                  message: "Find a comfortable working weight.",
                } as never,
                pumpRating: null,
                notes: null,
              },
            ],
          }}
        />
      )}
      {screen === "coach" && (
        <CoachChat initialMessages={[]} initialNotes={[]} configured={false} />
      )}
      {screen === "profile" && (
        <ProfileCard
          userId="preview-user"
          email="preview@example.test"
          name="Preview"
          role="user"
          createdAt="2026-01-01"
          metrics={[]}
        />
      )}
      {screen === "progress" && (
        <ProgressDashboard
          muscles={[{ id, name: "Chest" }]}
          targets={[]}
          experiments={[]}
          summary={summarizeProgress(
            [],
            [],
            Date.parse("2026-11-13T12:00:00Z"),
          )}
        />
      )}
    </>
  );
}
