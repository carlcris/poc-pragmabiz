/**
 * Frame pricing.
 *
 * Every component is priced the same way regardless of billing mode — the mode
 * only decides which moulding tier is read and how the result is presented:
 *
 *   chop_join → the customer is billed per part; each component prints its own line
 *   framing   → the customer is billed one price for the finished frame
 *
 * Rates:
 *   moulding             — from item_prices, tier `framing` or `chop_join`
 *   mat / glazing / backing — user-entered per square inch (no per-area tier exists yet)
 *   hardware             — fixed per-piece rates
 *
 * Discounts are NOT folded in here. The `framing` / `chop_join` tier values are
 * gross, so any discount composes on top as a separate step.
 */

import { areaSqIn, glazingCutSize, resolveGeometry } from "./geometry";
import { backingLabel } from "./types";
import { formatFraction } from "./pointFraction";
import { formatInches } from "./formatInches";
import type {
  Dimensions,
  FrameConfiguration,
  FrameGeometry,
  LinePricing,
  PointFraction,
  PricedComponent,
} from "./types";

/** Chop & join takes 20% of the wood framing charge, per the shop's notes. */
export const WOOD_CHOP_JOIN_FACTOR = 0.2;

const MAT_LAYER_LABELS = ["Top mat", "2nd mat", "3rd mat"] as const;

const round2 = (value: number) => Math.round(value * 100) / 100;

const layerLabel = (index: number) => MAT_LAYER_LABELS[index] ?? `Mat layer ${index + 1}`;

const matCountLabel = (count: number) => {
  if (count === 1) return "Single matting";
  if (count === 2) return "Double matting";
  if (count === 3) return "Triple matting";
  return `${count}-layer matting`;
};

/**
 * Flexipoints and multipoints are billed from the fraction the operator typed,
 * using its two integers as figures in their own right:
 *
 *   amount = (numerator + denominator) x 2 x rate
 *
 * This is the shop's own formula, and it is deliberately NOT arithmetic on the
 * fraction's value: `1/2` bills 9.00 at the 1.50 rate while `2/4` — the same
 * number — bills 18.00. The pair is therefore stored as two integers and must
 * never be reduced or collapsed to a decimal.
 *
 * A smaller fraction can cost more than a larger one (`1/8` bills 27.00 against
 * `1/2`'s 9.00). That is intended: the denominator tracks how finely the strip
 * is divided, which is work, not less material.
 */
function pointAmount(fraction: PointFraction, unitRate: number): number {
  return (fraction.numerator + fraction.denominator) * 2 * unitRate;
}

/**
 * A mat layer is billed the same way the moulding is: `(L + W) × rate` on the
 * mat cut size. The rate belongs to the stack, not the layer — the shop charges
 * the same per inch whichever board a layer uses.
 *
 * Who supplied the board does not change the charge — the Store / Customer
 * toggle records it for the workshop and prints on the requisition, but both
 * price alike.
 */
function matLayerAmount(geometry: FrameGeometry, unitRate: number): number {
  return (geometry.sight.lengthIn + geometry.sight.widthIn) * unitRate;
}

/**
 * The moulding charge for one frame, from the shop's own formulas
 * (docs/prototypes/chop-and-join-source-data.md, Part 2 — "Standard framing").
 *
 *   polystyrene   (L + W) × rate
 *   wood          (L + W + FW) / 3 × rate        (framing)
 *                 (L + W + FW) / 3 × rate × 20%  (chop & join)
 *
 * `L × W` is the size the frame surrounds, and the rate already includes the
 * shop's cutting waste — there is deliberately no perimeter, no division into
 * feet and no waste multiplier here. The previous implementation billed
 * `outside perimeter ÷ 12 × 1.1 × rate`, roughly a quarter of the correct
 * figure on a small frame.
 */
function mouldingCharge(config: FrameConfiguration, size: Dimensions): number {
  const { unitRate, material } = config.moulding;
  const base = size.lengthIn + size.widthIn;

  if (material === "wood") {
    // The wood formulas divide by 3 and, for chop & join, take 20% of the
    // result. The asymmetry with polystyrene is in the shop's own notes.
    const woodBase = ((base + config.frameWidthIn) / 3) * unitRate;
    return config.billingMode === "chop_join" ? woodBase * WOOD_CHOP_JOIN_FACTOR : woodBase;
  }

  // Polystyrene, and the unclassified case. `validateConfiguration` refuses to
  // apply a line whose moulding has no material, so an unclassified moulding
  // never reaches a saved quotation — this branch only backs a live preview.
  return base * unitRate;
}

