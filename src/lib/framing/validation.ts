/**
 * Configuration validation.
 *
 * These return user-facing messages rather than throwing — the dialog shows them
 * inline while the operator is still editing, and only blocks Apply on hard errors.
 */

import { MAT_REVEAL_IN, resolveGeometry, revealAllowanceIn } from "./geometry";
import { formatInches } from "./formatInches";
import type { Dimensions, FrameConfiguration, MatBoardSheet, MatBorder } from "./types";

export const MAX_MAT_LAYERS = 3;

export function hasMissingFittingItems(config: FrameConfiguration): boolean {
  if (config.billingMode !== "chop_join") return false;
  return Object.values(config.hardware).some((item) => item.included && !item.itemId);
}

/** A mat can be rotated onto the sheet, so compare both sides sorted. */
function fitsWithin(needed: Dimensions, sheet: MatBoardSheet): boolean {
  const need = [needed.lengthIn, needed.widthIn].sort((a, b) => a - b);
  const have = [sheet.sheetLengthIn, sheet.sheetWidthIn].sort((a, b) => a - b);
  return need[0] <= have[0] && need[1] <= have[1];
}

/**
 * Warn when the mat outer exceeds the sheet a layer is cut from.
 * Returns null when every layer fits, or there is no mat.
 */
export function matFitsSheet(
  config: FrameConfiguration,
  matBoards: Map<string, MatBoardSheet>
): string | null {
  if (!config.mat.included) return null;

  const geometry = resolveGeometry(config);
  if (!geometry.matOuter) return null;

  for (const layer of config.mat.layers) {
    const board = matBoards.get(layer.matBoardItemId);
    if (!board) continue;
    if (!fitsWithin(geometry.matOuter, board)) {
      return (
        `${board.label} sheets are ${board.sheetLengthIn}″ × ${board.sheetWidthIn}″ — ` +
        `too small for a ${geometry.matOuter.lengthIn}″ × ${geometry.matOuter.widthIn}″ mat. ` +
        `Choose a larger board or reduce the border.`
      );
    }
  }

  return null;
}

/**
 * Hard errors that must block saving the configuration.
 * An empty array means the configuration is valid.
 */
export function validateConfiguration(config: FrameConfiguration): string[] {
  const errors: string[] = [];
  const geometry = resolveGeometry(config);

  if (config.enteredLengthIn <= 0 || config.enteredWidthIn <= 0) {
    errors.push("Enter a length and width greater than zero.");
  }

  if (config.frameWidthIn < 0) {
    errors.push("Frame width cannot be negative.");
  }

  if (geometry.artwork.lengthIn <= 0 || geometry.artwork.widthIn <= 0) {
    errors.push(
      "The frame is wider than the outside size allows — reduce the frame width or increase the outside size."
    );
  }

  // Polystyrene and wood price by different formulas, so an unclassified
  // moulding cannot be priced. Refusing is safer than defaulting: a silently
  // wrong assumption misprices the whole line.
  if (config.moulding.itemId && !config.moulding.material) {
    errors.push(
      "This moulding has no material set. Set it on the item before quoting framing work."
    );
  }

  // Framing bills one figure, so a missing rate is a zero-priced frame rather
  // than a visibly empty component — worth catching before it reaches a saved
  // quotation.
  if (config.billingMode === "framing" && config.frameRate <= 0) {
    errors.push("Enter a frame rate — framing bills one price for the whole frame.");
  }

  errors.push(...validateMatting(config));

  if (config.mat.included) {
    if (config.mat.layers.length === 0) {
      errors.push("Add at least one mat layer, or turn matting off.");
    }
    if (config.mat.layers.length > MAX_MAT_LAYERS) {
      errors.push(`A frame can have at most ${MAX_MAT_LAYERS} mat layers.`);
    }

    const seen = new Set<number>();
    for (const layer of config.mat.layers) {
      if (seen.has(layer.layerIndex)) {
        errors.push("Each mat layer must have a distinct position.");
        break;
      }
      seen.add(layer.layerIndex);
    }

    const smallestOpening = geometry.openings[geometry.openings.length - 1];
    if (smallestOpening && (smallestOpening.lengthIn <= 0 || smallestOpening.widthIn <= 0)) {
      errors.push("The mat borders leave no opening — reduce the borders or reveals.");
    }
  }

  if (config.quantity < 1) {
    errors.push("Quantity must be at least one frame.");
  }

  return errors;
}

/**
 * The mat errors the matting dialog itself can fix.
 *
 * Exported so that dialog can gate its own Apply button without string-matching
 * the full error list — a reworded message would silently disable the guard.
 */
export function validateMatting(config: FrameConfiguration): string[] {
  if (!config.mat.included) return [];
  // A layer with no board saves as a priced mat the workshop cannot pull.
  if (config.mat.layers.some((layer) => !layer.matBoardItemId)) {
    return ["Choose a mat board for every layer."];
  }
  if (!matStackFitsBorder(config.mat.border, config.mat.layers.length)) {
    return [
      `The border is too narrow for ${config.mat.layers.length} mats — each mat below the top takes ${formatInches(MAT_REVEAL_IN)}″ of it.`,
    ];
  }
  // Chop & join only: framing hides the field, because the frame rate is the
  // whole charge. A zero rate there is correct, not missing.
  if (config.billingMode === "chop_join" && config.mat.unitRate <= 0) {
    return ["Enter a mat rate."];
  }
  return [];
}

/**
 * Whether the border can absorb every reveal and still leave a visible top mat.
 *
 * The reveals come out of the border, so N mats need more than
 * `(N - 1) × MAT_REVEAL_IN` on each axis. A border that exactly equals the
 * allowance leaves the top mat no face at all, which is not a mat.
 */
export function matStackFitsBorder(border: MatBorder, layerCount: number): boolean {
  if (layerCount <= 1) return border.lengthIn > 0 && border.widthIn > 0;
  const needed = revealAllowanceIn(layerCount);
  return border.lengthIn > needed && border.widthIn > needed;
}

/** Largest number of mats the given border can carry, capped at the layer limit. */
export function maxMatsForBorder(border: MatBorder): number {
  const smallest = Math.min(border.lengthIn, border.widthIn);
  if (smallest <= 0) return 0;
  // N mats take (N - 1) reveals, so the limit is the largest N where
  // (N - 1) x MAT_REVEAL_IN is still strictly less than the border — one more
  // than the number of whole reveals that fit.
  const wholeReveals = Math.ceil(smallest / MAT_REVEAL_IN);
  return Math.max(1, Math.min(MAX_MAT_LAYERS, wholeReveals));
}
