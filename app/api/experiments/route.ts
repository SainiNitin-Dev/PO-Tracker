import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/user";
import {
  apiError,
  enumValue,
  HttpError,
  numberValue,
  readJson,
  uuid,
} from "@/lib/http";
export async function POST(request: Request) {
  try {
    const { supabase } = await requireApiUser();
    const body = await readJson(request);
    const { error } = await supabase.rpc("start_volume_experiment", {
      p_muscle: uuid(body.muscleId, "Muscle"),
      p_weeks: numberValue(body.baselineWeeks, "Baseline weeks", {
        min: 1,
        max: 12,
        integer: true,
      }),
      p_sets: numberValue(body.addedSets, "Additional sets", {
        min: 1,
        max: 4,
        integer: true,
      }),
    });
    if (error?.message.includes("Finish the active experiment"))
      throw new HttpError(
        409,
        "You already have an active experiment for this muscle. Complete or cancel it first.",
      );
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
export async function PATCH(request: Request) {
  try {
    const { supabase, user } = await requireApiUser();
    const body = await readJson(request);
    const { data, error } = await supabase
      .from("volume_experiments")
      .update({
        status: enumValue(body.status, ["completed", "cancelled"], "Status"),
        ended_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq("id", uuid(body.id, "Experiment"))
      .eq("status", "active")
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data)
      throw new HttpError(
        409,
        "This experiment is already closed. Refresh to see its current status.",
      );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
