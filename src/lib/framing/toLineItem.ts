/**
 * Turning a configured frame into a quotation line item.
 *
 * The line carries three things: the plain item/qty/price fields every line has,
 * the configuration + components the RPC persists into the child tables, and the
 * mat layers. Billing mode decides `invoiceDisplayMode`, which is what makes the
 * same stored data print as per-part rows or as one finished-frame row.
 */

import { priceLine, unitPrice } from "./pricing";
import { formatFrameOutsideSize, specSummary } from "./description";
import { formatDimensions } from "./formatInches";
import { resolveGeometry } from "./geometry";
import type { BillingMode, ComponentKind, FrameConfiguration, PricedComponent } from "./types";
import type { ItemSelectOption } from "@/components/common/ItemSelect";
import type {
  FrameQuotationComponent,
  FrameQuotationConfiguration,
  FrameQuotationMatLayer,
  FrameQuotationSize,
} from "@/types/quotation";

/**
 * The description persisted on a component row, and therefore the text printed
 * on the customer's invoice.
 *
 * Mirrors the notation of the shop's paper invoices exactly: the cut size, then
 * what was cut — "21 X 16 - GLASS". Countable hardware has no cut size and
 * prints its name alone — "Flexipoints".
 *
 * The priced component's `detail` ("Store-supplied board", "4 pcs per frame") is
 * deliberately *not* appended. It is context for the person configuring the
 * frame, and on a customer's invoice it reads as noise — or, where the detail is
 * the item name, as a stutter: "GLASS (GLASS)".
 */
function invoiceDescription(
  component: PricedComponent,
  option: ItemSelectOption | null,
  config: FrameConfiguration
): string {
  const name = option?.name || option?.code || componentName(component, config);
  if (!component.cutSize) return name;
  return `${formatDimensions(component.cutSize.lengthIn, component.cutSize.widthIn)} - ${name}`;
}

/**
 * What to call a component with no catalogue option behind it.
 *
 * Glass and backing are chosen by type, so the configuration carries their name.
 * The priced component's `label` is deliberately not used as a fallback: it is a
 * display string that already embeds the raw size, which would print twice —
 * "18 11/16 X 15 11/16 - 18.6875 × 15.6875 glass".
 */
function componentName(component: PricedComponent, config: FrameConfiguration): string {
  if (component.kind === "glazing") return config.glazing.label || "Glass";
  if (component.kind === "backing") return config.backing.label || "Backing";
  return component.label;
}

export type FrameLineItemFields = {
  itemId: string;
  itemCode?: string;
  itemName?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  uomId: string;
  uomCode?: string;
  uomName?: string;
  discount: number;
  /** Fixed sum off the line; set only by configured frame lines. */
  discountAmount?: number;
  taxRate: number;
  lineTotal: number;
  skipInventory: boolean;
  frameConfiguration: FrameQuotationConfiguration;
  frameComponents: FrameQuotationComponent[];
  matLayers: FrameQuotationMatLayer[];
  /** Every size, when the line carries more than one. */
  frameSizes?: FrameQuotationSize[];
  /** The line's billing mode; one mode per line, never mixed. */
  billingMode?: BillingMode;
};

type Selections = {
  moulding: ItemSelectOption | null;
  matBoards: Record<number, ItemSelectOption | null>;
  glazing: ItemSelectOption | null;
  backing: ItemSelectOption | null;
};

/** Components map onto the three types the schema allows. */
const COMPONENT_TYPE_BY_KIND: Record<ComponentKind, FrameQuotationComponent["componentType"]> = {
  // The whole-frame row bills as the moulding item it is built on.
  frame: "molding",
  moulding: "molding",
  mat: "material",
  glazing: "material",
  backing: "material",
  flexipoints: "accessory",
  multipoints: "accessory",
  l_support: "accessory",
};

/**
 * Build the quotation line for a configured frame.
 *
 * `skipInventory` is set because a configured frame's stock is consumed through
 * its components, not through the header item — the same reason the existing
 * frame-job path sets it.
 */
