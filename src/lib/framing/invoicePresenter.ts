/**
 * Turns a stored quotation line into the rows a customer sees.
 *
 * Billing mode is the primary switch:
 *
 *   components → one row per part consumed, matching the paper chop & join
 *                invoices ("21 X 16 - GLASS", "FLEXIPOINTS 1/1")
 *   summary    → a single row for the finished frame; parts are the shop's
 *                business, not the customer's
 *   both       → the chop & join row, followed by its breakdown as detail rows
 *
 * Framing is always a summary line. Its component list is production detail,
 * not a customer-facing quotation drilldown.
 *
 * This lives in the domain module rather than in a component because quotation,
 * Sales Order, and Invoice screens and PDFs render the same commercial line.
 * Duplicating the branch in each is how they drift, and a drift here means the
 * printed total stops matching the printed rows.
 */

import { formatFrameOutsideSize, frameLineDescription } from "./description";
import { lineAmounts } from "@/lib/quotations/lineAmounts";
import type {
  FrameInvoiceDisplayMode,
  FrameQuotationComponent,
  FrameQuotationConfiguration,
  FrameQuotationMatLayer,
  FrameQuotationSize,
} from "@/types/quotation";

/** The unit shown on every cut line of the source invoices. */
export const CUT_UNIT = "CUT";

export type InvoiceRowKind = "summary" | "component" | "sizeHeading";

/**
 * One printable row. Deliberately flat and presentation-agnostic: the PDF
 * renders these into a `<View>`, the dialog into a `<tr>`, and neither gets to
 * decide *what* is shown.
 */
export type InvoiceRow = {
  key: string;
  kind: InvoiceRowKind;
  quantity: number;
  unit: string;
  description: string;
  /** Secondary line under the description; omitted when there is nothing to add. */
  detail?: string;
  unitPrice: number;
  discountRate: number;
  /**
   * The discount in currency. A framing line is discounted by a fixed sum, so
   * the amount is the figure the shop agreed and the rate is derived from it —
   * printing the rate alone would round away the number they quoted.
   */
  discountAmount: number;
  taxRate: number;
  amount: number;
  /** True when this row is a breakdown line beneath a summary row (`both`). */
  indented: boolean;
};

/**
 * The commercial frame fields shared by quotations, sales orders, and
 * invoices. Keeping the presenter on this narrow contract lets every customer
 * document use the exact same Chop & Join row rules without coupling it to one
 * module's full record type.
 */
export type InvoicePresentableLine = {
  id: string;
  itemName?: string;
  description: string;
  quantity: number;
  uomCode?: string;
  uomName?: string;
  unitPrice: number;
  discount: number;
  discountAmount?: number;
  taxRate: number;
  lineTotal: number;
  frameConfiguration?: FrameQuotationConfiguration | null;
  frameComponents?: FrameQuotationComponent[];
  matLayers?: FrameQuotationMatLayer[];
  frameSizes?: FrameQuotationSize[];
};

/**
 * A heading naming which frame the rows beneath belong to, printed only when a
 * line carries several sizes. Without it a chop & join invoice is a flat run of
 * parts with no way to tell which frame each was cut for.
 */
function sizeHeadingRow(
  item: InvoicePresentableLine,
  configuration: FrameQuotationConfiguration,
  index: number
): InvoiceRow {
  return {
    key: `${item.id}-size-${index}`,
    kind: "sizeHeading",
    quantity: configuration.frameQuantity ?? 1,
    unit: "",
    description: formatFrameOutsideSize(configuration.height, configuration.width),
    unitPrice: 0,
    discountRate: 0,
    discountAmount: 0,
    taxRate: 0,
    // The heading carries no money of its own; the parts beneath it do.
    amount: 0,
    indented: false,
  };
}

/**
 * Description for one component row.
 *
 * `toLineItem` writes the printable form ("21 X 16 - GLASS") into `description`
 * at save time, because that is where the cut size — a property of the line's
 * geometry, not of the item — has to survive. Rows saved before that (or edited
 * by hand) may carry only a note, so fall back to the item's own name.
 */
export function componentDescription(component: FrameQuotationComponent): string {
  return component.description || component.itemName || component.itemCode || "";
}

/**
 * Resolve the display mode for a line.
 *
 * Falls back to the billing mode when the stored mode is missing, and to
 * `summary` for a plain line — never leak a parts breakdown by defaulting to
 * `components`, since that would expose the shop's per-part rates on a framing
 * quote.
 */
export function resolveDisplayMode(
  config: FrameQuotationConfiguration | null | undefined
): FrameInvoiceDisplayMode {
  if (!config) return "summary";
  if (config.billingMode === "framing") return "summary";
  if (config.invoiceDisplayMode) return config.invoiceDisplayMode;
  return config.billingMode === "chop_join" ? "components" : "summary";
}

/**
 * The discount cell: the amount, with the rate it works out to in brackets.
 *
 * "200 (20%)" — the amount first because that is what the shop agreed and what
 * the customer checks; the rate second because it is the derived figure. A rate
 * alone would round away the quoted sum, and an amount alone hides how deep the
 * cut was.
 *
 * Empty when there is no discount: a column of zeros reads as though something
 * were withheld.
 */
