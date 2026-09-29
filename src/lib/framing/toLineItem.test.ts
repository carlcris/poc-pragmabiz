import { describe, expect, it } from "vitest";

import { frameConfigToLineItem, frameSizesToLineItem } from "./toLineItem";
import { priceLine } from "./pricing";
import type { FrameConfiguration, MatLayer } from "./types";
import type { ItemSelectOption } from "@/components/common/ItemSelect";

const option = (id: string, code: string, name: string): ItemSelectOption => ({
  id,
  code,
  name,
  uom: "PC",
  uomId: "uom-1",
  listPrice: 0,
});

const MOULDING = option("moulding-1", "1574-36B-BLK", "Blk Polystyrene Moulding");
const BOARD = option("mat-1", "EM 1019", "Cream White Matboard");
const GLASS = option("glass-1", "GLS 0006", "Clear glass");
const BACKING = option("back-1", "PLY-18", "Plywood ⅛″");

const selections = {
  moulding: MOULDING,
  matBoards: { 0: BOARD } as Record<number, ItemSelectOption | null>,
  glazing: GLASS,
  backing: BACKING,
};

const layer = (overrides: Partial<MatLayer> = {}): MatLayer => ({
  layerIndex: 0,
  matBoardItemId: BOARD.id,
  ...overrides,
});

const makeConfig = (overrides: Partial<FrameConfiguration> = {}): FrameConfiguration => ({
  billingMode: "chop_join",
  quantity: 1,
  sizeMode: "artwork",
  enteredLengthIn: 15,
  enteredWidthIn: 12,
  frameRate: 0,
  frameWidthIn: 2.25,
  overlapIn: 0.125,
  moulding: {
    itemId: MOULDING.id,
    code: MOULDING.code,
    name: MOULDING.name,
    unitRate: 6.19,
    material: "polystyrene",
  },
  mat: {
    included: true,
    source: "store",
    border: { lengthIn: 2, widthIn: 2 },
    unitRate: 2.5,
    layers: [layer()],
  },
  glazing: {
    included: true,
    glazingType: "clear",
    glazingItemId: GLASS.id,
    label: "Clear glass",
    unitRate: 0.35,
    sheets: 1,
    cutToMatOuter: true,
  },
  backing: { backingType: "mdf", backingItemId: BACKING.id, label: "Plywood ⅛″", unitRate: 0.16 },
  hardware: {
    flexipoints: {
      included: true,
      fraction: { numerator: 1, denominator: 2 },
      unitRate: 1.5,
      itemId: "hw-flexi",
    },
    multipoints: {
      included: false,
      fraction: { numerator: 1, denominator: 2 },
      unitRate: 8,
      itemId: "hw-multi",
    },
    lSupport: { included: false, size: "small", unitRate: 35, itemId: "hw-lsup" },
  },
  attachments: [],
  ...overrides,
});

describe("frameConfigToLineItem — billing mode drives display", () => {
  it("marks a chop & join line to print its components", () => {
    const line = frameConfigToLineItem(
      makeConfig({ billingMode: "chop_join" }),
      selections,
      "uom-1"
    );
    expect(line.frameConfiguration.billingMode).toBe("chop_join");
    expect(line.frameConfiguration.invoiceDisplayMode).toBe("components");
  });

  it("marks a framing line to print as one summary row", () => {
    const line = frameConfigToLineItem(makeConfig({ billingMode: "framing" }), selections, "uom-1");
    expect(line.frameConfiguration.billingMode).toBe("framing");
    expect(line.frameConfiguration.invoiceDisplayMode).toBe("summary");
  });
});

