import { requireUser } from "@/lib/user";
import CoachChat from "./coach-chat";

export default async function CoachPage() {
  const { supabase, user } = await requireUser();
  const [{ data: conversation, error }, notes] = await Promise.all([
    supabase
      .from("coach_conversations")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("coach_notes")
      .select("id,note,updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(20),
  ]);
  if (error || notes.error)
    throw new Error(
      "Your coach history could not be loaded. Please try again.",
    );
  const messages = conversation
    ? await supabase
        .from("coach_messages")
        .select("id,role,content,created_at,evidence")
        .eq("conversation_id", conversation.id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(60)
    : { data: [], error: null };
  if (messages.error)
    throw new Error("Your messages could not be loaded. Please try again.");
  return (
    <CoachChat
      initialMessages={(messages.data ?? []).reverse()}
      initialNotes={notes.data ?? []}
      configured={Boolean(
        process.env.CHAT_API_BASE_URL &&
        process.env.CHAT_API_KEY &&
        process.env.CHAT_MODEL,
      )}
    />
  );
}
