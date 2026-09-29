/**
 * Chop & join / framing domain types.
 *
 * Both billing modes share one geometry engine. `billingMode` selects which
 * item_prices tier the moulding is read from and whether components bill
 * individually or roll up into a single finished-frame price.
 */

import { formatInches } from "./formatInches";

export type BillingMode = "framing" | "chop_join";

/** Mirrors `items.material`. Drives which moulding formula applies. */
export type MouldingMaterial = "polystyrene" | "wood";

export type SizeMode = "artwork" | "outside";

export type MatSource = "store" | "customer";

export type LSupportSize = "small" | "big";

/** A length/width pair in inches. */
export type Dimensions = {
  lengthIn: number;
  widthIn: number;
};

/**
 * One mat layer. Index 0 is the top mat, whose border runs from the mat edge to
 * its opening; layers beneath show a reveal below the layer above them.
 *
 * Matting is modelled as a layer list, never as independent single/double/triple
 * flags — that conflation is the defect this shape exists to prevent.
 *
 * A layer carries no measurement of its own: the border belongs to the stack
 * (see `MatConfig.border`) and every layer below the top reveals a fixed
 * `MAT_REVEAL_IN`, taken from *within* that border. See ./geometry.
 */
export type MatLayer = {
  layerIndex: number;
  matBoardItemId: string;
};

/**
 * The mat border, for the whole stack rather than per layer.
 *
 * L and W are separate so a weighted mat — a wider border on one axis — is
 * still possible; the editor links them by default because an even border is
 * the common cut.
 */
export type MatBorder = {
  lengthIn: number;
  widthIn: number;
};

/** Sheet stock a mat board is cut from, used for the overflow check. */
export type MatBoardSheet = {
  itemId: string;
  label: string;
  sheetLengthIn: number;
  sheetWidthIn: number;
};

/**
 * The glass types the shop offers, as the legacy job-order screen lists them.
 *
 * This is a *type*, not a catalogue item: the glass items in inventory are
 * pre-cut stock sizes ("10\" X 12\" A CUT SIZE CLEAR GLASS") and sheet stock,
 * while custom framing cuts glass to the frame's own size. Picking a stock item
 * for a bespoke cut would record the wrong thing.
 */
export type GlazingType = "clear" | "double" | "acrylic" | "non_glare" | "octagon";

export type GlazingConfig = {
  included: boolean;
  /** Which of the five offered types. One only — never a combination. */
  glazingType: GlazingType;
  glazingItemId: string | null;
  label: string;
  /** User-entered per-square-inch rate. */
  unitRate: number;
  /**
   * Sheets per frame. Fixed at 1 for every type except double glass, which
   * sandwiches the artwork between two panes and so is the only type where the
   * count is the user's to set.
   */
  sheets: number;
  /** Cut to the mat outer size rather than the artwork/sight size. */
  cutToMatOuter: boolean;
};

/** Double glass is the only type whose sheet count the user controls. */
export const glazingSheetsEditable = (type: GlazingType): boolean => type === "double";

/**
 * The offered glass types in the order the legacy screen lists them, with the
 * swatch each shows in the picker. Labels are translated at the point of use;
 * `fallbackLabel` is what gets written onto a component row and printed.
 */
export const GLAZING_TYPES: {
  type: GlazingType;
  fallbackLabel: string;
  swatch: string;
}[] = [
  { type: "clear", fallbackLabel: "Clear glass", swatch: "#DCE9F0" },
  { type: "double", fallbackLabel: "Double glass", swatch: "#CFE2EC" },
  { type: "acrylic", fallbackLabel: "Acrylic", swatch: "#E8F0F4" },
  { type: "non_glare", fallbackLabel: "Non-glare", swatch: "#E3E9EC" },
  { type: "octagon", fallbackLabel: "Octagon glass", swatch: "#DDEAF2" },
];

export const glazingFallbackLabel = (type: GlazingType): string =>
  GLAZING_TYPES.find((entry) => entry.type === type)?.fallbackLabel ?? "Glass";

