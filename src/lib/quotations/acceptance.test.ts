import { describe, expect, it } from "vitest";

import { isAcceptanceChannel, validateAcceptance } from "./acceptance";

describe("validateAcceptance — all three parts or none", () => {
  const complete = {
    acceptedByName: "Juan Dela Cruz",
    acceptedChannel: "viber" as const,
    waiverPaths: ["waivers/q1/signed.jpg"],
  };

  it("accepts a complete record", () => {
    expect(validateAcceptance(complete)).toEqual([]);
  });

  it("requires who accepted it", () => {
    expect(validateAcceptance({ ...complete, acceptedByName: "" })).toEqual([
      "Enter who accepted the quotation.",
    ]);
  });

  it("treats a blank name as missing", () => {
    // Otherwise a space satisfies the record while proving nothing.
    expect(validateAcceptance({ ...complete, acceptedByName: "   " })).toHaveLength(1);
  });

  it("requires a channel from the fixed list", () => {
    expect(
      validateAcceptance({ ...complete, acceptedChannel: "telegram" as never })
    ).toEqual(["Choose the channel it was accepted through."]);
  });

  it("requires at least one waiver", () => {
    expect(validateAcceptance({ ...complete, waiverPaths: [] })).toEqual([
      "Attach the signed waiver.",
    ]);
  });

  it("reports every missing part at once", () => {
    // One at a time would make the operator submit three times to learn what
    // the form wants.
    expect(validateAcceptance({})).toHaveLength(3);
  });
});

describe("isAcceptanceChannel", () => {
  it("accepts the shop's channels", () => {
    for (const channel of ["messenger", "viber", "sms", "email", "phone", "in_person", "other"]) {
      expect(isAcceptanceChannel(channel)).toBe(true);
    }
  });

  it("rejects anything else, so the column stays reportable", () => {
    expect(isAcceptanceChannel("Viber")).toBe(false);
    expect(isAcceptanceChannel("viber msg")).toBe(false);
    expect(isAcceptanceChannel(undefined)).toBe(false);
  });
});