export function frameConfigToLineItem(
  config: FrameConfiguration,
  selections: Selections,
  fallbackUomId: string,
  /**
   * The unit a finished frame is sold in — pieces. The line's quantity counts
   * frames, so borrowing the moulding's own unit (STICK, FT) would label the row
   * with how the raw material is stocked rather than what is being sold.
   */
  frameUom?: { id: string; code: string },
  /**
   * The unit components are consumed in — cuts. A moulding is stocked in STICK
   * and a board in SHEET, but a frame consumes a length cut from one and a piece
   * cut from the other, which is how the shop's paper invoices bill them.
   */
  cutUom?: { id: string; code: string }
): FrameLineItemFields {
  const geometry = resolveGeometry(config);
  const pricing = priceLine(config);
  const quantity = Math.max(1, config.quantity);

  // Components bill in cuts; only the line header is in frames.
  const componentFallbackUomId = cutUom?.id || selections.moulding?.uomId || fallbackUomId;
  const uomId = frameUom?.id || componentFallbackUomId;

  const itemOptionFor = (kind: ComponentKind, key: string): ItemSelectOption | null => {
    if (kind === "moulding") return selections.moulding;
    if (kind === "glazing") return selections.glazing;
    if (kind === "backing") return selections.backing;
    if (kind === "mat") {
      const position = Number(key.replace("mat-", ""));
      return selections.matBoards[position] ?? null;
    }
    return null;
  };

  const frameComponents: FrameQuotationComponent[] = pricing.components
    // `item_id` is NOT NULL, so a component with no item behind it cannot be a
    // row. Every component now resolves to an item — hardware included, since
    // Step 4c seeded the fitting items — so this is a defensive guard rather
    // than something that drops parts in practice.
    .filter((component) => component.itemId !== null)
    .map((component, index) => {
      const option = itemOptionFor(component.kind, component.key);
      return {
        componentType: COMPONENT_TYPE_BY_KIND[component.kind],
        source: "auto",
        itemId: component.itemId as string,
        itemCode: option?.code,
        itemName: option?.name,
        // The printable invoice description — the cut size and what was cut,
        // e.g. "21 X 16 - GLASS". This is the row the customer reads, so the
        // size has to survive the save; `detail` alone ("Store-supplied board")
        // would leave the printed invoice with no dimensions on it.
        description: invoiceDescription(component, option, config),
        qtyPerFrame: component.quantity / quantity,
        totalQuantity: component.quantity,
        // Every component is a cut, whatever unit its material is stocked in.
        uomId: cutUom?.id || option?.uomId || componentFallbackUomId,
        uomCode: cutUom?.code ?? option?.uom ?? frameUom?.code,
        unitRate: component.unitRate,
        discountPercent: component.discountPercent || undefined,
        discountAmount: component.discountAmount || undefined,
        totalAmount: component.amount,
        roundingMode: "none",
        sortOrder: index,
      };
    });

  const matLayers: FrameQuotationMatLayer[] = config.mat.included
    ? config.mat.layers.map((layer, position) => {
        const option = selections.matBoards[position] ?? null;
        return {
          layerIndex: layer.layerIndex,
          matBoardItemId: layer.matBoardItemId,
          matBoardItemCode: option?.code,
          matBoardItemName: option?.name,
          // Every layer bills at the stack rate.
          unitRate: config.mat.unitRate,
        };
      })
    : [];

  const frameConfiguration: FrameQuotationConfiguration = {
    // width/height keep their existing meaning: the finished outside size.
    width: geometry.outside.widthIn,
    height: geometry.outside.lengthIn,
    fixedAllowance: 0,
    moldingItemId: config.moulding.itemId,
    moldingItemCode: config.moulding.code,
    moldingItemName: config.moulding.name,
    mouldingMaterial: config.moulding.material ?? undefined,
    frameQuantity: quantity,
    serviceFeeMode: "per_frame",
    serviceFeeAmount: 0,
    totalServiceFee: 0,
    invoiceDisplayMode: config.billingMode === "chop_join" ? "components" : "summary",
    billingMode: config.billingMode,
    artworkLengthIn: geometry.artwork.lengthIn,
    artworkWidthIn: geometry.artwork.widthIn,
    frameWidthIn: config.frameWidthIn,
    sizeMode: config.sizeMode,
    overlapIn: config.overlapIn,
    matSource: config.mat.source,
    glazingCutToMatOuter: config.glazing.cutToMatOuter,
    // Stored so the line can be reopened into the editor it was built in.
    matIncluded: config.mat.included,
    glazingIncluded: config.glazing.included,
    glazingType: config.glazing.glazingType,
    glazingUnitRate: config.glazing.unitRate,
    glazingSheets: config.glazing.sheets,
    backingType: config.backing.backingType ?? undefined,
    backingUnitRate: config.backing.unitRate,
    framingInstructions: config.framingInstructions?.trim() || undefined,
    backingThicknessIn: config.backing.thicknessIn || undefined,
    componentDiscounts:
      config.componentDiscounts && Object.keys(config.componentDiscounts).length > 0
        ? config.componentDiscounts
        : undefined,
    // Written whether or not the component is included, so unticking and
    // re-ticking a point restores the fraction the operator last typed.
    frameRate: config.frameRate,
    matUnitRate: config.mat.unitRate,
    matBorderLIn: config.mat.border.lengthIn,
    matBorderWIn: config.mat.border.widthIn,
    flexipointsNumerator: config.hardware.flexipoints.fraction.numerator,
    flexipointsDenominator: config.hardware.flexipoints.fraction.denominator,
    multipointsNumerator: config.hardware.multipoints.fraction.numerator,
    multipointsDenominator: config.hardware.multipoints.fraction.denominator,
    // Reference files ride along unpriced — they are never billed, so they do
    // not reach `components` and cannot affect the line total.
    attachments: config.attachments.map((attachment) => ({
      id: attachment.id,
      storagePath: attachment.storagePath,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      fileSizeBytes: attachment.fileSizeBytes,
    })),
  };

  return {
    itemId: config.moulding.itemId,
    itemCode: config.moulding.code,
    itemName: config.moulding.name,
    description: `${formatFrameOutsideSize(
      geometry.outside.lengthIn,
      geometry.outside.widthIn
    )} — ${specSummary(config)}`,
    quantity,
    unitPrice: unitPrice(config),
    uomId,
    uomCode: frameUom?.code ?? selections.moulding?.uom,
    discount: 0,
    taxRate: 0,
    lineTotal: pricing.total,
    skipInventory: true,
    frameConfiguration,
    frameComponents,
    matLayers,
  };
}

