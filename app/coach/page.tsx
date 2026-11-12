import { requireUser } from "@/lib/user";
import CoachChat from "./coach-chat";
export default async function CoachPage() { const { supabase, user } = await requireUser(); const { data: conversation } = await supabase.from("coach_conversations").select("id").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(); const { data: messages } = conversation ? await supabase.from("coach_messages").select("id,role,content,created_at").eq("conversation_id", conversation.id).order("created_at") : { data: [] }; return <CoachChat initialMessages={messages ?? []} />; }