describe("frameConfigToLineItem — persisted shape", () => {
  it("carries the geometry the schema stores", () => {
    const line = frameConfigToLineItem(makeConfig(), selections, "uom-1");
    const config = line.frameConfiguration;

    expect(config.artworkLengthIn).toBe(15);
    expect(config.artworkWidthIn).toBe(12);
    expect(config.frameWidthIn).toBe(2.25);
    expect(config.overlapIn).toBe(0.125);
    expect(config.sizeMode).toBe("artwork");
    expect(config.matSource).toBe("store");
    expect(config.glazingCutToMatOuter).toBe(true);
  });

  it("stores width/height as the finished outside size", () => {
    // artwork 15×12 → mat outer 18.75×15.75 → outside 23.25×20.25
    const config = frameConfigToLineItem(makeConfig(), selections, "uom-1").frameConfiguration;
    expect(config.height).toBe(23.25);
    expect(config.width).toBe(20.25);
  });

  it("emits one mat layer row per configured layer, preserving index", () => {
    const line = frameConfigToLineItem(
      makeConfig({
        mat: {
          included: true,
          source: "store",
          border: { lengthIn: 2, widthIn: 2 },
          unitRate: 2.5,
          layers: [layer({ layerIndex: 0 }), layer({ layerIndex: 1 })],
        },
      }),
      { ...selections, matBoards: { 0: BOARD, 1: BOARD } },
      "uom-1"
    );
    expect(line.matLayers).toHaveLength(2);
    expect(line.matLayers.map((l) => l.layerIndex)).toEqual([0, 1]);
    // Layers carry no measurement; the border is written on the configuration.
    expect(line.frameConfiguration?.matBorderLIn).toBe(2);
    expect(line.frameConfiguration?.matBorderWIn).toBe(2);
  });

  it("emits no mat layers when matting is off", () => {
    const line = frameConfigToLineItem(
      makeConfig({
        mat: {
          included: false,
          source: "store",
          border: { lengthIn: 2, widthIn: 2 },
          unitRate: 2.5,
          layers: [],
        },
      }),
      selections,
      "uom-1"
    );
    expect(line.matLayers).toEqual([]);
  });

  it("maps component kinds onto the three types the schema allows", () => {
    const line = frameConfigToLineItem(makeConfig(), selections, "uom-1");
    const types = new Set(line.frameComponents.map((c) => c.componentType));
    types.forEach((type) => {
      expect(["molding", "material", "accessory"]).toContain(type);
    });
    expect(line.frameComponents.find((c) => c.itemId === MOULDING.id)?.componentType).toBe(
      "molding"
    );
  });

  it("writes the printable invoice description onto each component", () => {
    // The paper invoices read "21 X 16 - GLASS": cut size, then what was cut.
    // The size is a property of the line's geometry, so it has to be written at
    // save time or the printed invoice has no dimensions on it at all.
    const line = frameConfigToLineItem(makeConfig(), selections, "uom-1");
    const glass = line.frameComponents.find((c) => c.itemId === GLASS.id);

    expect(glass?.description).toBe(`18 11/16 X 15 11/16 - ${GLASS.name}`);
    expect(glass?.description).not.toMatch(/[()]/);
  });

  it("prints countable hardware without a cut size", () => {
    const line = frameConfigToLineItem(makeConfig(), selections, "uom-1");
    const flexi = line.frameComponents.find((c) => c.itemId === "hw-flexi");
    expect(flexi?.description).toBe("Flexipoints");
  });

  it("persists glass and backing rows now that they are chosen by type", () => {
    // They price into the line total, so they must reach the breakdown — else the
    // customer pays for glass and backing that never appear on the invoice.
    const config = makeConfig({
      glazing: {
        included: true,
        glazingType: "double",
        glazingItemId: "glz-double",
        label: "With Double Glass",
        unitRate: 0.35,
        sheets: 2,
        cutToMatOuter: true,
      },
      backing: {
        backingType: "plywood",
        backingItemId: "bck-ply",
        label: "Plywood",
        unitRate: 0.16,
      },
    });
    const line = frameConfigToLineItem(
      config,
      { ...selections, glazing: null, backing: null },
      "uom-1"
    );
    expect(line.frameComponents).toHaveLength(priceLine(config).components.length);
    expect(line.frameComponents.some((c) => c.itemId === "glz-double")).toBe(true);
    expect(line.frameComponents.some((c) => c.itemId === "bck-ply")).toBe(true);
  });

  it("names glass and backing by their type, without repeating the size", () => {
    // The priced component's label already embeds the raw size; using it as the
    // name printed "18 11/16 X 15 11/16 - 18.6875 × 15.6875 glass".
    const config = makeConfig({
      glazing: {
        included: true,
        glazingType: "non_glare",
        glazingItemId: "glz-ng",
        label: "With Non Glare",
        unitRate: 0.35,
        sheets: 1,
        cutToMatOuter: true,
      },
      backing: { backingType: "mdf", backingItemId: "bck-mdf", label: "MDF", unitRate: 0.16 },
    });
    const line = frameConfigToLineItem(
      config,
      { ...selections, glazing: null, backing: null },
      "uom-1"
    );
    const glass = line.frameComponents.find((c) => c.itemId === "glz-ng");
    const backing = line.frameComponents.find((c) => c.itemId === "bck-mdf");

    expect(glass?.description).toBe("18 11/16 X 15 11/16 - With Non Glare");
    expect(backing?.description).toBe("18 11/16 X 15 11/16 - MDF");
    // no decimal size leaking through from the display label
    expect(glass?.description).not.toMatch(/\d\.\d/);
    expect(backing?.description).not.toMatch(/\d\.\d/);
  });

  it("omits backing entirely when no board is chosen", () => {
    const config = makeConfig({
      backing: { backingType: null, backingItemId: null, label: "", unitRate: 0.16 },
    });
    const line = frameConfigToLineItem(config, selections, "uom-1");
    expect(line.frameComponents.some((c) => c.description.includes("MDF"))).toBe(false);
  });

  it("charges the whole frame on the line, not just the moulding", () => {
    // One stored line, exploded at render time (plan decision 1). The row shows
    // the moulding's name, so it is worth pinning that the *total* covers every
    // part — the moulding itself is a small fraction of it.
    const config = makeConfig();
    const line = frameConfigToLineItem(config, selections, "uom-1");
    const priced = priceLine(config);
    const moulding = priced.components.find((c) => c.kind === "moulding")!;

    expect(line.lineTotal).toBeCloseTo(
      priced.components.reduce((sum, c) => sum + c.amount, 0),
      2
    );
    expect(moulding.amount).toBeLessThan(line.lineTotal * 0.5);
  });

  it("describes what the line actually is, beyond the moulding name", () => {
    // The quotation row renders this; without it a configured frame is
    // indistinguishable from buying a length of moulding.
    const line = frameConfigToLineItem(makeConfig(), selections, "uom-1");
    expect(line.description).toContain("23 1/4″ × 20 1/4″");
    expect(line.description).toContain("Single matting");
  });

  it("carries an exact total that quantity × rate cannot reproduce", () => {
    // The line total is the sum of printed component amounts; the rate is a
    // rounded per-frame view of it. Multiplying the rate back drifts by a cent,
    // which is why the line total is sent explicitly and the server honours it.
    const config = makeConfig({ quantity: 5 });
    const line = frameConfigToLineItem(config, selections, "uom-1");
    const recomputed = Math.round(line.unitPrice * line.quantity * 100) / 100;

    expect(line.lineTotal).toBe(priceLine(config).total);
    // Documents the drift rather than asserting it away.
    expect(Math.abs(recomputed - line.lineTotal)).toBeLessThanOrEqual(0.05);
  });

  it("sells the frame in the unit given, not the moulding's stocking unit", () => {
    // Moulding is stocked by the STICK; the line's quantity counts finished
    // frames, so labelling the row STICK describes the wrong thing.
    const stickMoulding = { ...MOULDING, uom: "STICK", uomId: "uom-stick" };
    const line = frameConfigToLineItem(
      makeConfig(),
      { ...selections, moulding: stickMoulding },
      "uom-1",
      { id: "uom-pcs", code: "PCS" }
    );
    expect(line.uomCode).toBe("PCS");
    expect(line.uomId).toBe("uom-pcs");
  });

  it("falls back to the moulding's unit when no frame unit is supplied", () => {
    const stickMoulding = { ...MOULDING, uom: "STICK", uomId: "uom-stick" };
    const line = frameConfigToLineItem(
      makeConfig(),
      { ...selections, moulding: stickMoulding },
      "uom-1"
    );
    expect(line.uomCode).toBe("STICK");
  });

  it("leaves each component in its own item's unit", () => {
    // Only the line header is counted in frames; the moulding component is still
    // consumed by the stick.
    const stickMoulding = { ...MOULDING, uom: "STICK", uomId: "uom-stick" };
    const line = frameConfigToLineItem(
      makeConfig(),
      { ...selections, moulding: stickMoulding },
      "uom-1",
      { id: "uom-pcs", code: "PCS" }
    );
    const moulding = line.frameComponents.find((c) => c.itemId === MOULDING.id);
    expect(moulding?.uomCode).toBe("STICK");
  });

  it("gives type-chosen components the frame unit, since they have no item option", () => {
    const line = frameConfigToLineItem(
      makeConfig({
        glazing: {
          included: true,
          glazingType: "clear",
          glazingItemId: "glz-clear",
          label: "Clear glass",
          unitRate: 0.35,
          sheets: 1,
          cutToMatOuter: true,
        },
      }),
      { ...selections, glazing: null },
      "uom-1",
      { id: "uom-pcs", code: "PCS" }
    );
    const glass = line.frameComponents.find((c) => c.itemId === "glz-clear");
    expect(glass?.uomCode).toBe("PCS");
  });

  it("itemises hardware as its own component row", () => {
    // The real receipts bill "FLEXIPOINTS 1/1" as its own line, so hardware must
    // reach the persisted breakdown — not just the line total.
    const config = makeConfig();
    const line = frameConfigToLineItem(config, selections, "uom-1");
    const priced = priceLine(config);

    const flexi = line.frameComponents.find((c) => c.itemId === "hw-flexi");
    expect(flexi).toBeDefined();
    expect(flexi?.componentType).toBe("accessory");
    // every priced component now has an item behind it, so none are dropped
    expect(line.frameComponents).toHaveLength(priced.components.length);
  });

  it("still drops a component if its item is genuinely missing", () => {
    // Defensive: item_id is NOT NULL, so a component without one cannot persist.
    const config = makeConfig({
      hardware: {
        flexipoints: {
          included: true,
          fraction: { numerator: 1, denominator: 2 },
          unitRate: 1.5,
          itemId: null,
        },
        multipoints: {
          included: false,
          fraction: { numerator: 1, denominator: 2 },
          unitRate: 8,
          itemId: "hw-multi",
        },
        lSupport: { included: false, size: "small", unitRate: 35, itemId: "hw-lsup" },
      },
    });
    const line = frameConfigToLineItem(config, selections, "uom-1");
    expect(line.frameComponents.every((c) => Boolean(c.itemId))).toBe(true);
    expect(line.frameComponents.some((c) => c.componentType === "accessory")).toBe(false);
  });

  it("bills hardware in the line total", () => {
    const withHardware = makeConfig();
    const withoutHardware = makeConfig({
      hardware: {
        flexipoints: {
          included: false,
          fraction: { numerator: 1, denominator: 2 },
          unitRate: 1.5,
          itemId: "hw-flexi",
        },
        multipoints: {
          included: false,
          fraction: { numerator: 1, denominator: 2 },
          unitRate: 8,
          itemId: "hw-multi",
        },
        lSupport: { included: false, size: "small", unitRate: 35, itemId: "hw-lsup" },
      },
    });
    const a = frameConfigToLineItem(withHardware, selections, "uom-1");
    const b = frameConfigToLineItem(withoutHardware, selections, "uom-1");
    expect(a.lineTotal).toBeGreaterThan(b.lineTotal);
  });
});

