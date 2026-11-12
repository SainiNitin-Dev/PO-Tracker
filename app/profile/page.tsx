import { requireUser } from "@/lib/user";
import ProfileCard from "./profile-card";
export default async function ProfilePage() { const { supabase, user } = await requireUser(); const { data: profile } = await supabase.from("profiles").select("display_name,role,created_at").eq("id", user.id).single(); return <ProfileCard email={user.email ?? ""} name={profile?.display_name || user.email?.split("@")[0] || "Athlete"} role={profile?.role ?? "user"} createdAt={profile?.created_at ?? null} />; }
