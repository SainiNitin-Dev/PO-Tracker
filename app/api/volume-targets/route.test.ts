import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ requireApiUser: vi.fn(), upsert: vi.fn() }));
vi.mock("@/lib/user", () => ({ requireApiUser: mocks.requireApiUser }));
import { POST } from "./route";
const request = (min: number, max: number) =>
  new Request("https://app.example/api/volume-targets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      muscleId: "00000000-0000-0000-0000-000000000001",
      min,
      max,
    }),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.requireApiUser.mockResolvedValue({
    user: { id: "owner" },
    supabase: { from: () => ({ upsert: mocks.upsert }) },
  });
});
describe("volume targets", () => {
  it("rejects inverted and fractional set ranges", async () => {
    expect((await POST(request(10, 5))).status).toBe(400);
    expect((await POST(request(1.5, 5))).status).toBe(400);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("allows zero and updates the member's unique muscle target", async () => {
    expect((await POST(request(0, 8))).status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "owner",
        weekly_min: 0,
        weekly_max: 8,
      }),
      { onConflict: "user_id,muscle_id" },
    );
  });
});
