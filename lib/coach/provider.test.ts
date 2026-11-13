import { describe, expect, it } from "vitest";
import { validateCoachReply } from "./provider";
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
});
