import { requireAccount } from "@/lib/auth";
import ProfileCard from "./profile-card";
export default async function ProfilePage() {
  const { supabase, user, profile } = await requireAccount();
  const metrics =
    profile.role === "user"
      ? await supabase
          .from("body_metrics")
          .select("id,recorded_at,bodyweight_kg")
          .eq("user_id", user.id)
          .order("recorded_at", { ascending: false })
          .limit(10)
      : { data: [], error: null };
  if (metrics.error)
    throw new Error("Your body weight records could not be loaded.");
  return (
    <ProfileCard
      userId={user.id}
      email={user.email ?? ""}
      name={profile.display_name || user.email?.split("@")[0] || "Athlete"}
      role={profile.role}
      createdAt={user.created_at}
      metrics={metrics.data ?? []}
    />
  );
}
