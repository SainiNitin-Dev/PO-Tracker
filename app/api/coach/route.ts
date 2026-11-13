import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/user";
import { apiError, HttpError, readJson, textValue, uuid } from "@/lib/http";
import { trainingSnapshot } from "@/lib/coach/training-context";
import {
  completeCoachMessage,
  CoachProviderError,
  providerConfig,
  type ChatTurn,
} from "@/lib/coach/provider";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireApiUser();
    const body = await readJson(request);
    if (body.action === "note") {
      const note = textValue(body.note, "Note", { max: 1000 });
      const { data, error } = await supabase.rpc("save_coach_note", {
        note_text: note,
        note_id: body.id ? uuid(body.id, "note") : null,
      });
      if (error?.code === "P0001")
        throw new HttpError(
          400,
          "You can keep up to 20 notes. Edit or remove an existing note first.",
        );
      if (error) throw error;
      return NextResponse.json({ note: data });
    }
    if (body.action !== undefined && body.action !== "message")
      throw new HttpError(400, "Choose a valid coach action.");
    const message = textValue(body.message, "Message", { max: 2000 });
    const requestId = uuid(body.requestId, "message");
    const { data: existing, error: existingError } = await supabase
      .from("coach_messages")
      .select("content,evidence")
      .eq("user_id", user.id)
      .eq("request_id", requestId)
      .eq("role", "assistant")
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing)
      return NextResponse.json({
        answer: existing.content,
        evidence: existing.evidence,
      });
    providerConfig("CHAT");
    const { data: conversation, error: conversationError } = await supabase
      .from("coach_conversations")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (conversationError) throw conversationError;
    const [history, snapshot] = await Promise.all([
      conversation
        ? supabase
            .from("coach_messages")
            .select("role,content")
            .eq("conversation_id", conversation.id)
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(10)
        : Promise.resolve({ data: [], error: null }),
      trainingSnapshot(supabase, user.id, message),
    ]);
    if (history.error) throw history.error;
    const { data: allowance, error: allowanceError } = await supabase.rpc(
      "reserve_ai_request",
      { request_kind: "chat" },
    );
    if (allowanceError) throw allowanceError;
    if (!allowance?.[0]?.allowed)
      throw new HttpError(
        429,
        allowance?.[0]?.reason ??
          "The coach allowance has been reached. Please try again later.",
      );
    const turns: ChatTurn[] = (history.data ?? [])
      .reverse()
      .filter((turn) => turn.role === "user" || turn.role === "assistant")
      .map((turn) => ({
        role: turn.role as ChatTurn["role"],
        content: turn.content,
      }));
    const reply = await completeCoachMessage(
      [...turns, { role: "user", content: message }],
      snapshot,
    );
    const { data: saved, error: saveError } = await supabase.rpc(
      "save_coach_exchange",
      {
        exchange_id: requestId,
        user_message: message,
        coach_answer: reply.answer,
        fact_evidence: reply.evidence,
      },
    );
    if (saveError) throw saveError;
    return NextResponse.json(saved, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof CoachProviderError)
      return apiError(new HttpError(error.status, error.message));
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { supabase, user } = await requireApiUser();
    const body = await readJson(request);
    if (body.action === "note") {
      const { error } = await supabase
        .from("coach_notes")
        .delete()
        .eq("user_id", user.id)
        .eq("id", uuid(body.id, "note"));
      if (error) throw error;
    } else if (body.action === "conversation") {
      const { error } = await supabase
        .from("coach_conversations")
        .delete()
        .eq("user_id", user.id);
      if (error) throw error;
    } else throw new HttpError(400, "Choose what to remove.");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
