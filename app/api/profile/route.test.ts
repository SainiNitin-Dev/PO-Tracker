import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  requireAccountApi: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireAccountApi: mocks.requireAccountApi }));
import { PATCH } from "./route";
import { HttpError } from "@/lib/http";
const request = (body: object) =>
  new Request("https://app.example/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.eq.mockResolvedValue({ error: null });
  mocks.update.mockReturnValue({ eq: mocks.eq });
  mocks.requireAccountApi.mockResolvedValue({
    user: { id: "owner" },
    supabase: { from: () => ({ update: mocks.update }) },
  });
});
describe("profile changes", () => {
  it("writes only the authenticated user's name even if a role/id is submitted", async () => {
    const result = await PATCH(
      request({ displayName: "  Nitin  ", role: "admin", id: "someone-else" }),
    );
    expect(result.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({ display_name: "Nitin" });
    expect(mocks.eq).toHaveBeenCalledWith("id", "owner");
  });
  it("rejects empty names before updating", async () => {
    expect((await PATCH(request({ displayName: " " }))).status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("returns a session error without mutating", async () => {
    mocks.requireAccountApi.mockRejectedValue(
      new HttpError(401, "Log in again."),
    );
    expect((await PATCH(request({ displayName: "Nitin" }))).status).toBe(401);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
