import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/user";
import { apiError, HttpError, numberValue, readJson, uuid } from "@/lib/http";
export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireApiUser();
    const body = await readJson(request);
    const min = numberValue(body.min, "Minimum sets", {
      min: 0,
      max: 100,
      integer: true,
    });
    const max = numberValue(body.max, "Maximum sets", {
      min: 0,
      max: 100,
      integer: true,
    });
    if (max < min)
      throw new HttpError(400, "Maximum sets must be at least the minimum.");
    const { error } = await supabase
      .from("volume_targets")
      .upsert(
        {
          user_id: user.id,
          muscle_id: uuid(body.muscleId, "Muscle"),
          weekly_min: min,
          weekly_max: max,
        },
        { onConflict: "user_id,muscle_id" },
      );
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
