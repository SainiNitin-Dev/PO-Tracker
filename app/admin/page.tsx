import { requireAdmin } from "@/lib/auth";
import AdminConsole from "./admin-console";

export default async function AdminPage() {
  const { supabase } = await requireAdmin();
  const [{ data: gyms }, { data: exercises }] = await Promise.all([
    supabase.from("gyms").select("id,name,weight_increment_kg").order("name"),
    supabase.from("exercises").select("id,name,tracking_type").is("archived_at", null).order("name")
  ]);
  return <AdminConsole gyms={gyms ?? []} exercises={exercises ?? []} />;
}
