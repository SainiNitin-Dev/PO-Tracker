import { beforeEach, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  snapshot: vi.fn(),
  complete: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("@/lib/user", () => ({ requireApiUser: mocks.requireApiUser }));
vi.mock("@/lib/coach/training-context", () => ({
  trainingSnapshot: mocks.snapshot,
}));
vi.mock("@/lib/coach/provider", async (original) => ({
  ...(await original<typeof import("@/lib/coach/provider")>()),
  completeCoachMessage: mocks.complete,
}));

const chatId = "00000000-0000-0000-0000-000000000001";
const requestId = "00000000-0000-0000-0000-000000000002";
const ask = (message: string) =>
  POST(
    new Request("https://app.example/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, requestId, message }),
    }),
  );

function mockRead(rows: object[], single: object | null) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  chain.limit.mockResolvedValue({ data: rows, error: null });
  chain.maybeSingle.mockResolvedValue({ data: single, error: null });
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireApiUser.mockResolvedValue({
    user: { id: "owner" },
    profile: { display_name: "Member" },
    supabase: {
      from: (table: string) =>
        table === "coach_conversations"
          ? mockRead([], { id: chatId })
          : mockRead([], null),
      rpc: mocks.rpc,
    },
  });
  mocks.complete.mockResolvedValue({
    answer: "Try 3 sets as a starting point.",
    evidence: [],
  });
  mocks.rpc.mockImplementation(
    async (name: string, args: { coach_answer?: string }) => ({
      error: null,
      data:
        name === "reserve_ai_request"
          ? [{ allowed: true }]
          : { answer: args.coach_answer, evidence: [] },
    }),
  );
});

it("saves an ordinary coaching reply without fetching personal records", async () => {
  const response = await ask("How many sets should a beginner do?");
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    answer: "Try 3 sets as a starting point.",
  });
  expect(mocks.snapshot).not.toHaveBeenCalled();
  expect(mocks.complete).toHaveBeenCalledWith(expect.any(Array), null);
});

it("still looks up records for a personal question and handles unavailable data", async () => {
  mocks.snapshot.mockRejectedValueOnce(new Error("database unavailable"));
  const response = await ask("What do you think of my split?");
  expect(response.status).toBe(200);
  expect((await response.json()).answer).toContain(
    "couldn’t load your saved training records",
  );
  expect(mocks.snapshot).toHaveBeenCalledOnce();
  expect(mocks.complete).not.toHaveBeenCalled();
});
