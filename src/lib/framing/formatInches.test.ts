import { describe, expect, it } from "vitest";

import { formatDimensions, formatInches, parseInches } from "./formatInches";

describe("formatInches", () => {
  it("prints a whole number with no fraction", () => {
    expect(formatInches(21)).toBe("21");
  });

  it("prints the fractions the paper invoices use", () => {
    expect(formatInches(23.25)).toBe("23 1/4");
    expect(formatInches(30.125)).toBe("30 1/8");
    expect(formatInches(18.5)).toBe("18 1/2");
  });

  it("reduces sixteenths to lowest terms", () => {
    expect(formatInches(15.6875)).toBe("15 11/16");
    expect(formatInches(4.75)).toBe("4 3/4");
    expect(formatInches(2.0625)).toBe("2 1/16");
  });

  it("prints a bare fraction below one inch", () => {
    expect(formatInches(0.125)).toBe("1/8");
    expect(formatInches(0.5)).toBe("1/2");
  });

  it("snaps floating-point drift to the nearest sixteenth", () => {
    // 15.6875 is a real shop measurement; arithmetic can land just off it.
    expect(formatInches(15.687499999)).toBe("15 11/16");
    expect(formatInches(23.2500001)).toBe("23 1/4");
  });

  it("handles zero and non-finite input without emitting junk", () => {
    expect(formatInches(0)).toBe("0");
    expect(formatInches(Number.NaN)).toBe("0");
    expect(formatInches(Number.POSITIVE_INFINITY)).toBe("0");
  });

  it("keeps a negative sign outside the measurement", () => {
    expect(formatInches(-2.25)).toBe("-2 1/4");
  });

  it("pairs dimensions the way the invoices print them", () => {
    expect(formatDimensions(21, 16)).toBe("21 X 16");
    expect(formatDimensions(23.25, 35.25)).toBe("23 1/4 X 35 1/4");
  });
});

describe("parseInches — what the shop types", () => {
  it("reads a bare fraction", () => {
    expect(parseInches("1/2")).toBe(0.5);
    expect(parseInches("1/8")).toBe(0.125);
    expect(parseInches("3/16")).toBe(0.1875);
  });

  it("reads a mixed number the way it is written on a tape", () => {
    expect(parseInches("15 1/2")).toBe(15.5);
    expect(parseInches("15-1/2")).toBe(15.5);
    expect(parseInches("8 11/16")).toBeCloseTo(8.6875, 6);
  });

  it("still reads plain numbers", () => {
    expect(parseInches("8")).toBe(8);
    expect(parseInches("8.5")).toBe(8.5);
    expect(parseInches(".5")).toBe(0.5);
  });

  it("tolerates the inch mark the documents print", () => {
    expect(parseInches('15 1/2"')).toBe(15.5);
    expect(parseInches("15 1/2″")).toBe(15.5);
  });

  it("returns null rather than zero for nonsense", () => {
    // The old Number() path turned every one of these into 0, silently
    // zeroing a quantity or a dimension.
    expect(parseInches("abc")).toBeNull();
    expect(parseInches("")).toBeNull();
    expect(parseInches("1/")).toBeNull();
    expect(parseInches("1/0")).toBeNull();
    expect(parseInches("--5")).toBeNull();
  });

  it("round-trips whatever formatInches prints", () => {
    // The two must agree, or a saved value re-read from the screen drifts.
    [0.125, 0.5, 8, 8.6875, 15.5, 23.25].forEach((value) => {
      expect(parseInches(formatInches(value))).toBeCloseTo(value, 6);
    });
  });
});
