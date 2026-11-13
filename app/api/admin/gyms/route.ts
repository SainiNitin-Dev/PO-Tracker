import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import {
  apiError,
  archiveSelection,
  HttpError,
  numberValue,
  readJson,
  textValue,
  uuid,
} from "@/lib/http";

async function save(request: Request, editing: boolean) {
  try {
    const { supabase } = await requireAdminApi();
    const body = await readJson(request);
    const values = {
      name: textValue(body.name, "Gym name"),
      weight_increment_kg: numberValue(
        body.weightIncrementKg,
        "Smallest weight jump",
        { min: 0.01, max: 100 },
      ),
    };
    const result = editing
      ? await supabase
          .from("gyms")
          .update(values)
          .eq("id", uuid(body.id))
          .is("archived_at", null)
          .select("id")
          .single()
      : await supabase.from("gyms").insert(values).select("id").single();
    if (result.error) throw result.error;
    if (!result.data)
      throw new HttpError(404, "This gym is no longer available.");
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
      catalog: "gyms",
      item_id: itemId,
      all_items: allItems,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true, count: data });
  } catch (error) {
    return apiError(error);
  }
}
