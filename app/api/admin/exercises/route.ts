import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import {
  apiError,
  archiveSelection,
  enumValue,
  HttpError,
  readJson,
  textValue,
  uuid,
} from "@/lib/http";

async function save(request: Request, editing: boolean) {
  try {
    const { supabase } = await requireAdminApi();
    const body = await readJson(request);
    const values = {
      name: textValue(body.name, "Exercise name"),
      tracking_type: enumValue(
        body.trackingType,
        ["reps", "bodyweight_reps", "time", "weighted_time"] as const,
        "tracking method",
      ),
    };
    if (editing) {
      const id = uuid(body.id);
      const { data, error } = await supabase
        .from("exercises")
        .select("tracking_type")
        .eq("id", id)
        .is("archived_at", null)
        .single();
      if (error) throw error;
      if (data.tracking_type !== values.tracking_type)
        throw new HttpError(
          409,
          "Keep the tracking method to preserve existing workouts. Add a new exercise for a different method.",
        );
    }
    const result = editing
      ? await supabase
          .from("exercises")
          .update(values)
          .eq("id", uuid(body.id))
          .is("archived_at", null)
          .select("id")
          .single()
      : await supabase.from("exercises").insert(values).select("id").single();
    if (result.error) throw result.error;
    return NextResponse.json({ ok: true, id: result.data.id });
  } catch (error) {
    return apiError(error);
  }
}

export const POST = (request: Request) => save(request, false);
export const PATCH = (request: Request) => save(request, true);

export async function DELETE(request: Request) {
  try {
    const { supabase } = await requireAdminApi();
    const { itemId, allItems } = archiveSelection(await readJson(request));
    const { data, error } = await supabase.rpc("archive_catalog", {
      catalog: "exercises",
      item_id: itemId,
      all_items: allItems,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true, count: data });
  } catch (error) {
    return apiError(error);
  }
}
