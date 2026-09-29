/**
 * Inch formatting for shop-facing output.
 *
 * The shop measures in sixteenths and the paper invoices print fractions, not
 * decimals — "23 1/4 X 35 1/4", never "23.25 X 35.25". A customer comparing a
 * printed quote against a previous receipt should see the same notation, and
 * the workshop cutting to a decimal has to convert it back by hand.
 */

/** Denominator the shop works to. Everything is rounded to this grid. */
const SIXTEENTH = 16;

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/**
 * Format one measurement as a whole number plus a reduced fraction.
 *
 * Values are snapped to the nearest sixteenth first, so floating-point drift
 * (15.687499999) prints as the measurement it represents (15 11/16).
 */
export function formatInches(value: number): string {
  if (!Number.isFinite(value)) return "0";

  const negative = value < 0;
  const abs = Math.abs(value);

  const sixteenths = Math.round(abs * SIXTEENTH);
  const whole = Math.floor(sixteenths / SIXTEENTH);
  const remainder = sixteenths % SIXTEENTH;

  let text: string;
  if (remainder === 0) {
    text = String(whole);
  } else {
    const divisor = gcd(remainder, SIXTEENTH);
    const fraction = `${remainder / divisor}/${SIXTEENTH / divisor}`;
    // A measurement under 1" prints as the bare fraction — "3/4", not "0 3/4".
    text = whole === 0 ? fraction : `${whole} ${fraction}`;
  }

  return negative ? `-${text}` : text;
}

/** A length × width pair as the invoices print it: "21 X 16". */
export function formatDimensions(lengthIn: number, widthIn: number): string {
  return `${formatInches(lengthIn)} X ${formatInches(widthIn)}`;
}

/**
 * Parse what the shop types back into a number.
 *
 * The inverse of `formatInches`. Staff read fractions off a tape measure and
 * type them the same way — "1/2", "15 1/2", "15-1/2" — and `Number()` returns
 * NaN for every one of those, which the callers were quietly turning into 0.
 * A quantity or a dimension silently becoming zero is the worst failure mode
 * available here, so this accepts the notation the rest of the module prints.
 *
 * Accepts: "8", "8.5", "1/2", "15 1/2", "15-1/2", "15 1/2\"". Returns null when
 * the text is not a measurement, so callers can leave the previous value alone
 * rather than guessing.
 */
export function parseInches(input: string): number | null {
  // Tolerate the inch mark and the unicode fraction slash the shop's own
  // documents use.
  const text = input.trim().replace(/["″]/g, "").replace(/⁄/g, "/").trim();
  if (text === "") return null;

  const negative = text.startsWith("-") && !/^-\d+\/\d+$/.test(text);
  const body = negative ? text.slice(1).trim() : text;

  // "15 1/2" or "15-1/2" — a whole part and a fraction.
  const mixed = body.match(/^(\d+)\s*[-\s]\s*(\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    const [, whole, numerator, denominator] = mixed;
    if (Number(denominator) === 0) return null;
    const value = Number(whole) + Number(numerator) / Number(denominator);
    return negative ? -value : value;
  }

  // "1/2" alone.
  const fraction = body.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fraction) {
    const [, numerator, denominator] = fraction;
    if (Number(denominator) === 0) return null;
    const value = Number(numerator) / Number(denominator);
    return negative ? -value : value;
  }

  // Plain decimal or whole number.
  if (!/^\d*\.?\d+$/.test(body)) return null;
  const value = Number(body);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}
