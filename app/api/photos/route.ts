import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/user";
import {
  apiError,
  enumValue,
  HttpError,
  readJson,
  textValue,
  uuid,
} from "@/lib/http";
import {
  photoTypes,
  validatePhotoDate,
  validatePhotoPath,
} from "@/lib/photo-validation";
export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireApiUser();
    const body = await readJson(request);
    const path = validatePhotoPath(body.storagePath, user.id);
    const values = {
      taken_at: validatePhotoDate(body.takenAt),
      pose: enumValue(body.pose, ["front", "side", "back"], "Pose"),
      conditions: body.conditions
        ? textValue(body.conditions, "Photo notes", { max: 500 })
        : null,
    };
    const { data: existing, error: existingError } = await supabase
      .from("progress_photos")
      .select("id")
      .eq("storage_path", path)
      .eq("user_id", user.id)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) return NextResponse.json({ id: existing.id });
    const { data: file, error: storageError } = await supabase.storage
      .from("progress-photos")
      .info(path);
    if (storageError || !file)
      throw new HttpError(
        400,
        "The photo upload could not be found. Please upload it again.",
      );
    if (
      !file.size ||
      Number(file.size) > 8 * 1024 * 1024 ||
      !photoTypes.includes(file.contentType ?? "")
    )
      throw new HttpError(400, "Use a JPG, PNG or WebP smaller than 8 MB.");
    const { data, error } = await supabase
      .from("progress_photos")
      .insert({ user_id: user.id, storage_path: path, ...values })
      .select("id")
      .single();
    if (error) throw error;
    return NextResponse.json({ id: data.id });
  } catch (error) {
    return apiError(error);
  }
}
export async function PATCH(request: Request) {
  try {
    const { supabase, user } = await requireApiUser();
    const body = await readJson(request);
    const { data, error } = await supabase
      .from("progress_photos")
      .update({
        taken_at: validatePhotoDate(body.takenAt),
        pose: enumValue(body.pose, ["front", "side", "back"], "Pose"),
        conditions: body.conditions
          ? textValue(body.conditions, "Photo notes", { max: 500 })
          : null,
      })
      .eq("id", uuid(body.id, "Photo"))
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, "Photo not found.");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
export async function DELETE(request: Request) {
  try {
    const { supabase, user } = await requireApiUser();
    const body = await readJson(request);
    const id = uuid(body.id, "Photo");
    const { data: photo, error } = await supabase
      .from("progress_photos")
      .select("storage_path")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!photo) return NextResponse.json({ ok: true });
    const { error: storageError } = await supabase.storage
      .from("progress-photos")
      .remove([photo.storage_path]);
    if (storageError)
      throw new HttpError(
        503,
        "The photo file could not be removed. Please retry.",
      );
    const { error: deleteError } = await supabase.rpc("delete_photo_metadata", {
      photo_id: id,
    });
    if (deleteError) throw deleteError;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
