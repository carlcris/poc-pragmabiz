/**
 * Generated descriptions for configured frame lines.
 *
 * These are generated, never typed by the operator. The legacy application made
 * staff hand-type strings like `8 X 10 - 1001-1-B BLK POLYSTYRENE MOULDING`,
 * which is the root cause of the mismatches between what the screen showed and
 * what the printed form said.
 *
 * The requisition's own Article / Description column is built by
 * `documents.ts` — see `articleBlocks()`.
 */

import { formatInches } from "./formatInches";
import { matCountLabel } from "./pricing";
import { formatFraction } from "./pointFraction";
import type { FrameConfiguration } from "./types";
import type { FrameQuotationConfiguration, FrameQuotationSize } from "@/types/quotation";

/** The finished outside frame measurement shown in quotation descriptions. */
export function formatFrameOutsideSize(lengthIn: number, widthIn: number): string {
  return `${formatInches(lengthIn)}″ × ${formatInches(widthIn)}″`;
}

type StoredFrameDescription = {
  description: string;
  frameConfiguration?: FrameQuotationConfiguration | null;
  frameSizes?: FrameQuotationSize[];
};

/**
 * Present a saved configured-frame line using its finished outside size.
 *
 * Older quotation rows may still have an artwork-size prefix persisted in
 * `description`. The configuration's height/width are the finished outside
 * dimensions, so rebuild only that generated prefix and retain the saved spec.
 */
export function frameLineDescription(line: StoredFrameDescription): string {
  if (!line.frameConfiguration) return line.description;

  const configurations =
    line.frameSizes && line.frameSizes.length > 0
      ? line.frameSizes.map((size) => size.frameConfiguration)
      : [line.frameConfiguration];
  const dimensions = configurations
    .map((configuration) => formatFrameOutsideSize(configuration.height, configuration.width))
    .join(", ");
  const specSeparator = line.description.indexOf(" — ");

  return specSeparator >= 0 ? `${dimensions}${line.description.slice(specSeparator)}` : dimensions;
}

/**
 * The specification tail of a stored line description, without the dimensions.
 *
 * A stored description reads "25″ × 20″ — 057-02Q WHITE · Double matting · …".
 * Where a size already labels its own row, repeating the dimensions in front of
 * the spec is noise; worse, a multi-size line's stored description carries every
 * size's dimensions but only the FIRST size's spec, so showing the whole string
 * against one row attributes that row the wrong specification.
 *
 * Returns "" when the description has no spec tail.
 */
export function frameSpecSummary(description: string): string {
  const specSeparator = description.indexOf(" — ");
  return specSeparator >= 0 ? description.slice(specSeparator + 3).trim() : "";
}

/**
 * One-line summary shown on the quotation row and in the dialog footer.
 *
 * The moulding leads, because it is the one part every frame has and often the
 * only one billed — summarising a moulding-only frame as "no components" while
 * the requisition beside it printed a moulding and a total read as a bug.
 */
export function specSummary(config: FrameConfiguration): string {
  const parts: string[] = [];

  if (config.moulding.code) parts.push(config.moulding.code);
  if (config.mat.included && config.mat.layers.length > 0) {
    parts.push(matCountLabel(config.mat.layers.length));
  }
  if (config.glazing.included) parts.push(config.glazing.label);
  if (config.backing.backingType) parts.push(config.backing.label);
  // Framing rolls hardware into the frame rate and hides the section, so its
  // summary must not mention parts the line cannot choose.
  if (config.billingMode === "chop_join" && config.hardware.flexipoints.included) {
    parts.push(`flexi ${formatFraction(config.hardware.flexipoints.fraction)}`);
  }

  return parts.length > 0 ? parts.join(" · ") : "No components";
}
