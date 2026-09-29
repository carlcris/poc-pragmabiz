import { describe, expect, it } from "vitest";

import { formatFraction, parseFraction } from "./pointFraction";

describe("parseFraction — bare fractions only", () => {
  it("reads the two integers separately", () => {
    expect(parseFraction("1/2")).toEqual({ numerator: 1, denominator: 2 });
    expect(parseFraction("11/16")).toEqual({ numerator: 11, denominator: 16 });
  });

  it("keeps an unreduced fraction unreduced", () => {
    // 2/4 must not become 1/2: they bill differently.
    expect(parseFraction("2/4")).toEqual({ numerator: 2, denominator: 4 });
  });

  it("tolerates the spacing and slash the shop actually types", () => {
    expect(parseFraction(" 1 / 2 ")).toEqual({ numerator: 1, denominator: 2 });
    expect(parseFraction("1⁄2")).toEqual({ numerator: 1, denominator: 2 });
  });

  it("rejects whole numbers", () => {
    // The shop bills these components only as a fraction, so "4" has no price.
    expect(parseFraction("4")).toBeNull();
  });

  it("rejects mixed numbers", () => {
    expect(parseFraction("1 1/2")).toBeNull();
    expect(parseFraction("1-1/2")).toBeNull();
  });

  it("rejects decimals", () => {
    expect(parseFraction("0.5")).toBeNull();
  });

  it("rejects a zero denominator", () => {
    expect(parseFraction("1/0")).toBeNull();
  });

  it("returns null rather than a zero for junk", () => {
    // A silent zero would price the component at 2 x rate and look deliberate.
    expect(parseFraction("")).toBeNull();
    expect(parseFraction("abc")).toBeNull();
    expect(parseFraction("1/")).toBeNull();
  });
});

describe("formatFraction", () => {
  it("prints the pair as typed", () => {
    expect(formatFraction({ numerator: 1, denominator: 2 })).toBe("1/2");
    expect(formatFraction({ numerator: 2, denominator: 4 })).toBe("2/4");
  });

  it("round-trips every fraction it parses", () => {
    for (const text of ["1/2", "2/4", "1/8", "11/16", "0/3"]) {
      expect(formatFraction(parseFraction(text)!)).toBe(text);
    }
  });
});
