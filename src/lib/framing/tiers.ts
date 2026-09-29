/**
 * Resolving moulding rates from item price tiers.
 *
 * Mouldings carry two service-mode tiers alongside the usual customer-segment
 * ones: `framing` (billed per finished frame) and `chop_join` (billed per part).
 * Every priced moulding in the catalogue carries both, so a missing tier means
 * the item was never set up for framing work.
 */

import type { ItemPriceTier } from "@/types/item";
import type { BillingMode } from "./types";

export const FRAMING_PRICE_TIER = "framing";
export const CHOP_JOIN_PRICE_TIER = "chop_join";

/** The tier code a billing mode reads its moulding rate from. */
export const priceTierForBillingMode = (mode: BillingMode): string =>
  mode === "framing" ? FRAMING_PRICE_TIER : CHOP_JOIN_PRICE_TIER;

const isUsable = (tier: ItemPriceTier) => tier.isActive !== false;

/**
 * The moulding rate for a billing mode, or null when the item has no such tier.
 * Callers surface the null case rather than falling back to an unrelated price —
 * silently billing a customer-segment rate as a framing rate would be worse than
 * refusing to price the line.
 */
export function resolveMouldingRate(
  priceTiers: ItemPriceTier[] | undefined,
  mode: BillingMode
): number | null {
  if (!priceTiers?.length) return null;
  const wanted = priceTierForBillingMode(mode);
  const match = priceTiers.find((tier) => tier.priceTier === wanted && isUsable(tier));
  return match ? match.price : null;
}

/** True when an item can be configured as framing or chop & join work. */
export function supportsFramingWork(priceTiers: ItemPriceTier[] | undefined): boolean {
  return (
    resolveMouldingRate(priceTiers, "framing") !== null ||
    resolveMouldingRate(priceTiers, "chop_join") !== null
  );
}

/** Restored snapshots have no tiers; a newly selected item has a loaded array, even if empty. */
export function isMouldingRateMissing(
  priceTiers: ItemPriceTier[] | undefined,
  mode: BillingMode
): boolean {
  return priceTiers !== undefined && resolveMouldingRate(priceTiers, mode) === null;
}
