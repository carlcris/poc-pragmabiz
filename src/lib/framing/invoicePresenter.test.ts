import { describe, expect, it } from "vitest";

import {
  invoiceRows,
  salesDocumentRows,
  resolveDisplayMode,
  showsComponentBreakdown,
  discountRateOf,
  formatLineDiscount,
} from "./invoicePresenter";
import type {
  FrameQuotationComponent,
  FrameQuotationConfiguration,
  QuotationLineItem,
} from "@/types/quotation";

const component = (overrides: Partial<FrameQuotationComponent> = {}): FrameQuotationComponent => ({
  componentType: "material",
  source: "auto",
  itemId: "item-1",
  itemCode: "GLS 0006",
  itemName: "Clear glass",
  description: "21 X 16 - Clear glass",
  qtyPerFrame: 1,
  totalQuantity: 1,
  uomId: "uom-1",
  uomCode: "CUT",
  unitRate: 0.35,
  totalAmount: 117.6,
  sortOrder: 1,
  ...overrides,
});

const config = (
  overrides: Partial<FrameQuotationConfiguration> = {}
): FrameQuotationConfiguration => ({
  width: 20.25,
  height: 23.25,
  fixedAllowance: 0,
  serviceFeeMode: "per_frame",
  serviceFeeAmount: 0,
  totalServiceFee: 0,
  invoiceDisplayMode: "components",
  billingMode: "chop_join",
  ...overrides,
});

const line = (overrides: Partial<QuotationLineItem> = {}): QuotationLineItem => ({
  id: "line-1",
  itemId: "moulding-1",
  itemCode: "1574-36B-BLK",
  itemName: "Blk Polystyrene Moulding",
  description: "Custom frame 15″ × 12″",
  quantity: 1,
  uomId: "uom-1",
  uomCode: "PCS",
  unitPrice: 400,
  discount: 0,
  discountAmount: 0,
  taxRate: 0,
  taxAmount: 0,
  lineTotal: 400,
  frameConfiguration: config(),
  frameComponents: [
    component({
      sortOrder: 0,
      componentType: "molding",
      description: "23 1/4 X 20 1/4 - Moulding",
      totalAmount: 269.27,
    }),
    component({ sortOrder: 1 }),
    component({
      sortOrder: 2,
      componentType: "accessory",
      itemId: "hw-flexi",
      itemCode: "FIT-FLEXI",
      itemName: "Flexipoints",
      description: "Flexipoints (8 pcs per frame)",
      totalQuantity: 8,
      unitRate: 1.5,
      totalAmount: 12,
    }),
  ],
  ...overrides,
});

describe("resolveDisplayMode", () => {
  it("uses the stored mode when present", () => {
    expect(resolveDisplayMode(config({ invoiceDisplayMode: "both" }))).toBe("both");
  });

  it("falls back to summary for a plain line with no configuration", () => {
    expect(resolveDisplayMode(null)).toBe("summary");
    expect(resolveDisplayMode(undefined)).toBe("summary");
  });

  it("keeps framing as a summary even when a stale display mode requests components", () => {
    const framing = config({ billingMode: "framing", invoiceDisplayMode: "components" });

    expect(resolveDisplayMode(framing)).toBe("summary");
    expect(showsComponentBreakdown(framing)).toBe(false);
  });
});

describe("invoiceRows — components mode", () => {
  it("prints one row per part, not a frame row", () => {
    const rows = invoiceRows(line());
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.kind === "component")).toBe(true);
  });

  it("itemises hardware as its own row, as the paper invoices do", () => {
    const rows = invoiceRows(line());
    const flexi = rows.find((row) => row.description.startsWith("Flexipoints"));
    expect(flexi).toBeDefined();
    expect(flexi?.quantity).toBe(8);
    expect(flexi?.amount).toBe(12);
  });

  it("orders rows by sort order, so the moulding leads", () => {
    const shuffled = line({
      frameComponents: [
        component({ sortOrder: 2, description: "third" }),
        component({ sortOrder: 0, description: "first" }),
        component({ sortOrder: 1, description: "second" }),
      ],
    });
    expect(invoiceRows(shuffled).map((row) => row.description)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });

  it("rows sum to the line total, so the printed invoice adds up", () => {
    const item = line();
    const rows = invoiceRows(item);
    const summed = rows.reduce((total, row) => total + row.amount, 0);
    // The line total is defined as the sum of component amounts (see pricing.ts).
    expect(summed).toBeCloseTo(269.27 + 117.6 + 12, 2);
  });
});

