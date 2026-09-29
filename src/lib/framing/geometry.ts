/**
 * Frame geometry.
 *
 * The size chain, which the legacy application got wrong:
 *
 *   artwork
 *     → mat openings   (bottom-up: bottom opening = artwork − 2 × overlap,
 *                       and overlap is 0 by default, so the opening is the
 *                       artwork itself and a 2″ border yields artwork + 4″,
 *                       each layer above widens by 2 × the reveal below it)
 *     → mat outer      (top opening + 2 × top border)   ← glass/backing cut size
 *     → frame outside  (mat outer + 2 × frame width)
 *
 * With no mat, `sight` is the artwork and the mat steps are skipped.
 */

import type {
  Dimensions,
  FrameConfiguration,
  FrameGeometry,
  MatBorder,
  MatLayer,
} from "./types";

/**
 * Waste allowance on the moulding *stock to draw*, for the workshop's benefit.
 *
 * This is a material-planning figure, not a pricing one — the moulding is billed
 * by the shop's own formula on the mat cut size, and the per-unit rate already
 * includes waste. See `mouldingCharge` in pricing.ts.
 */
const MOULDING_WASTE_FACTOR = 1.1;

/** Glass and backing are cut fractionally undersize so they seat in the rabbet. */
export const CUT_CLEARANCE_IN = 0.0625;

/**
 * Framing works in sixteenths of an inch (0.0625), and the glass/backing
 * clearance cut is itself a sixteenth — so a size like 15.6875 is a real,
 * exact shop measurement, not floating-point noise. Dimensions are therefore
 * stored and rounded at 4 decimals; 3 would silently turn 15.6875 into 15.688
 * and hand the workshop a cut size that is a thousandth of an inch wrong.
 */
const DIMENSION_DECIMALS = 4;
const DIMENSION_SCALE = 10 ** DIMENSION_DECIMALS;

const roundDimension = (value: number) => Math.round(value * DIMENSION_SCALE) / DIMENSION_SCALE;

const dims = (lengthIn: number, widthIn: number): Dimensions => ({
  lengthIn: roundDimension(lengthIn),
  widthIn: roundDimension(widthIn),
});

/**
 * Resolve the artwork size from what the user entered.
 *
 * In `outside` mode the entered dimensions are the finished frame, so the
 * artwork is derived by removing the frame on both edges. Note this yields the
 * *sight* size when a mat is present — the mat border is removed separately by
 * the opening chain.
 */
export function resolveArtworkSize(config: FrameConfiguration): Dimensions {
  const { enteredLengthIn, enteredWidthIn, frameWidthIn, sizeMode } = config;
  if (sizeMode === "outside") {
    return dims(enteredLengthIn - 2 * frameWidthIn, enteredWidthIn - 2 * frameWidthIn);
  }
  return dims(enteredLengthIn, enteredWidthIn);
}

/**
 * The band of itself each mat below the top shows.
 *
 * Fixed by the shop, not chosen per job: every additional mat reveals a quarter
 * inch. It is taken from *within* the border rather than added outside it, so
 * stacking mats subdivides the border and never grows the frame.
 */
export const MAT_REVEAL_IN = 0.25;

/** How much of the border the reveals consume, leaving the top mat's face. */
export function revealAllowanceIn(layerCount: number): number {
  return Math.max(0, layerCount - 1) * MAT_REVEAL_IN;
}

/**
 * Compute each mat layer's opening, working top-down from the outer edge.
 *
 * The shop sets one border for the whole stack. The top mat's outer edge is the
 * artwork plus that border on each side, and every mat beneath shows a fixed
 * `MAT_REVEAL_IN` band taken from within it — so a second or third mat changes
 * what the frame *looks* like, never how big it is.
 *
 * The bottom layer's opening is the artwork less the rabbet overlap on each
 * edge; that overlap is zero unless a line asks for one.
 *
 * Returns openings index-aligned with `layers` (index 0 = top mat).
 */
export function matOpenings(
  artwork: Dimensions,
  layers: MatLayer[],
  overlapIn: number
): Dimensions[] {
  if (layers.length === 0) return [];

  const openings: Dimensions[] = new Array(layers.length);
  // Bottom mat holds the artwork; each mat above it steps out by one reveal.
  const bottomLength = artwork.lengthIn - 2 * overlapIn;
  const bottomWidth = artwork.widthIn - 2 * overlapIn;

  for (let index = layers.length - 1; index >= 0; index -= 1) {
    const stepsAbove = layers.length - 1 - index;
    openings[index] = dims(
      bottomLength + 2 * stepsAbove * MAT_REVEAL_IN,
      bottomWidth + 2 * stepsAbove * MAT_REVEAL_IN
    );
  }

  return openings;
}

/**
 * Outer edge of the top mat — the size glass and backing are cut to.
 *
 * Always the artwork plus the stack's border, whatever the layer count: the
 * reveals live inside the border, so they cannot enlarge this.
 */
export function matOuter(artwork: Dimensions, border: MatBorder, overlapIn: number): Dimensions {
  return dims(
    artwork.lengthIn - 2 * overlapIn + 2 * border.lengthIn,
    artwork.widthIn - 2 * overlapIn + 2 * border.widthIn
  );
}

/** Finished outside size: whatever the frame surrounds, plus the frame on each edge. */
export function frameOutside(sight: Dimensions, frameWidthIn: number): Dimensions {
  return dims(sight.lengthIn + 2 * frameWidthIn, sight.widthIn + 2 * frameWidthIn);
}

/**
 * Linear feet of moulding stock for one frame, including the waste allowance.
 *
 * Tells the workshop how much to pull off the rack; it does **not** price the
 * line. Measured on the finished outside size, because that is the length of
 * stick each side is actually cut from.
 */
export function mouldingFootage(outside: Dimensions): number {
  const perimeterIn = 2 * (outside.lengthIn + outside.widthIn);
  return roundDimension((perimeterIn / 12) * MOULDING_WASTE_FACTOR);
}

/** Resolve the full geometry chain for a configuration. */
export function resolveGeometry(config: FrameConfiguration): FrameGeometry {
  const artwork = resolveArtworkSize(config);
  const layers = config.mat.included ? config.mat.layers : [];

  const openings = matOpenings(artwork, layers, config.overlapIn);
  const outer =
    openings.length > 0 ? matOuter(artwork, config.mat.border, config.overlapIn) : null;
  const sight = outer ?? artwork;

  return {
    artwork,
    openings,
    matOuter: outer,
    sight,
    outside: frameOutside(sight, config.frameWidthIn),
  };
}

/**
 * The size glass and backing are cut to, before the seating clearance.
 * Follows the mat outer when the user asked for it and a mat exists.
 */
export function glazingCutSize(config: FrameConfiguration, geometry: FrameGeometry): Dimensions {
  const base =
    config.glazing.cutToMatOuter && geometry.matOuter ? geometry.matOuter : geometry.sight;
  return dims(base.lengthIn - CUT_CLEARANCE_IN, base.widthIn - CUT_CLEARANCE_IN);
}

/** Area in square inches. Mat, glass and backing are all priced per square inch. */
export const areaSqIn = (size: Dimensions): number =>
  roundDimension(size.lengthIn * size.widthIn);

/** Perimeter in inches, used when the customer supplies the mat board. */
export const perimeterIn = (size: Dimensions): number =>
  roundDimension(2 * (size.lengthIn + size.widthIn));
