import { NextResponse } from "next/server";
import { requireUser } from "@/lib/user";
import { trainingSnapshot } from "@/lib/coach/training-context";
import { completeCoachMessage } from "@/lib/coach/provider";

const playbook = "You are a casual, direct strength coach. Return JSON only: {\"answer\":\"...\"}. Numbers may only be stated when present verbatim in the DATABASE FACTS JSON below; never calculate, infer, or invent a number. If facts are insufficient, say so. Low pump or soreness alone is weak evidence; strength trend matters more. Prefer small changes. For sharp, joint, or persistent pain: tell the user to stop that movement and see a qualified professional. Do not diagnose. Proposals must be clearly labeled as needing user confirmation.";
export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser(); const { message } = await request.json();
    if (!message?.trim()) throw new Error("Write a message first.");
    let { data: conversation } = await supabase.from("coach_conversations").select("id").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!conversation) { const created = await supabase.from("coach_conversations").insert({ user_id: user.id }).select("id").single(); if (created.error) throw created.error; conversation = created.data; }
    await supabase.from("coach_messages").insert({ conversation_id: conversation.id, user_id: user.id, role: "user", content: message.trim() });
    const [{ data: history }, facts] = await Promise.all([supabase.from("coach_messages").select("role,content").eq("conversation_id", conversation.id).order("created_at", { ascending: false }).limit(12), trainingSnapshot(supabase, user.id)]);
    const answer = await completeCoachMessage([{ role: "system", content: `${playbook}\n\nCall get_training_snapshot before answering. The tool output is the only source for training facts and numbers.` }, ...(history ?? []).reverse().map((item) => ({ role: item.role as "user" | "assistant", content: item.content }))], facts) ?? "Coach setup is not complete yet. Add CHAT_API_BASE_URL, CHAT_API_KEY, and CHAT_MODEL in Vercel to activate it.";
    await supabase.from("coach_messages").insert({ conversation_id: conversation.id, user_id: user.id, role: "assistant", content: answer });
    return NextResponse.json({ answer });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Coach unavailable" }, { status: 400 }); }
}
