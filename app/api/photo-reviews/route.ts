import { NextResponse } from "next/server";
import { requireUser } from "@/lib/user";

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser(); const { olderPhotoId, newerPhotoId } = await request.json();
    if (olderPhotoId === newerPhotoId) throw new Error("Choose two different photos.");
    const { data: photos } = await supabase.from("progress_photos").select("id,storage_path,taken_at,pose,conditions").in("id", [olderPhotoId, newerPhotoId]).eq("user_id", user.id);
    if (photos?.length !== 2) throw new Error("Choose two of your photos.");
    const [older, newer] = [photos.find((p) => p.id === olderPhotoId)!, photos.find((p) => p.id === newerPhotoId)!];
    const [a, b] = await Promise.all([supabase.storage.from("progress-photos").createSignedUrl(older.storage_path, 600), supabase.storage.from("progress-photos").createSignedUrl(newer.storage_path, 600)]);
    const base = process.env.VISION_API_BASE_URL, key = process.env.VISION_API_KEY, model = process.env.VISION_MODEL;
    if (!base || !key || !model) throw new Error("Vision review is not configured yet.");
    const prompt = `Return JSON only: {"review":"...","confidence":"low|medium|high"}. Compare photo A and B. First assess pose, lighting, distance, and framing comparability. If not comparable, say so and request a retake with low confidence. If comparable, describe visible differences neutrally by pose. Do not diagnose or use alarming language. A: ${older.taken_at}, ${older.pose}, ${older.conditions}. B: ${newer.taken_at}, ${newer.pose}, ${newer.conditions}.`;
    const result = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify({ model, temperature: 0.2, response_format: { type: "json_object" }, messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: a.data?.signedUrl } }, { type: "image_url", image_url: { url: b.data?.signedUrl } }] }] }) });
    if (!result.ok) throw new Error("Vision provider request failed."); const parsed = JSON.parse((await result.json()).choices?.[0]?.message?.content ?? "{}");
    const confidence = ["low", "medium", "high"].includes(parsed.confidence) ? parsed.confidence : "low";
    const { error } = await supabase.from("photo_reviews").insert({ user_id: user.id, older_photo_id: older.id, newer_photo_id: newer.id, review_text: parsed.review || "No review returned.", confidence }); if (error) throw error;
    return NextResponse.json({ review: parsed.review, confidence });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Review unavailable" }, { status: 400 }); }
}