/**
 * The whole-frame charge, for `framing` mode.
 *
 *   polystyrene   (L + W) x rate
 *   wood          (L + W + FW) / 3 x rate
 *
 * `L x W` is the **sight** size — what the frame surrounds, so the artwork on a
 * bare frame and the mat outer when a mat is present. Frame width enters only
 * the wood formula; the shop's notes are asymmetric here and the code follows
 * them rather than tidying them.
 *
 * This is the ENTIRE charge. Glass, matting, hardware, backing and the moulding
 * itself are all inside the rate, which is what distinguishes framing from chop
 * & join: the customer buys a finished frame, not a bill of parts.
 */
function frameCharge(config: FrameConfiguration, sight: Dimensions): number {
  const base = sight.lengthIn + sight.widthIn;
  if (config.moulding.material === "wood") {
    return ((base + config.frameWidthIn) / 3) * config.frameRate;
  }
  return base * config.frameRate;
}

/**
 * Price every component of one configured line.
 *
 * Amounts are per line — that is, already multiplied by the frame quantity.
 *
 * In `framing` mode this returns exactly ONE row — the frame — because that is
 * what the customer is billed. The parts are still chosen and still print on the
 * requisition; they simply carry no money. `chop_join` returns a row per part.
 */
export function priceComponents(config: FrameConfiguration): PricedComponent[] {
  const geometry = resolveGeometry(config);
  const quantity = Math.max(1, config.quantity);
  const components: PricedComponent[] = [];

  if (config.billingMode === "framing") {
    return [
      {
        kind: "frame",
        key: "frame",
        itemId: config.moulding.itemId || null,
        label: config.moulding.code || "Frame",
        detail: `${formatInches(geometry.sight.lengthIn)}″ × ${formatInches(geometry.sight.widthIn)}″ finished frame`,
        cutSize: geometry.sight,
        quantity,
        unitRate: config.frameRate,
        rateSource: "entered",
        amount: round2(frameCharge(config, geometry.sight) * quantity),
        // No per-component discount: there are no components to discount, so a
        // framing line takes its discount at line level.
        discountPercent: 0,
        discountAmount: 0,
      },
    ];
  }

  /**
   * Collect one component, applying its discount.
   *
   * Every component goes through here so the discount cannot be forgotten on a
   * new one — `amount` is always net, which is what makes the line total the
   * plain sum of its parts.
   */
  const add = (component: Omit<PricedComponent, "discountPercent" | "discountAmount">) => {
    const rate = Math.min(100, Math.max(0, config.componentDiscounts?.[component.key] ?? 0));
    const discountAmount = round2((component.amount * rate) / 100);
    components.push({
      ...component,
      discountPercent: rate,
      discountAmount,
      amount: round2(component.amount - discountAmount),
    });
  };

  // The moulding is priced on the size the frame surrounds — the mat cut when
  // matted, the artwork otherwise — not on the finished outside size.
  const mouldingSize = geometry.sight;
  const mouldingAmount = mouldingCharge(config, mouldingSize);

  add({
    kind: "moulding",
    key: "moulding",
    itemId: config.moulding.itemId,
    label: `${mouldingSize.lengthIn} × ${mouldingSize.widthIn} ${config.moulding.code}`,
    detail: config.moulding.name,
    cutSize: mouldingSize,
    // Billed per frame, not per foot: the formula is a charge, not a quantity ×
    // rate. Showing 1 keeps the printed row honest about what is being counted.
    quantity,
    unitRate: config.moulding.unitRate,
    rateSource: "tier",
    amount: round2(mouldingAmount * quantity),
  });

  if (config.mat.included) {
    config.mat.layers.forEach((layer, index) => {
      // An incomplete draft is not a billable mat. Waiting for both the board
      // and border prevents a placeholder row from showing an amount before
      // the operator has supplied the inputs that determine that amount.
      if (
        !layer.matBoardItemId ||
        config.mat.border.lengthIn <= 0 ||
        config.mat.border.widthIn <= 0
      ) {
        return;
      }
      add({
        kind: "mat",
        key: `mat-${layer.layerIndex}`,
        itemId: layer.matBoardItemId,
        label: `${geometry.sight.lengthIn} × ${geometry.sight.widthIn} ${layerLabel(index).toLowerCase()}`,
        detail:
          config.mat.source === "customer"
            ? "Customer-supplied board — cutting only"
            : "Store-supplied board",
        cutSize: geometry.sight,
        quantity,
        unitRate: config.mat.unitRate,
        rateSource: "entered",
        amount: round2(matLayerAmount(geometry, config.mat.unitRate) * quantity),
      });
    });
  }

  if (config.glazing.included) {
    const cut = glazingCutSize(config, geometry);
    const sheets = Math.max(1, config.glazing.sheets);
    add({
      kind: "glazing",
      key: "glazing",
      itemId: config.glazing.glazingItemId,
      label: `${cut.lengthIn} × ${cut.widthIn} glass`,
      detail: config.glazing.label,
      cutSize: cut,
      quantity: sheets * quantity,
      unitRate: config.glazing.unitRate,
      rateSource: "entered",
      amount: round2(areaSqIn(cut) * config.glazing.unitRate * sheets * quantity),
    });
  }

  if (config.backing.backingType) {
    const cut = glazingCutSize(config, geometry);
    add({
      kind: "backing",
      key: "backing",
      itemId: config.backing.backingItemId,
      label: `${cut.lengthIn} × ${cut.widthIn} ${backingLabel(config.backing)}`,
      detail: "Backing board",
      cutSize: cut,
      quantity,
      unitRate: config.backing.unitRate,
      rateSource: "entered",
      amount: round2(areaSqIn(cut) * config.backing.unitRate * quantity),
    });
  }

  const { flexipoints, multipoints, lSupport } = config.hardware;

  if (flexipoints.included) {
    add({
      kind: "flexipoints",
      key: "flexipoints",
      itemId: flexipoints.itemId,
      label: "Flexipoints",
      detail: `${formatFraction(flexipoints.fraction)} per frame`,
      cutSize: null,
      // One charge per frame, so the invoice counts frames. The fraction is a
      // size, not a count, and lives in `detail` where it prints as typed.
      quantity,
      unitRate: flexipoints.unitRate,
      rateSource: "fixed",
      amount: round2(pointAmount(flexipoints.fraction, flexipoints.unitRate) * quantity),
    });
  }

  if (multipoints.included) {
    add({
      kind: "multipoints",
      key: "multipoints",
      itemId: multipoints.itemId,
      label: "Multipoints",
      detail: `${formatFraction(multipoints.fraction)} per frame`,
      cutSize: null,
      quantity,
      unitRate: multipoints.unitRate,
      rateSource: "fixed",
      amount: round2(pointAmount(multipoints.fraction, multipoints.unitRate) * quantity),
    });
  }

  if (lSupport.included) {
    add({
      kind: "l_support",
      key: "l_support",
      itemId: lSupport.itemId,
      label: `L-support (${lSupport.size})`,
      detail: "Per frame",
      cutSize: null,
      quantity,
      unitRate: lSupport.unitRate,
      rateSource: "fixed",
      amount: round2(lSupport.unitRate * quantity),
    });
  }

  return components;
}

/**
 * Price a line and report how many rows the customer will see.
 *
 * The total is identical across billing modes for the same rates — only the
 * presentation differs.
 */
export function priceLine(config: FrameConfiguration): LinePricing {
  const components = priceComponents(config);

  // Sum the already-rounded component amounts. Each component amount is what the
  // customer is billed for that part on a chop & join invoice, so the line total
  // must be exactly the sum of those printed figures — recomputing from full
  // precision here would leave the invoice's own rows not adding up to its total.
  const total = round2(components.reduce((sum, component) => sum + component.amount, 0));

  return {
    components,
    total,
    billedLineCount: config.billingMode === "chop_join" ? components.length : 1,
  };
}

/**
 * Per-frame price, used as the quotation line's unit price.
 *
 * Note this can differ from `total / quantity` by a rounding cent, because the
 * total is the sum of per-component amounts that were each rounded for display.
 * The line total is the authoritative figure; this is a derived per-frame view.
 */
export function unitPrice(config: FrameConfiguration): number {
  return round2(priceLine(config).total / Math.max(1, config.quantity));
}

export { matCountLabel };