describe("invoiceRows — summary mode", () => {
  it("prints a single frame row and hides the parts", () => {
    const rows = invoiceRows(
      line({
        frameConfiguration: config({ invoiceDisplayMode: "summary", billingMode: "framing" }),
      })
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("summary");
    expect(rows[0].amount).toBe(400);
  });

  it("does not leak per-part rates on a framing line", () => {
    const rows = invoiceRows(
      line({
        frameConfiguration: config({ invoiceDisplayMode: "summary", billingMode: "framing" }),
      })
    );
    expect(rows.some((row) => row.unitPrice === 0.35)).toBe(false);
    expect(showsComponentBreakdown(config({ invoiceDisplayMode: "summary" }))).toBe(false);
  });

  it("renders framing like a normal item even if stored display data is stale", () => {
    const rows = invoiceRows(
      line({
        frameConfiguration: config({
          invoiceDisplayMode: "components",
          billingMode: "framing",
        }),
      })
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: "summary",
      quantity: 1,
      unit: "PCS",
      unitPrice: 400,
      amount: 400,
    });
  });
});

describe("invoiceRows — both mode", () => {
  it("prints the frame row followed by an indented breakdown", () => {
    const rows = invoiceRows(line({ frameConfiguration: config({ invoiceDisplayMode: "both" }) }));
    expect(rows).toHaveLength(4);
    expect(rows[0].kind).toBe("summary");
    expect(rows[0].indented).toBe(false);
    expect(rows.slice(1).every((row) => row.kind === "component" && row.indented)).toBe(true);
  });

  it("counts only the frame row toward the billed amount", () => {
    // The breakdown is explanatory; double-counting it would double the invoice.
    const rows = invoiceRows(line({ frameConfiguration: config({ invoiceDisplayMode: "both" }) }));
    const billed = rows.filter((row) => row.kind === "summary");
    expect(billed).toHaveLength(1);
    expect(billed[0].amount).toBe(400);
  });
});

describe("salesDocumentRows", () => {
  it("removes the Chop & Join parent row even when an older line requests both", () => {
    const rows = salesDocumentRows(
      line({ frameConfiguration: config({ invoiceDisplayMode: "both" }) })
    );

    expect(rows.some((row) => row.kind === "summary")).toBe(false);
    expect(rows.every((row) => row.kind === "component")).toBe(true);
  });

  it("keeps Framing and ordinary inventory as single summary rows", () => {
    const framingRows = salesDocumentRows(
      line({
        frameConfiguration: config({ billingMode: "framing", invoiceDisplayMode: "summary" }),
      })
    );
    const plainRows = salesDocumentRows(line({ frameConfiguration: null, frameComponents: [] }));

    expect(framingRows.map((row) => row.kind)).toEqual(["summary"]);
    expect(plainRows.map((row) => row.kind)).toEqual(["summary"]);
  });
});

