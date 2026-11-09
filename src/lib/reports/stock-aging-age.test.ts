import { expect, it } from "vitest";
import { calculateStockAge } from "./stock-aging-age";

it.each([
  ["2025-01-01T00:00:00Z", "2026-02-04T00:00:00Z", 399, { years: 1, months: 1, days: 3 }],
  ["2024-02-29T12:00:00Z", "2025-02-28T12:00:00Z", 365, { years: 1, months: 0, days: 0 }],
  ["2024-01-31T00:00:00Z", "2024-02-29T00:00:00Z", 29, { years: 0, months: 1, days: 0 }],
  ["2025-01-31T00:00:00Z", "2025-03-30T00:00:00Z", 58, { years: 0, months: 1, days: 30 }],
  ["2025-01-01T12:00:00Z", "2025-02-01T11:59:59Z", 30, { years: 0, months: 0, days: 30 }],
  ["2025-01-01T08:00:00+08:00", "2026-02-04T00:00:00Z", 399, { years: 1, months: 1, days: 3 }],
  ["2026-01-01T00:00:00Z", "2025-01-01T00:00:00Z", 0, { years: 0, months: 0, days: 0 }],
] as const)("computes calendar age from %s to %s", (start, end, ageDays, duration) => {
  expect(calculateStockAge(start, new Date(end))).toEqual({ ageDays, duration });
});
it.each([null, "invalid"])("does not invent a duration for %s", (start) => {
  expect(calculateStockAge(start, new Date("2026-01-01Z"))).toEqual({ ageDays: 0, duration: null });
});