/**
 * The backing boards the shop offers. A type, not a catalogue item, for the same
 * reason as glass: the backing items in inventory are pre-cut stock sizes
 * ("8 X 10 BACKING PLAIN MDF") while custom framing cuts the board to the
 * frame's own size.
 */
export type BackingType = "mdf" | "plywood" | "sintra" | "foam";

export type BackingConfig = {
  /** Which board. Null when the frame has no backing at all. */
  backingType: BackingType | null;
  backingItemId: string | null;
  label: string;
  /** User-entered per-square-inch rate. */
  unitRate: number;
  /**
   * Board thickness in inches, for plywood only — the shop stocks it in ⅛, ¼
   * and ½, and the requisition has to say which so the workshop pulls the right
   * sheet. Unpriced: thickness is a specification, not a multiplier; the rate
   * entered alongside already reflects the board chosen.
   */
  thicknessIn?: number;
};

/** The offered backing boards, in the prototype's order, with picker swatches. */
export const BACKING_TYPES: {
  type: BackingType;
  fallbackLabel: string;
  swatch: string;
}[] = [
  { type: "mdf", fallbackLabel: "MDF", swatch: "#C9A87C" },
  { type: "plywood", fallbackLabel: "Plywood", swatch: "#D6B98F" },
  { type: "sintra", fallbackLabel: "Sintra board", swatch: "#E4E4E8" },
  { type: "foam", fallbackLabel: "Foam board", swatch: "#F2F2F5" },
];

export const backingFallbackLabel = (type: BackingType): string =>
  BACKING_TYPES.find((entry) => entry.type === type)?.fallbackLabel ?? "Backing";

/**
 * What the backing is called on the requisition and the invoice.
 *
 * Plywood carries its thickness, because the shop stocks several and the
 * workshop has to know which sheet to pull — "Plywood 1/8″", not "Plywood".
 * The thickness is derived here rather than baked into `label` at selection
 * time, which could not include a value typed afterwards.
 */
export const backingLabel = (backing: BackingConfig): string => {
  const base = backing.label || (backing.backingType ? backingFallbackLabel(backing.backingType) : "");
  if (backing.backingType !== "plywood" || !backing.thicknessIn) return base;
  return `${base} ${formatInches(backing.thicknessIn)}″`;
};

/**
 * Fitting hardware. Each carries the inventory item it bills against so it can
 * be persisted as a component row and printed on the customer's invoice — the
 * real chop & join receipts bill "FLEXIPOINTS 1/1" and "MULTIPOINTS 2/3" as
 * their own lines.
 */
export type PointFraction = {
  /** Top of the fraction, as typed — never reduced. */
  numerator: number;
  /** Bottom of the fraction, as typed — never reduced. */
  denominator: number;
};

export type PointHardware = {
  included: boolean;
  /**
   * The size is billed from the two integers the operator typed, NOT from the
   * fraction's value — see `pointAmount` in ./pricing. `1/2` and `2/4` are the
   * same number but different charges, so this can never collapse to a decimal.
   */
  fraction: PointFraction;
  unitRate: number;
  itemId: string | null;
};

export type FittingHardware = {
  flexipoints: PointHardware;
  multipoints: PointHardware;
  lSupport: {
    included: boolean;
    size: LSupportSize;
    unitRate: number;
    /** Small and big are separate inventory items, so this follows `size`. */
    itemId: string | null;
  };
};