describe("invoiceRows — plain lines", () => {
  it.each([undefined, 0, 20])(
    "excludes tax from discounts with stored amount %s",
    (discountAmount) => {
      const item = line({
        frameConfiguration: null,
        frameComponents: [],
        quantity: 2,
        unitPrice: 100,
        discount: 10,
        discountAmount,
        taxRate: 12,
        lineTotal: 201.6,
      });
      for (const present of [invoiceRows, salesDocumentRows]) {
        expect(present(item)[0]).toMatchObject({
          discountAmount: 20,
          discountRate: 10,
          amount: 201.6,
        });
      }
    }
  );

  it("calculates the effective percentage of a fixed discount before tax", () => {
    expect(
      invoiceRows(
        line({
          frameConfiguration: null,
          frameComponents: [],
          quantity: 2,
          unitPrice: 100,
          discount: 0,
          discountAmount: 20,
          taxRate: 12,
          lineTotal: 201.6,
        })
      )[0]
    ).toMatchObject({ discountAmount: 20, discountRate: 10 });
  });

  it("shows the full amount for a 100% discount without NaN", () => {
    expect(
      invoiceRows(
        line({
          frameConfiguration: null,
          frameComponents: [],
          quantity: 2,
          unitPrice: 100,
          discount: 100,
          discountAmount: undefined,
          taxRate: 12,
          lineTotal: 0,
        })
      )[0]
    ).toMatchObject({ discountAmount: 200, discountRate: 100, amount: 0 });
  });

  it("prints an unconfigured line as one row", () => {
    const rows = invoiceRows(line({ frameConfiguration: null, frameComponents: [] }));
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("summary");
  });

  it("falls back to a summary row when a configured line has no components", () => {
    const rows = invoiceRows(line({ frameComponents: [] }));
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("summary");
  });
});

