import type { PointFraction } from "./types";

/**
 * The fraction stamped on a flexipoint or multipoint line.
 *
 * These are the only values in the app where a fraction's *written form*
 * carries price, not just its value: the shop bills
 * `(numerator + denominator) x 2 x rate`, so `1/2` and `2/4` are the same
 * number and different money. Everything here therefore preserves the two
 * integers exactly as typed — nothing reduces, normalises, or rounds them.
 *
 * Whole numbers and mixed numbers ("4", "1 1/2") are deliberately rejected:
 * the shop bills these two components only as a bare fraction.
 */

/** Prints the pair as typed — "1/2", never "0.5" and never reduced. */
export function formatFraction(fraction: PointFraction): string {
  return `${fraction.numerator}/${fraction.denominator}`;
}

/**
 * Parse a bare fraction. Returns null for anything else — a whole number, a
 * mixed number, a decimal, or a zero denominator — so a rejected input leaves
 * the previous value standing rather than silently becoming something else.
 */
export function parseFraction(input: string): PointFraction | null {
  const match = input.trim().replace(/⁄/g, "/").match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!match) return null;

  const numerator = Number(match[1]);
  const denominator = Number(match[2]);
  if (!Number.isInteger(numerator) || !Number.isInteger(denominator)) return null;
  // A zero denominator is not a fraction; a zero numerator prices as the
  // denominator alone, which the shop does bill, so it stays allowed.
  if (denominator <= 0) return null;

  return { numerator, denominator };
}
