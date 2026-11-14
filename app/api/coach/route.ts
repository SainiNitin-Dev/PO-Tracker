import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/user";
import { apiError, HttpError, readJson, textValue, uuid } from "@/lib/http";
import { trainingSnapshot } from "@/lib/coach/training-context";
import {
  completeCoachMessage,
  CoachProviderError,
  type ChatTurn,
} from "@/lib/coach/provider";
import { recordReply } from "@/lib/coach/record-reply";
import {
  coachNeedsRecords,
  generalTrainingReply,
} from "@/lib/coach/question-scope";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { supabase, user, profile } = await requireApiUser();
    const body = await readJson(request);
    if (body.action === "new-chat") {
      if (body.id !== undefined) {
        const id = uuid(body.id, "chat");
        const { error } = await supabase
          .from("coach_conversations")
          .upsert(
            { id, user_id: user.id },
            { onConflict: "id", ignoreDuplicates: true },
          );
        if (error) throw error;
        const { data, error: lookupError } = await supabase
          .from("coach_conversations")
          .select("id")
          .eq("id", id)
          .eq("user_id", user.id)
          .maybeSingle();
        if (lookupError) throw lookupError;
        if (!data)
          throw new HttpError(404, "This chat is no longer available.");
        return NextResponse.json({ id: data.id });
      }
      const { data, error } = await supabase
        .from("coach_conversations")
        .insert({ user_id: user.id })
        .select("id")
        .single();
      if (error) throw error;
      return NextResponse.json({ id: data.id }, { status: 201 });
    }
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
    const chatId = uuid(body.chatId, "chat");
    const [conversation, existing, history] = await Promise.all([
      supabase
        .from("coach_conversations")
        .select("id")
        .eq("id", chatId)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("coach_messages")
        .select("content,evidence")
        .eq("user_id", user.id)
        .eq("request_id", requestId)
        .eq("conversation_id", chatId)
        .eq("role", "assistant")
        .maybeSingle(),
      supabase
        .from("coach_messages")
        .select("role,content")
        .eq("conversation_id", chatId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    if (conversation.error) throw conversation.error;
    if (!conversation.data)
      throw new HttpError(404, "This chat is no longer available.");
    if (existing.error) throw existing.error;
    if (existing.data)
      return NextResponse.json({
        answer: existing.data.content,
        evidence: existing.data.evidence,
      });
    if (history.error) throw history.error;
    const turns: ChatTurn[] = (history.data ?? [])
      .reverse()
      .filter((turn) => turn.role === "user" || turn.role === "assistant")
      .map((turn) => ({
        role: turn.role as ChatTurn["role"],
        content: turn.content,
      }));
    const previousQuestion = turns
      .filter((turn) => turn.role === "user")
      .at(-1)?.content;
    const needsRecords = coachNeedsRecords(message, previousQuestion);
    const snapshotPromise = needsRecords
      ? trainingSnapshot(
          supabase,
          user.id,
          message,
          profile.display_name,
        ).catch(() => null)
      : Promise.resolve(null);
    const [snapshot, allowance] = await Promise.all([
      snapshotPromise,
      supabase.rpc("reserve_ai_request", { request_kind: "chat" }),
    ]);
    const reply =
      needsRecords && !snapshot
        ? {
            answer:
              "I couldn’t load your saved training records right now. If you tell me the lift, weights and reps, or paste your split, I can still help you work through it.",
            evidence: [],
          }
        : allowance.data?.[0]?.allowed && !allowance.error
          ? await completeCoachMessage(
              [...turns, { role: "user", content: message }],
              snapshot,
            )
          : snapshot
            ? recordReply(message, snapshot)
            : { answer: generalTrainingReply(message), evidence: [] };
    const { data: saved, error: saveError } = await supabase.rpc(
      "save_coach_chat_exchange",
      {
        chat_id: chatId,
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
        .eq("user_id", user.id)
        .eq("id", uuid(body.id, "chat"));
      if (error) throw error;
    } else throw new HttpError(400, "Choose what to remove.");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