describe("invoiceRows — a line carrying several sizes", () => {
  const sizedConfig = (height: number, width: number) =>
    config({
      height,
      width,
      artworkLengthIn: height - 4,
      artworkWidthIn: width - 4,
      frameQuantity: 1,
    });

  const multiSize = (): QuotationLineItem =>
    line({
      frameSizes: [
        {
          frameConfiguration: sizedConfig(8, 10),
          frameComponents: [
            component({ sortOrder: 0, description: "8x10 moulding", totalAmount: 51.48 }),
            component({ sortOrder: 1, description: "8x10 glass", totalAmount: 65 }),
          ],
          matLayers: [],
        },
        {
          frameConfiguration: sizedConfig(12, 10),
          frameComponents: [
            component({ sortOrder: 0, description: "12x10 moulding", totalAmount: 59.4 }),
          ],
          matLayers: [],
        },
      ],
    });

  it("prints every size's parts, not just the first", () => {
    // Reading only the singular `frameComponents` would drop sizes 2+ and
    // under-bill the customer.
    const rows = invoiceRows(multiSize());
    expect(rows.filter((row) => row.kind === "component")).toHaveLength(3);
  });

  it("heads each group with the frame its parts belong to", () => {
    const rows = invoiceRows(multiSize());
    const headings = rows.filter((row) => row.kind === "sizeHeading");
    expect(headings.map((row) => row.description)).toEqual(["8″ × 10″", "12″ × 10″"]);
  });

  it("keeps the money on the parts, not the heading", () => {
    // A heading with an amount would double-count against the line total.
    const rows = invoiceRows(multiSize());
    rows.filter((row) => row.kind === "sizeHeading").forEach((row) => expect(row.amount).toBe(0));
  });

  it("adds up to the line total", () => {
    const rows = invoiceRows(multiSize());
    const printed = rows
      .filter((row) => row.kind === "component")
      .reduce((total, row) => total + row.amount, 0);
    expect(printed).toBeCloseTo(51.48 + 65 + 59.4, 2);
  });

  it("prints no heading when the line has one size", () => {
    // A lone "8″ × 10″" heading is noise on a single-frame invoice.
    const rows = invoiceRows(line());
    expect(rows.some((row) => row.kind === "sizeHeading")).toBe(false);
  });

  it("still hides the breakdown on a framing line", () => {
    const rows = invoiceRows(
      line({
        frameConfiguration: config({ invoiceDisplayMode: "summary", billingMode: "framing" }),
        frameSizes: multiSize().frameSizes,
      })
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("summary");
  });
});

describe("invoiceRows — component discounts reach the printed row", () => {
  it("carries each part's own rate", () => {
    // The printed copy has a Disc column; it was reading a hardcoded 0, so a
    // discounted moulding printed at full rate beside its discounted amount.
    const rows = invoiceRows(
      line({
        frameComponents: [
          component({ sortOrder: 0, description: "Moulding", discountPercent: 20 }),
          component({ sortOrder: 1, description: "Glass" }),
        ],
      })
    );
    expect(rows.find((r) => r.description === "Moulding")?.discountRate).toBe(20);
    expect(rows.find((r) => r.description === "Glass")?.discountRate).toBe(0);
  });

  it("reports zero for a part with no discount", () => {
    // Zero rather than undefined: the column renders blank on zero, and an
    // undefined would print "NaN%".
    invoiceRows(line()).forEach((row) => {
      expect(typeof row.discountRate).toBe("number");
      expect(Number.isNaN(row.discountRate)).toBe(false);
    });
  });

  it("uses copied discounts even when a formula rate cannot reproduce the gross amount", () => {
    const rows = invoiceRows(
      line({
        frameComponents: [
          component({
            description: "Discounted moulding",
            totalQuantity: 10,
            unitRate: 0.35,
            totalAmount: 40,
            discountPercent: 20,
            discountAmount: 10,
          }),
        ],
      })
    );

    expect(rows[0].discountAmount).toBe(10);
    expect(rows[0].discountRate).toBe(20);
  });

  it("does not invent a component discount from a formula rate", () => {
    const rows = invoiceRows(
      line({
        frameComponents: [
          component({
            totalQuantity: 10,
            unitRate: 5,
            totalAmount: 40,
            discountPercent: 0,
            discountAmount: 0,
          }),
        ],
      })
    );
    expect(rows[0].discountAmount).toBe(0);
    expect(rows[0].discountRate).toBe(0);
  });

  it("carries the parent tax rate onto each billable component row", () => {
    const rows = invoiceRows(line({ taxRate: 12 }));
    expect(rows.every((row) => row.taxRate === 12)).toBe(true);
  });
});

describe("formatLineDiscount — the amount, with its rate in brackets", () => {
  const peso = (value: number) => `₱${value.toFixed(2)}`;

  it("prints the shop's example — 200 off 1000 is 200 (20%)", () => {
    expect(formatLineDiscount(200, 20, peso)).toBe("₱200.00 (20%)");
  });

  it("leads with the amount, because that is the figure agreed", () => {
    // A fixed 200 off 1850 is 10.81% — an awkward rate the shop never quoted,
    // so the amount comes first and the rate only qualifies it.
    expect(formatLineDiscount(200, discountRateOf(200, 1650), peso)).toBe("₱200.00 (10.81%)");
  });

  it("falls back to the rate alone when there is no amount", () => {
    expect(formatLineDiscount(0, 15, peso)).toBe("15%");
  });

  it("omits an empty bracket when the rate rounds to nothing", () => {
    expect(formatLineDiscount(50, 0, peso)).toBe("₱50.00");
  });

  it("stays blank when nothing was discounted", () => {
    // A column of zeros reads as though something were withheld.
    expect(formatLineDiscount(0, 0, peso)).toBe("");
  });
});

describe("discountRateOf — the rate a fixed sum represents", () => {
  it("measures against the pre-discount total, not the net", () => {
    // 200 off leaves 800, so the gross was 1000 and the rate is 20% — not 25%.
    expect(discountRateOf(200, 800)).toBe(20);
  });

  it("rounds to two decimals", () => {
    expect(discountRateOf(200, 1650)).toBe(10.81);
  });

  it("returns zero rather than dividing by nothing", () => {
    expect(discountRateOf(0, 0)).toBe(0);
  });
});

describe("components sit beneath their line, not beside the next one", () => {
  it("indents every component in `components` mode", () => {
    // The PDF prints the line's own header above these rows, so a flush
    // component reads as a peer of the NEXT line item — which is how a
    // quotation ended up looking like one giant chop & join group.
    const rows = invoiceRows(
      line({ frameConfiguration: config({ invoiceDisplayMode: "components" }) })
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.kind !== "component" || row.indented)).toBe(true);
  });

  it("leaves a plain line unindented", () => {
    // A raw-material line is nobody's component; indenting it would imply it
    // belonged to the line above.
    const rows = invoiceRows(line({ frameConfiguration: null, frameComponents: [] }));
    expect(rows.every((row) => !row.indented)).toBe(true);
  });
});
