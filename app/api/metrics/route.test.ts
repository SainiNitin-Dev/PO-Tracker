import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  insert: vi.fn(),
  eq: vi.fn(),
}));
vi.mock("@/lib/user", () => ({ requireApiUser: mocks.requireApiUser }));
import { POST, DELETE } from "./route";
const request = (body: object, method = "POST") =>
  new Request("https://app.example/api/metrics", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.insert.mockResolvedValue({ error: null });
  mocks.eq.mockReturnValue({ eq: mocks.eq, error: null });
  mocks.requireApiUser.mockResolvedValue({
    user: { id: "owner" },
    supabase: {
      from: () => ({ insert: mocks.insert, delete: () => ({ eq: mocks.eq }) }),
    },
  });
});
describe("body measurements", () => {
  it("rejects impossible calendar dates and invalid weights", async () => {
    for (const body of [
      { date: "2026-02-30", weight: 60 },
      { date: "2026-01-01", weight: -1 },
      { date: "2026-01-01", weight: "" },
    ])
      expect((await POST(request(body))).status).toBe(400);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("takes ownership from the session", async () => {
    expect(
      (
        await POST(
          request({ date: "2026-01-01", weight: 72.5, user_id: "other" }),
        )
      ).status,
    ).toBe(200);
    expect(mocks.insert).toHaveBeenCalledWith({
      user_id: "owner",
      recorded_at: "2026-01-01",
      bodyweight_kg: 72.5,
    });
  });
  it("limits deletions to the owner", async () => {
    expect(
      (
        await DELETE(
          request({ id: "00000000-0000-0000-0000-000000000001" }, "DELETE"),
        )
      ).status,
    ).toBe(200);
    expect(mocks.eq).toHaveBeenCalledWith("user_id", "owner");
  });
});
