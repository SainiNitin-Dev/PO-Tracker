import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/user";
import { apiError, HttpError, readJson, textValue, uuid } from "@/lib/http";

async function savePlan(request: Request) {
  try {
    const { supabase } = await requireApiUser();
    const body = await readJson(request);
    const id = request.method === "PATCH" ? uuid(body.id, "Plan") : null;
    const name = textValue(body.name, "Plan name", { max: 100 });
    const { data, error } = await supabase.rpc("save_training_plan", {
      p_id: id,
      p_name: name,
      p_activate: body.activate !== false,
    });
    if (error) throw error;
    return NextResponse.json({ id: data });
  } catch (error) {
    return apiError(error);
  }
}
export const POST = savePlan;
export const PATCH = savePlan;

export async function DELETE(request: Request) {
  try {
    const { supabase, user } = await requireApiUser();
    const body = await readJson(request);
    const { data, error } = await supabase
      .from("programs")
      .delete()
      .eq("id", uuid(body.id, "Plan"))
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, "This plan is no longer available.");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
