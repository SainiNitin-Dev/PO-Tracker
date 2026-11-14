import { afterEach, describe, expect, it, vi } from "vitest";
import { completeCoachMessage, validateCoachReply } from "./provider";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("coach grounding", () => {
  const facts = [
    { id: "f1", text: "You logged 50 kg for 8 reps.", source: "Recorded set" },
  ];
  it("expands only known facts and exposes their evidence", () => {
    expect(
      validateCoachReply(
        '{"answer":"Here’s the record: [[fact:f1]] Keep the load steady for now."}',
        facts,
      ),
    ).toEqual({
      answer:
        "Here’s the record: You logged 50 kg for 8 reps. Keep the load steady for now.",
      evidence: facts,
    });
  });
  it("rejects invented measurements, unknown records and malformed output", () => {
    for (const response of [
      '{"answer":"You improved by 20%."}',
      '{"answer":"[[fact:f99]]"}',
      "{}",
      "not JSON",
    ])
      expect(() => validateCoachReply(response, facts)).toThrow();
  });
  it("deduplicates evidence used more than once", () => {
    expect(
      validateCoachReply('{"answer":"[[fact:f1]] [[fact:f1]]"}', facts)
        .evidence,
    ).toHaveLength(1);
  });
  it("accepts numbered formatting without accepting invented measurements", () => {
    const result = validateCoachReply(
      JSON.stringify({ answer: "1. [[fact:f1]]\n2. Keep the same load." }),
      facts,
    );
    expect(result.answer).toContain("• You logged 50 kg for 8 reps.");
  });
  it.each(["invalid numbers", "quota", "timeout", "generic reply"])(
    "answers a split question from the plan after %s",
    async (failure) => {
      vi.stubEnv("CHAT_API_BASE_URL", "https://provider.test/v1");
      vi.stubEnv("CHAT_API_KEY", "test");
      vi.stubEnv("CHAT_MODEL", "test");
      const fetch = vi.fn(async () => {
        if (failure === "timeout") throw new Error("timeout");
        if (failure === "quota") return new Response(null, { status: 429 });
        const answer =
          failure === "invalid numbers"
            ? "You train 12 days a week."
            : "Tell me your split.";
        return Response.json({
          choices: [{ message: { content: JSON.stringify({ answer }) } }],
        });
      });
      vi.stubGlobal("fetch", fetch);
      const plan = {
        id: "f2",
        source: "Your active training plan",
        text: "My Plan / Push (Monday): Bench Press, 3 sets of 8–12 reps.",
      };
      const reply = await completeCoachMessage(
        [{ role: "user", content: "What do you think of my split?" }],
        { name: "", facts: [plan], notes: [], coverage: "" },
      );
      expect(reply.answer).toContain(plan.text);
      expect(reply.evidence).toEqual([plan]);
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );
  it("asks for details when the plan and provider are unavailable", async () => {
    vi.stubEnv("CHAT_API_KEY", "");
    const reply = await completeCoachMessage(
      [{ role: "user", content: "Review my plan" }],
      {
        name: "",
        facts: [
          {
            id: "f1",
            source: "Training plans",
            text: "You do not have an active training plan.",
          },
        ],
        notes: [],
        coverage: "",
      },
    );
    expect(reply.answer).toContain("Tell me which days you train");
  });
});