export function formatLineDiscount(
  discountAmount: number,
  discountRate: number,
  formatAmount: (value: number) => string
): string {
  if (!discountAmount && !discountRate) return "";
  if (!discountAmount) return `${discountRate}%`;
  const rate = Math.round(discountRate * 100) / 100;
  return rate > 0 ? `${formatAmount(discountAmount)} (${rate}%)` : formatAmount(discountAmount);
}

/** The single row standing for a whole finished frame. */
function summaryRow(item: InvoicePresentableLine): InvoiceRow {
  const amounts = lineAmounts(item);
  return {
    key: `${item.id}-summary`,
    kind: "summary",
    quantity: item.quantity,
    unit: item.uomCode || item.uomName || "",
    description: item.itemName || item.description || "",
    detail: item.itemName ? frameLineDescription(item) || undefined : undefined,
    unitPrice: item.unitPrice,
    // A fixed discount carries no stored rate, so derive one for display.
    discountRate: item.discountAmount
      ? discountRateOf(amounts.discount, amounts.subtotal - amounts.discount)
      : item.discount,
    discountAmount: Math.round(amounts.discount * 100) / 100,
    taxRate: item.taxRate,
    amount: item.lineTotal,
    indented: false,
  };
}

/**
 * The rate a fixed discount represents, against the pre-discount total.
 *
 * Shown beside the amount rather than instead of it: 200 off 1000 is exactly
 * 20%, but 200 off 1850 is 10.81%, and the shop quoted the 200.
 */
export function discountRateOf(discountAmount: number, netTotal: number): number {
  const gross = netTotal + discountAmount;
  if (gross <= 0) return 0;
  return Math.round((discountAmount / gross) * 10000) / 100;
}

function componentRow(
  item: InvoicePresentableLine,
  component: FrameQuotationComponent,
  /** Position within the line, qualified by size so keys stay unique. */
  index: number | string
): InvoiceRow {
  const discountAmount = component.discountAmount ?? 0;
  const discountRate =
    component.discountPercent ?? discountRateOf(discountAmount, component.totalAmount);

  return {
    key: component.id || `${item.id}-component-${index}`,
    kind: "component",
    quantity: component.totalQuantity,
    unit: component.uomCode || CUT_UNIT,
    description: componentDescription(component),
    unitPrice: component.unitRate,
    // The shop discounts individual parts, so this is the part's own rate —
    // a wood moulding at 20% while the mat beside it carries none.
    discountRate,
    discountAmount,
    taxRate: item.taxRate,
    amount: component.totalAmount,
    // Always indented: a component sits beneath a header in either mode, and a
    // flush row reads as a peer of the NEXT line item rather than a part of
    // this one.
    indented: true,
  };
}

/**
 * Build the printable rows for one quotation line.
 *
 * A line with no configuration is a plain item and always prints as one row.
 */
export function invoiceRows(item: InvoicePresentableLine): InvoiceRow[] {
  const config = item.frameConfiguration;
  const mode = resolveDisplayMode(config);

  // A line may carry several sizes, each with its own parts. The singular
  // fields hold the first size, so a single-size line is just a one-entry list.
  const sizes =
    item.frameSizes && item.frameSizes.length > 0
      ? item.frameSizes
      : config
        ? [
            {
              frameConfiguration: config,
              frameComponents: item.frameComponents ?? [],
              matLayers: item.matLayers ?? [],
            },
          ]
        : [];

  const hasComponents = sizes.some((size) => size.frameComponents.length > 0);
  if (!config || !hasComponents || mode === "summary") {
    return [summaryRow(item)];
  }

  const multiSize = sizes.length > 1;
  const componentRows = sizes.flatMap((size, sizeIndex) => {
    const ordered = [...size.frameComponents].sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
    );
    const rows = ordered.map((component, index) =>
      componentRow(item, component, `${sizeIndex}-${index}`)
    );
    // Only worth naming the frame when there is more than one to tell apart.
    return multiSize ? [sizeHeadingRow(item, size.frameConfiguration, sizeIndex), ...rows] : rows;
  });

  if (mode === "components") {
    return componentRows;
  }

  // `both`: the frame as billed, then what it is made of.
  return [summaryRow(item), ...componentRows];
}

/**
 * Rows used on Sales Orders and Sales Invoices. Chop & Join is sold as its
 * component detail on those documents, so an older `both` display preference
 * must not reintroduce a synthetic parent row above the billable parts.
 */
export function salesDocumentRows(item: InvoicePresentableLine): InvoiceRow[] {
  const rows = invoiceRows(item);
  if (
    item.frameConfiguration?.billingMode === "chop_join" &&
    rows.some((row) => row.kind === "component")
  ) {
    return rows.filter((row) => row.kind !== "summary");
  }
  return rows;
}

/**
 * Whether a line's parts breakdown may be shown to the customer.
 *
 * Guards the detail panels that currently render unconditionally — on a
 * `summary` line the customer is buying a finished frame, and the component
 * rates behind it are not theirs to see.
 */
export function showsComponentBreakdown(
  config: FrameQuotationConfiguration | null | undefined
): boolean {
  return resolveDisplayMode(config) !== "summary";
}
