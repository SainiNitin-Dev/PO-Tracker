import { describe, expect, it } from "vitest";
import {
  validatePhotoDate,
  validatePhotoPath,
  validatePhotoReview,
} from "./photo-validation";
describe("private photos", () => {
  const owner = "11111111-1111-4111-8111-111111111111";
  it("accepts only an owner-prefixed safe storage path", () => {
    expect(validatePhotoPath(`${owner}/1234-abcd.jpg`, owner)).toContain(owner);
    for (const path of [
      `other/123.jpg`,
      `${owner}/../secret.jpg`,
      "https://example.com/photo.jpg",
    ])
      expect(() => validatePhotoPath(path, owner)).toThrow();
  });
  it("rejects invalid calendar dates", () => {
    expect(validatePhotoDate("2026-01-01")).toBe("2026-01-01");
    expect(() => validatePhotoDate("2026-02-30")).toThrow();
  });
  it("requires complete review output and forces low confidence if unmatched", () => {
    expect(() => validatePhotoReview('{"review":"Looks good"}')).toThrow();
    expect(
      validatePhotoReview(
        JSON.stringify({
          review: "Lighting is different. Retake with similar conditions.",
          confidence: "high",
          comparable: false,
        }),
      ).confidence,
    ).toBe("low");
  });
});
