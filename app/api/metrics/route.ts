import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/user";
import { apiError, HttpError, readJson, numberValue, uuid } from "@/lib/http";
export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireApiUser();
    const body = await readJson(request);
    if (
      typeof body.date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(body.date) ||
      !Number.isFinite(Date.parse(body.date)) ||
      new Date(body.date).toISOString().slice(0, 10) !== body.date ||
      Date.parse(body.date) > Date.now() + 86400000 ||
      Date.parse(body.date) < Date.UTC(2000, 0, 1)
    )
      throw new HttpError(400, "Choose a valid measurement date.");
    const { error } = await supabase
      .from("body_metrics")
      .insert({
        user_id: user.id,
        recorded_at: body.date,
        bodyweight_kg: numberValue(body.weight, "Body weight", {
          min: 20,
          max: 500,
        }),
      });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
export async function DELETE(request: Request) {
  try {
    const { supabase, user } = await requireApiUser();
    const body = await readJson(request);
    const { error } = await supabase
      .from("body_metrics")
      .delete()
      .eq("id", uuid(body.id, "Measurement"))
      .eq("user_id", user.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
