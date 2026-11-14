import { requireUser } from "@/lib/user";
import CoachChat from "./coach-chat";

export default async function CoachPage({
  searchParams,
}: {
  searchParams: Promise<{ chat?: string; page?: string }>;
}) {
  const { supabase, user } = await requireUser();
  const query = await searchParams;
  const page = Math.max(
    1,
    Math.min(10000, Number.parseInt(query.page ?? "1", 10) || 1),
  );
  const pageSize = 25;
  const [chats, notes] = await Promise.all([
    supabase
      .from("coach_conversations")
      .select("id,title,created_at", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1),
    supabase
      .from("coach_notes")
      .select("id,note,updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(20),
  ]);
  if (chats.error || notes.error)
    throw new Error(
      "Your coach history could not be loaded. Please try again.",
    );
  let conversation = query.chat
    ? chats.data?.find((chat) => chat.id === query.chat)
    : chats.data?.[0];
  if (
    !conversation &&
    query.chat &&
    /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(query.chat)
  ) {
    const { data, error } = await supabase
      .from("coach_conversations")
      .select("id,title,created_at")
      .eq("user_id", user.id)
      .eq("id", query.chat)
      .maybeSingle();
    if (error) throw new Error("Your chat could not be loaded.");
    conversation = data ?? undefined;
  }
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
      key={conversation?.id ?? "no-chat"}
      chatId={conversation?.id ?? null}
      chats={chats.data ?? []}
      page={page}
      hasOlderChats={page * pageSize < (chats.count ?? 0)}
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