/** Everything needed to compute one configured frame line. */
export type FrameConfiguration = {
  billingMode: BillingMode;
  /** Number of identical frames on this line. */
  quantity: number;
  sizeMode: SizeMode;
  /** Interpreted as artwork or finished-outside size per `sizeMode`. */
  enteredLengthIn: number;
  enteredWidthIn: number;
  frameWidthIn: number;
  /**
   * The whole-frame rate, used only in `framing` mode.
   *
   * Framing bills one figure for the finished frame — glass, matting, hardware
   * and the moulding are all inside this rate, not charged as parts. Ignored in
   * `chop_join`, where each component carries its own price.
   */
  frameRate: number;
  /** Rabbet overlap deducted from the artwork on each edge. */
  overlapIn: number;
  moulding: {
    itemId: string;
    code: string;
    name: string;
    /** Price for the active billing mode, read from the matching tier. */
    unitRate: number;
    /**
     * What the moulding is made of. Polystyrene and wood price by different
     * formulas, so this is not cosmetic. Null means unclassified, and pricing
     * refuses rather than guessing — a wrong guess misprices the whole line.
     */
    material: MouldingMaterial | null;
  };
  mat: {
    included: boolean;
    source: MatSource;
    /** One border for the stack; extra layers subdivide it, never extend it. */
    border: MatBorder;
    /**
     * One rate for the stack. The shop charges the same per inch whichever
     * board a layer uses, so this sits with the border rather than on each
     * layer. Discounts stay per layer — a single mat can still be marked down.
     */
    unitRate: number;
    layers: MatLayer[];
  };
  glazing: GlazingConfig;
  backing: BackingConfig;
  hardware: FittingHardware;
  /**
   * Reference files for this size — the customer's artwork photo, a detailed
   * sketch. They carry no price and never reach the requisition's billed rows;
   * they exist so the bench can see what it is framing.
   */
  attachments: FrameAttachment[];
  /**
   * Discount rate per component, keyed by the component's own key ("moulding",
   * "mat-0", "glazing", "flexipoints"). The shop discounts individual parts —
   * a wood moulding at 20% while the mat and glass on the same frame carry none
   * — so a single line-level rate cannot express what they actually quote.
   *
   * A map rather than a field on each component: keys are stable, and mats come
   * and go as layers are added, so this survives the list changing shape.
   */
  componentDiscounts?: Record<string, number>;
  /**
   * Free-text direction for the bench ("minimal mat reveal", "canvas torn
   * top-left"). Optional, and offered in both billing modes — a chop & join
   * order still carries handling notes. Prints on the requisition row when
   * present.
   *
   * Named `framingInstructions` for the stored column it maps to; the field is
   * labelled "Additional instructions" in the UI.
   */
  framingInstructions?: string;
};

/**
 * One stored reference file.
 *
 * `storagePath` is the durable reference. The bucket is private, so a URL is
 * minted per read and expires — never persist one.
 */
export type FrameAttachment = {
  /** Row id once saved; absent for a file uploaded but not yet committed. */
  id?: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
};

/** Resolved geometry for a configuration. All values in inches. */
export type FrameGeometry = {
  artwork: Dimensions;
  /** Opening per mat layer, index-aligned with the layer list. Empty when no mat. */
  openings: Dimensions[];
  /** Outer edge of the top mat — the glass and backing cut size. Null when no mat. */
  matOuter: Dimensions | null;
  /** What the frame surrounds: the mat outer when matted, otherwise the artwork. */
  sight: Dimensions;
  /** Finished outside size of the frame. */
  outside: Dimensions;
};

export type ComponentKind =
  /** The whole finished frame — the single billed row in `framing` mode. */
  | "frame"
  | "moulding"
  | "mat"
  | "glazing"
  | "backing"
  | "flexipoints"
  | "multipoints"
  | "l_support";

/** How a component's rate was arrived at — surfaced in the UI for transparency. */
export type RateSource = "tier" | "entered" | "fixed";

/** One priced part. Chop & join bills these individually; framing bills one `frame`. */
export type PricedComponent = {
  kind: ComponentKind;
  /** Stable key for React lists and for matching against persisted rows. */
  key: string;
  itemId: string | null;
  label: string;
  detail: string;
  /** Cut size where the component is cut to a size; null for countable hardware. */
  cutSize: Dimensions | null;
  quantity: number;
  unitRate: number;
  rateSource: RateSource;
  /** Discount rate for this part alone, 0–100. */
  discountPercent: number;
  /** Money taken off by the discount. */
  discountAmount: number;
  /** Net of the discount — this is what is billed and what the line total sums. */
  amount: number;
};

export type LinePricing = {
  components: PricedComponent[];
  /** Sum of every component amount. */
  total: number;
  /**
   * What the customer is billed as separate lines.
   * chop_join → one row per component; framing → a single rolled-up row.
   */
  billedLineCount: number;
};
