import { requireUser } from "@/lib/user";
import PhotoUploader from "./photo-uploader";
export default async function PhotosPage() {
  const { supabase, user } = await requireUser();
  const [photos, reviews] = await Promise.all([
    supabase
      .from("progress_photos")
      .select("id,storage_path,taken_at,pose,conditions")
      .eq("user_id", user.id)
      .order("taken_at", { ascending: false })
      .limit(200),
    supabase
      .from("photo_reviews")
      .select(
        "id,older_photo_id,newer_photo_id,review_text,confidence,created_at",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  if (photos.error || reviews.error)
    throw new Error("Your photo collection could not be loaded.");
  const signed = photos.data?.length
    ? await supabase.storage.from("progress-photos").createSignedUrls(
        photos.data.map((p) => p.storage_path),
        3600,
      )
    : { data: [], error: null };
  if (signed.error)
    throw new Error("Your private photo links could not be loaded.");
  return (
    <PhotoUploader
      userId={user.id}
      photos={(photos.data ?? []).map((p) => ({
        ...p,
        url:
          signed.data?.find((s) => s.path === p.storage_path)?.signedUrl ??
          null,
      }))}
      reviews={reviews.data ?? []}
      configured={Boolean(
        process.env.VISION_API_BASE_URL &&
        process.env.VISION_API_KEY &&
        process.env.VISION_MODEL,
      )}
    />
  );
}
