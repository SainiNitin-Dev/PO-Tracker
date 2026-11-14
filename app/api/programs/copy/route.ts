import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/user";
import { apiError, readJson, uuid } from "@/lib/http";

export async function POST(request: Request) {
  try {
    const { supabase } = await requireApiUser();
    const body = await readJson(request);
    const { error } = await supabase.rpc("copy_member_plan", {
      p_plan_id: uuid(body.planId, "plan"),
      p_recipient_id: uuid(body.recipientId, "member ID"),
      p_request_id: uuid(body.requestId),
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
