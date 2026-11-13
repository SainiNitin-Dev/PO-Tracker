import { describe, expect, it } from "vitest";
import {
  apiError,
  archiveSelection,
  HttpError,
  numberValue,
  readJson,
  uuid,
} from "./http";

describe("mutation boundaries", () => {
  it("never treats an empty or ambiguous delete payload as delete all", () => {
    for (const payload of [
      {},
      { all: "true" },
      { all: true, id: "11111111-1111-4111-8111-111111111111" },
      { id: null },
    ])
      expect(() => archiveSelection(payload)).toThrow(HttpError);
    expect(archiveSelection({ all: true })).toEqual({
      itemId: null,
      allItems: true,
    });
  });
  it("accepts a single valid identifier without a bulk flag", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(archiveSelection({ id })).toEqual({ itemId: id, allItems: false });
    expect(() => uuid("id=eq.other")).toThrow(HttpError);
  });
  it("rejects missing, coercible non-numbers and non-finite numeric values", () => {
    for (const value of [
      null,
      undefined,
      "",
      "   ",
      false,
      [],
      Infinity,
      NaN,
      "Infinity",
      -1,
    ])
      expect(() => numberValue(value, "Weight")).toThrow(HttpError);
    expect(numberValue("2.5", "Weight")).toBe(2.5);
    expect(() => numberValue(2.5, "Sets", { integer: true })).toThrow(
      HttpError,
    );
  });
  it("blocks cross-origin cookie-authenticated mutations", async () => {
    const request = new Request("https://tracker.example/api/admin/gyms", {
      method: "POST",
      headers: {
        origin: "https://attacker.example",
        "content-type": "application/json",
      },
      body: "{}",
    });
    await expect(readJson(request)).rejects.toMatchObject({ status: 403 });
  });
  it("rejects malformed JSON and arrays", async () => {
    for (const body of ["[1,2]", "null", "{"])
      await expect(
        readJson(
          new Request("https://tracker.example/api", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body,
          }),
        ),
      ).rejects.toMatchObject({ status: 400 });
  });
  it("returns explicit auth statuses and avoids exposing raw database errors", async () => {
    const expired = apiError(new HttpError(401, "Please log in again."));
    expect(expired.status).toBe(401);
    expect(await expired.json()).toEqual({ error: "Please log in again." });
    const failure = apiError({
      code: "23503",
      message: "private_table_sensitive_fk",
    });
    expect((await failure.json()).error).not.toContain("private_table");
  });
  it("distinguishes correctable inputs and missing records from server errors", async () => {
    for (const [code, status] of [["23514", 400], ["23503", 409], ["22023", 400], ["P0002", 404], ["PGRST202", 503]] as const) {
      const response = apiError({ code, message: "internal database detail" });
      expect(response.status).toBe(status);
      expect((await response.json()).error).not.toContain("internal database");
    }
  });
});