describe("frameConfigToLineItem — line fields", () => {
  it("uses the moulding as the header item", () => {
    const line = frameConfigToLineItem(makeConfig(), selections, "uom-1");
    expect(line.itemId).toBe(MOULDING.id);
    expect(line.itemCode).toBe(MOULDING.code);
  });

  it("skips inventory on the header, since stock moves through components", () => {
    expect(frameConfigToLineItem(makeConfig(), selections, "uom-1").skipInventory).toBe(true);
  });

  it("matches the domain module's line total", () => {
    const config = makeConfig({ quantity: 3 });
    expect(frameConfigToLineItem(config, selections, "uom-1").lineTotal).toBe(
      priceLine(config).total
    );
  });

  it("describes the line by finished outside size and spec", () => {
    const line = frameConfigToLineItem(makeConfig(), selections, "uom-1");
    expect(line.description).toContain("23 1/4″ × 20 1/4″");
    expect(line.description).toContain("Single matting");
  });

  it("falls back to the supplied uom when the moulding has none", () => {
    const line = frameConfigToLineItem(
      makeConfig(),
      { ...selections, moulding: { ...MOULDING, uomId: "" } },
      "fallback-uom"
    );
    expect(line.uomId).toBe("fallback-uom");
  });

  it("splits total quantity back into a per-frame figure", () => {
    const line = frameConfigToLineItem(makeConfig({ quantity: 4 }), selections, "uom-1");
    const moulding = line.frameComponents.find((c) => c.itemId === MOULDING.id)!;
    expect(moulding.qtyPerFrame).toBeCloseTo(moulding.totalQuantity / 4, 4);
  });
});