/** Money rounds to the cent, the same way `pricing.ts` rounds each component. */
const round2 = (value: number) => Math.round(value * 100) / 100;

/** The reference items a multi-size line is headed by, one per billing mode. */
export const FRAME_SERVICE_ITEM_CODES: Record<BillingMode, string> = {
  chop_join: "SVC-CHOPJOIN",
  framing: "SVC-FRAMING",
};

export type FrameSizeInput = {
  config: FrameConfiguration;
  selections: Selections;
};

/**
 * The item a multi-size line is headed by.
 *
 * `sales_quotation_items.item_id` is NOT NULL and a line carries one header, but
 * each size may use a different moulding — so no moulding can stand for the
 * whole job. A reference item names what the line is instead. It holds no stock:
 * the line sets `skipInventory`, and material is drawn later through the job
 * order's requisitions.
 */
export type FrameServiceItem = {
  id: string;
  code: string;
  name: string;
};

/**
 * Turn several configured sizes into one quotation line.
 *
 * Each size prices exactly as it would alone; the line total is their sum. The
 * singular `frameConfiguration` / `frameComponents` / `matLayers` fields carry
 * the first size, so anything reading one configuration still works.
 */
export function frameSizesToLineItem(
  sizes: FrameSizeInput[],
  billingMode: BillingMode,
  serviceItem: FrameServiceItem,
  fallbackUomId: string,
  frameUom?: { id: string; code: string },
  /**
   * The unit components are consumed in — cuts. A moulding is stocked in STICK
   * and a board in SHEET, but a frame consumes a length cut from one and a piece
   * cut from the other, which is how the shop's paper invoices bill them.
   */
  cutUom?: { id: string; code: string },
  /**
   * A fixed sum off the whole job, in currency — not per size and not per
   * frame. The shop quotes "200 off this job", and that figure must survive a
   * change of quantity, which a percentage could not: the rate that takes 200
   * off one frame takes 600 off three.
   */
  discountAmount = 0
): FrameLineItemFields {
  if (sizes.length === 0) {
    throw new Error("A configured line needs at least one size.");
  }

  const lines = sizes.map((size) =>
    frameConfigToLineItem(size.config, size.selections, fallbackUomId, frameUom, cutUom)
  );

  const frameSizes: FrameQuotationSize[] = lines.map((line) => ({
    frameConfiguration: line.frameConfiguration,
    frameComponents: line.frameComponents,
    matLayers: line.matLayers,
  }));

  // Summed from the per-size totals, which are themselves sums of printed
  // component amounts — so the invoice's rows still add up to its total.
  const grossTotal = round2(lines.reduce((total, line) => total + line.lineTotal, 0));
  const frameCount = sizes.reduce((count, size) => count + Math.max(1, size.config.quantity), 0);
  // Never below zero, and never more than the job is worth.
  const discount = Math.min(Math.max(0, discountAmount), grossTotal);
  const lineTotal = round2(grossTotal - discount);

  return {
    itemId: serviceItem.id,
    itemCode: serviceItem.code,
    itemName: serviceItem.name,
    description: describeSizes(sizes),
    // Counts frames across every size, so the row's quantity means what it says.
    quantity: frameCount,
    // The UNDISCOUNTED per-frame price, so the discount reads as a deduction
    // rather than being smeared into the unit price. With mixed sizes it is an
    // average rather than a real price, which is why `lineTotal` is sent
    // explicitly (see Step 18b).
    unitPrice: round2(grossTotal / Math.max(1, frameCount)),
    uomId: frameUom?.id || lines[0].uomId,
    uomCode: frameUom?.code ?? lines[0].uomCode,
    discount: 0,
    discountAmount: discount,
    taxRate: 0,
    lineTotal,
    skipInventory: true,
    frameConfiguration: lines[0].frameConfiguration,
    frameComponents: lines[0].frameComponents,
    matLayers: lines[0].matLayers,
    frameSizes,
    billingMode,
  };
}

/** Finished outside sizes, followed by the shared specification. */
function describeSizes(sizes: FrameSizeInput[]): string {
  const dimensions = sizes
    .map((size) => {
      const geometry = resolveGeometry(size.config);
      return formatFrameOutsideSize(geometry.outside.lengthIn, geometry.outside.widthIn);
    })
    .join(", ");
  return `${dimensions} — ${specSummary(sizes[0].config)}`;
}
