import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import {
  apiError,
  archiveSelection,
  HttpError,
  readJson,
  textValue,
  uuid,
} from "@/lib/http";

export async function POST(request: Request) {
  try {
    const { supabase } = await requireAdminApi();
    const body = await readJson(request);
    const gymId = uuid(body.gymId, "gym");
    const exerciseId = uuid(body.exerciseId, "exercise");
    const results = await Promise.all([
      supabase
        .from("gyms")
        .select("id")
        .eq("id", gymId)
        .is("archived_at", null)
        .single(),
      supabase
        .from("exercises")
        .select("id")
        .eq("id", exerciseId)
        .is("archived_at", null)
        .single(),
    ]);
    if (results.some((result) => result.error || !result.data))
      throw new HttpError(400, "Choose an active gym and exercise.");
    const { error } = await supabase.from("gym_exercises").upsert(
      {
        gym_id: gymId,
        exercise_id: exerciseId,
        equipment_label:
          textValue(body.equipmentLabel ?? "", "Machine label", { min: 0 }) ||
          null,
        archived_at: null,
      },
      { onConflict: "gym_id,exercise_id" },
    );
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { supabase } = await requireAdminApi();
    const body = await readJson(request);
    const { itemId, allItems } = archiveSelection(body);
    const { data, error } = await supabase.rpc("archive_catalog", {
      catalog: "gym_exercises",
      item_id: itemId,
      all_items: allItems,
      for_gym: body.gymId === undefined ? null : uuid(body.gymId, "gym"),
    });
    if (error) throw error;
    return NextResponse.json({ ok: true, count: data });
  } catch (error) {
    return apiError(error);
  }
}
