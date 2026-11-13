import { HttpError } from "./http";
export const photoTypes = ["image/jpeg", "image/png", "image/webp"];
export function validatePhotoPath(path: unknown, userId: string) {
  if (
    typeof path !== "string" ||
    !path.startsWith(`${userId}/`) ||
    !/^[a-f0-9-]+\/(?:[a-f0-9-]+)\.(?:jpg|jpeg|png|webp)$/i.test(path)
  )
    throw new HttpError(400, "Choose a photo uploaded to your own account.");
  return path;
}
export function validatePhotoDate(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value ||
    Date.parse(value) > Date.now() + 86400000 ||
    Date.parse(value) < Date.UTC(2000, 0, 1)
  )
    throw new HttpError(400, "Choose a valid photo date.");
  return value;
}
export function validatePhotoReview(raw: string) {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new HttpError(
      502,
      "The photo review was unreadable. Please try again later.",
    );
  }
  if (
    !value ||
    typeof value !== "object" ||
    !("review" in value) ||
    typeof value.review !== "string" ||
    value.review.trim().length < 10 ||
    value.review.length > 5000 ||
    !("confidence" in value) ||
    !["low", "medium", "high"].includes(String(value.confidence)) ||
    !("comparable" in value) ||
    typeof value.comparable !== "boolean"
  )
    throw new HttpError(
      502,
      "The photo review was incomplete. Please try again later.",
    );
  return {
    review: value.review.trim(),
    confidence: value.comparable
      ? (value.confidence as "low" | "medium" | "high")
      : ("low" as const),
  };
}