describe("frameSizesToLineItem — several sizes on one line", () => {
  const SERVICE = { id: "svc-cj", code: "SVC-CHOPJOIN", name: "Chop & Join" };
  const sized = (lengthIn: number, widthIn: number) => ({
    config: makeConfig({ enteredLengthIn: lengthIn, enteredWidthIn: widthIn, overlapIn: 0 }),
    selections,
  });

  it("bills the sum of its sizes", () => {
    const sizes = [sized(8, 10), sized(12, 10)];
    const line = frameSizesToLineItem(sizes, "chop_join", SERVICE, "uom-1");
    const separately = sizes.reduce(
      (total, size) =>
        total + frameConfigToLineItem(size.config, size.selections, "uom-1").lineTotal,
      0
    );
    expect(line.lineTotal).toBeCloseTo(separately, 2);
  });

  it("is headed by the reference item, not a moulding", () => {
    // No single moulding can stand for a job whose sizes may differ, and
    // item_id is NOT NULL.
    const line = frameSizesToLineItem([sized(8, 10)], "chop_join", SERVICE, "uom-1");
    expect(line.itemId).toBe("svc-cj");
    expect(line.itemCode).toBe("SVC-CHOPJOIN");
    expect(line.skipInventory).toBe(true);
  });

  it("keeps every size distinct", () => {
    const line = frameSizesToLineItem([sized(8, 10), sized(12, 10)], "chop_join", SERVICE, "uom-1");
    expect(line.frameSizes).toHaveLength(2);
    expect(line.frameSizes?.[0].frameConfiguration.artworkLengthIn).toBe(8);
    expect(line.frameSizes?.[1].frameConfiguration.artworkLengthIn).toBe(12);
  });

  it("carries the first size in the singular fields, so one-config readers still work", () => {
    const line = frameSizesToLineItem([sized(8, 10), sized(12, 10)], "chop_join", SERVICE, "uom-1");
    expect(line.frameConfiguration.artworkLengthIn).toBe(8);
    expect(line.frameComponents.length).toBeGreaterThan(0);
  });

  it("names every finished outside size in the description", () => {
    const line = frameSizesToLineItem([sized(8, 10), sized(12, 10)], "chop_join", SERVICE, "uom-1");
    expect(line.description).toContain("16 1/2″ × 18 1/2″");
    expect(line.description).toContain("20 1/2″ × 18 1/2″");
  });

  it("counts frames across all sizes", () => {
    const sizes = [
      { config: makeConfig({ enteredLengthIn: 8, enteredWidthIn: 10, quantity: 2 }), selections },
      { config: makeConfig({ enteredLengthIn: 12, enteredWidthIn: 10, quantity: 3 }), selections },
    ];
    expect(frameSizesToLineItem(sizes, "chop_join", SERVICE, "uom-1").quantity).toBe(5);
  });

  it("refuses a line with no sizes", () => {
    expect(() => frameSizesToLineItem([], "chop_join", SERVICE, "uom-1")).toThrow();
  });
});

describe("frameConfigToLineItem — attachments", () => {
  const withFiles = () =>
    makeConfig({
      attachments: [
        {
          storagePath: "co-1/sketch.pdf",
          fileName: "frame-sketch.pdf",
          mimeType: "application/pdf",
          fileSizeBytes: 220_000,
        },
      ],
    });

  it("carries the file through to the persisted configuration", () => {
    const line = frameConfigToLineItem(withFiles(), selections, "uom-1");
    expect(line.frameConfiguration.attachments).toHaveLength(1);
    expect(line.frameConfiguration.attachments?.[0].storagePath).toBe("co-1/sketch.pdf");
  });

  it("never bills an attachment", () => {
    // A reference file is not a material. If one ever reached `components` it
    // would both charge the customer and print on the requisition as a cut.
    const bare = frameConfigToLineItem(makeConfig(), selections, "uom-1");
    const attached = frameConfigToLineItem(withFiles(), selections, "uom-1");

    expect(attached.lineTotal).toBe(bare.lineTotal);
    expect(attached.frameComponents).toHaveLength(bare.frameComponents.length);
    expect(
      attached.frameComponents.some((component) => component.description?.includes("sketch"))
    ).toBe(false);
  });

  it("stores no URL, only the path", () => {
    // Signed URLs expire; persisting one would leave a dead link in the record.
    const line = frameConfigToLineItem(withFiles(), selections, "uom-1");
    const serialised = JSON.stringify(line.frameConfiguration.attachments);
    expect(serialised).not.toMatch(/https?:\/\//);
  });
});

describe("frameConfigToLineItem — components bill in cuts", () => {
  const CUT = { id: "uom-cut", code: "CUT" };
  const PCS = { id: "uom-pcs", code: "PCS" };
  const SERVICE = { id: "svc-cj", code: "SVC-CHOPJOIN", name: "Chop & Join" };

  it("gives every component the cut unit", () => {
    // The moulding is stocked in STICK and a board in SHEET, but a frame
    // consumes a length cut from one and a piece cut from the other.
    const line = frameConfigToLineItem(makeConfig(), selections, "uom-1", PCS, CUT);
    expect(line.frameComponents.length).toBeGreaterThan(0);
    line.frameComponents.forEach((component) => {
      expect(component.uomCode).toBe("CUT");
      expect(component.uomId).toBe("uom-cut");
    });
  });

  it("leaves the line header in frames", () => {
    // The line's quantity counts finished frames, not cuts.
    const line = frameConfigToLineItem(makeConfig(), selections, "uom-1", PCS, CUT);
    expect(line.uomCode).toBe("PCS");
    expect(line.uomId).toBe("uom-pcs");
  });

  it("falls back to the item's own unit when no cut unit is supplied", () => {
    // An older caller must not break; it keeps the previous behaviour.
    const line = frameConfigToLineItem(makeConfig(), selections, "uom-1", PCS);
    const moulding = line.frameComponents.find((c) => c.itemId === MOULDING.id);
    expect(moulding?.uomCode).toBe(MOULDING.uom);
  });

  it("applies to every size on a multi-size line", () => {
    const line = frameSizesToLineItem(
      [
        { config: makeConfig(), selections },
        { config: makeConfig({ enteredLengthIn: 20 }), selections },
      ],
      "chop_join",
      SERVICE,
      "uom-1",
      PCS,
      CUT
    );
    line.frameSizes?.forEach((size) => {
      size.frameComponents.forEach((component) => {
        expect(component.uomCode).toBe("CUT");
      });
    });
  });
});

describe("a fixed discount on the whole job", () => {
  const SERVICE = { id: "svc-cj", code: "SVC-CHOPJOIN", name: "Chop & Join" };
  const sized = (lengthIn: number, widthIn: number) => ({
    config: makeConfig({ enteredLengthIn: lengthIn, enteredWidthIn: widthIn, overlapIn: 0 }),
    selections,
  });

  const build = (discount: number, sizes = [sized(8, 10), sized(12, 10)]) =>
    frameSizesToLineItem(sizes, "chop_join", SERVICE, "uom-1", undefined, undefined, discount);

  it("takes the discount off the line total", () => {
    const gross = build(0).lineTotal;
    const discounted = build(200);
    expect(discounted.lineTotal).toBeCloseTo(gross - 200, 2);
    expect(discounted.discountAmount).toBe(200);
  });

  it("applies once to the job, not per size", () => {
    // Two sizes, one 200 discount — not 200 off each.
    const gross = build(0).lineTotal;
    expect(build(200).lineTotal).toBeCloseTo(gross - 200, 2);
  });

  it("leaves the unit price undiscounted, so the deduction stays visible", () => {
    expect(build(200).unitPrice).toBe(build(0).unitPrice);
  });

  it("stays fixed when the frame count changes", () => {
    // The whole reason this is an amount and not a rate: a percentage that
    // takes 200 off one frame takes more off three.
    const one = build(200, [sized(8, 10)]);
    const three = build(200, [sized(8, 10), sized(12, 10), sized(9, 11)]);
    expect(one.discountAmount).toBe(200);
    expect(three.discountAmount).toBe(200);
  });

  it("never credits more than the job is worth", () => {
    const gross = build(0).lineTotal;
    const absurd = build(gross + 5000);
    expect(absurd.lineTotal).toBe(0);
    expect(absurd.discountAmount).toBeCloseTo(gross, 2);
  });

  it("ignores a negative discount", () => {
    expect(build(-50).lineTotal).toBeCloseTo(build(0).lineTotal, 2);
  });

  it("leaves the percentage discount at zero", () => {
    // The two must not both apply — the RPC prefers the amount.
    expect(build(200).discount).toBe(0);
  });
});
