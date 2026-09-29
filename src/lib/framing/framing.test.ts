import { describe, expect, it } from "vitest";

import { specSummary } from "./description";
import {
  areaSqIn,
  CUT_CLEARANCE_IN,
  glazingCutSize,
  matOpenings,
  mouldingFootage,
  resolveArtworkSize,
  resolveGeometry } from "./geometry";
import { priceLine, unitPrice } from "./pricing";
import {
  matFitsSheet,
  matStackFitsBorder,
  maxMatsForBorder,
  validateConfiguration,
  validateMatting,
} from "./validation";
import type { FrameConfiguration, MatBoardSheet, MatLayer } from "./types";

const MAT_BOARD_ID = "mat-em-1019";
const BIG_BOARD_ID = "mat-big";

const matBoards = new Map<string, MatBoardSheet>([
  [
    MAT_BOARD_ID,
    { itemId: MAT_BOARD_ID, label: "EM 1019 Cream White", sheetLengthIn: 30, sheetWidthIn: 42 },
  ],
  [BIG_BOARD_ID, { itemId: BIG_BOARD_ID, label: "Oversize board", sheetLengthIn: 60, sheetWidthIn: 80 }],
]);

const layer = (overrides: Partial<MatLayer> = {}): MatLayer => ({
  layerIndex: 0,
  matBoardItemId: MAT_BOARD_ID,
  ...overrides });

function makeConfig(overrides: Partial<FrameConfiguration> = {}): FrameConfiguration {
  return {
    billingMode: "chop_join",
    quantity: 1,
    sizeMode: "artwork",
    enteredLengthIn: 15,
    enteredWidthIn: 12,
    frameWidthIn: 2.25,
    frameRate: 0,
    overlapIn: 0.125,
    moulding: {
      itemId: "moulding-1574",
      code: "1574-36B-BLK",
      name: "1574-36B Blk Polystyrene Picture Frame Mouldings",
      unitRate: 6.19,
      material: "polystyrene" },
    mat: { included: true, source: "store",
      border: { lengthIn: 2, widthIn: 2 },
        unitRate: 2.5, layers: [layer()] },
    glazing: {
      included: true,
      glazingType: "clear",
      glazingItemId: "glass-clear",
      label: "Clear glass",
      unitRate: 0.35,
      sheets: 1,
      cutToMatOuter: true },
    backing: { backingType: "mdf", backingItemId: "back-ply", label: "Plywood ⅛″", unitRate: 0.16 },
    hardware: {
      flexipoints: { included: true, fraction: { numerator: 1, denominator: 2 }, unitRate: 1.5, itemId: "hw-flexi" },
      multipoints: { included: false, fraction: { numerator: 1, denominator: 2 }, unitRate: 8, itemId: "hw-multi" },
      lSupport: { included: false, size: "small", unitRate: 35, itemId: "hw-lsup" } },
    attachments: [],
    ...overrides };
}

describe("geometry — no mat", () => {
  it("uses the artwork as the sight size and skips the mat steps", () => {
    const config = makeConfig({ mat: { included: false, source: "store",
      border: { lengthIn: 2, widthIn: 2 },
        unitRate: 2.5, layers: [] } });
    const geometry = resolveGeometry(config);

    expect(geometry.artwork).toEqual({ lengthIn: 15, widthIn: 12 });
    expect(geometry.openings).toEqual([]);
    expect(geometry.matOuter).toBeNull();
    expect(geometry.sight).toEqual({ lengthIn: 15, widthIn: 12 });
    // outside = artwork + 2 × frame width
    expect(geometry.outside).toEqual({ lengthIn: 19.5, widthIn: 16.5 });
  });
});

describe("geometry — single mat", () => {
  it("walks artwork → opening → mat outer → outside", () => {
    const geometry = resolveGeometry(makeConfig());

    // opening = artwork − 2 × overlap
    expect(geometry.openings).toHaveLength(1);
    expect(geometry.openings[0]).toEqual({ lengthIn: 14.75, widthIn: 11.75 });
    // mat outer = opening + 2 × border
    expect(geometry.matOuter).toEqual({ lengthIn: 18.75, widthIn: 15.75 });
    // the frame surrounds the mat, not the artwork
    expect(geometry.sight).toEqual(geometry.matOuter);
    // outside = mat outer + 2 × frame width
    expect(geometry.outside).toEqual({ lengthIn: 23.25, widthIn: 20.25 });
  });
});

describe("geometry — the border belongs to the stack, reveals come from within it", () => {
  const layers: MatLayer[] = [
    layer({ layerIndex: 0 }),
    layer({ layerIndex: 1 }),
    layer({ layerIndex: 2 }),
  ];
  const border = { lengthIn: 2.5, widthIn: 2 };

  it("steps each layer above out by one fixed reveal", () => {
    const config = makeConfig({
      mat: { included: true, source: "store", border,
        unitRate: 2.5, layers },
      enteredLengthIn: 20,
      enteredWidthIn: 16 });
    const geometry = resolveGeometry(config);

    // bottom layer opening = artwork − 2 × overlap
    expect(geometry.openings[2]).toEqual({ lengthIn: 19.75, widthIn: 15.75 });
    // each mat above steps out by 2 × the fixed reveal, both axes alike
    expect(geometry.openings[1]).toEqual({ lengthIn: 20.25, widthIn: 16.25 });
    expect(geometry.openings[0]).toEqual({ lengthIn: 20.75, widthIn: 16.75 });
    // mat outer = artwork + 2 × border, per axis — untouched by the reveals
    expect(geometry.matOuter).toEqual({ lengthIn: 24.75, widthIn: 19.75 });
  });

  it("does not grow the mat when another layer is added", () => {
    // The whole point of the change: stacking mats subdivides the border, so
    // the frame the customer receives is the same size either way.
    const one = resolveGeometry(
      makeConfig({
        mat: { included: true, source: "store", border,
        unitRate: 2.5, layers: [layer({ layerIndex: 0 })] },
        enteredLengthIn: 21,
        enteredWidthIn: 16 })
    );
    const three = resolveGeometry(
      makeConfig({
        mat: { included: true, source: "store", border,
        unitRate: 2.5, layers },
        enteredLengthIn: 21,
        enteredWidthIn: 16 })
    );
    expect(three.matOuter).toEqual(one.matOuter);
  });

  it("cuts the shop's own example at 25 x 20", () => {
    // Artwork 21 × 16 with a 2" border and a second mat: the old model added
    // the 1/4" reveal outside the border and cut 25 1/2 × 20 1/2.
    const geometry = resolveGeometry(
      makeConfig({
        overlapIn: 0,
        enteredLengthIn: 21,
        enteredWidthIn: 16,
        mat: {
          included: true,
          source: "store",
          border: { lengthIn: 2, widthIn: 2 },
        unitRate: 2.5,
          layers: [layer({ layerIndex: 0 }), layer({ layerIndex: 1 })] } })
    );
    expect(geometry.matOuter).toEqual({ lengthIn: 25, widthIn: 20 });
  });

  it("keeps L and W independent when the border is weighted", () => {
    const geometry = resolveGeometry(
      makeConfig({ mat: { included: true, source: "store", border,
        unitRate: 2.5, layers } })
    );
    const outer = geometry.matOuter;
    expect(outer).not.toBeNull();
    // a symmetric result here would mean an axis was being reused for both
    expect(outer!.lengthIn).not.toEqual(outer!.widthIn);
  });

  it("returns one opening per layer, index-aligned", () => {
    const geometry = resolveGeometry(
      makeConfig({ mat: { included: true, source: "store", border,
        unitRate: 2.5, layers } })
    );
    expect(geometry.openings).toHaveLength(3);
  });
});

describe("geometry — size mode", () => {
  it("derives the artwork by removing the frame when entering the outside size", () => {
    const config = makeConfig({
      sizeMode: "outside",
      enteredLengthIn: 23.25,
      enteredWidthIn: 20.25 });
    expect(resolveArtworkSize(config)).toEqual({ lengthIn: 18.75, widthIn: 15.75 });
  });

  it("round-trips artwork → outside → artwork without drift", () => {
    const noMat = {
      included: false as const,
      source: "store" as const,
      border: { lengthIn: 2, widthIn: 2 },
        unitRate: 2.5,
      layers: [],
    };
    const artworkMode = makeConfig({ mat: noMat });
    const outside = resolveGeometry(artworkMode).outside;

    const outsideMode = makeConfig({
      mat: noMat,
      sizeMode: "outside",
      enteredLengthIn: outside.lengthIn,
      enteredWidthIn: outside.widthIn });

    expect(resolveGeometry(outsideMode).artwork).toEqual({ lengthIn: 15, widthIn: 12 });
  });
});

describe("geometry — helpers", () => {
  it("adds a 10% waste allowance to the moulding footage", () => {
    // perimeter 2 × (23.25 + 20.25) = 87in → 7.25ft → × 1.1
    expect(mouldingFootage({ lengthIn: 23.25, widthIn: 20.25 })).toBeCloseTo(7.975, 3);
  });

  it("cuts glazing fractionally under the mat outer so it seats in the rabbet", () => {
    const config = makeConfig();
    const geometry = resolveGeometry(config);
    const cut = glazingCutSize(config, geometry);

    expect(cut.lengthIn).toBeCloseTo(geometry.matOuter!.lengthIn - CUT_CLEARANCE_IN, 3);
    expect(cut.widthIn).toBeCloseTo(geometry.matOuter!.widthIn - CUT_CLEARANCE_IN, 3);
  });

  it("cuts glazing to the artwork when not following the mat outer", () => {
    const config = makeConfig({
      glazing: { ...makeConfig().glazing, cutToMatOuter: false } });
    const geometry = resolveGeometry(config);
    const cut = glazingCutSize(config, geometry);

    expect(cut.lengthIn).toBeCloseTo(geometry.sight.lengthIn - CUT_CLEARANCE_IN, 3);
  });

  it("returns no openings when there are no layers", () => {
    expect(matOpenings({ lengthIn: 10, widthIn: 8 }, [], 0.125)).toEqual([]);
  });
});

describe("validation — sheet overflow boundary", () => {
  // artwork 40×34 → opening 39.75×33.75 → outer 45.75×39.75, against a 30×42 sheet.
  // Rotated, that needs 39.75 on the 30″ side, so it genuinely cannot be cut.
  const oversized = () =>
    makeConfig({
      enteredLengthIn: 40,
      enteredWidthIn: 34,
      mat: {
        included: true,
        source: "store",
        border: { lengthIn: 3, widthIn: 3 },
        unitRate: 2.5,
        layers: [layer({})],
      },
    });

  it("warns when the mat outer exceeds the sheet on both orientations", () => {
    const warning = matFitsSheet(oversized(), matBoards);
    expect(warning).toContain("too small");
    expect(warning).toContain("45.75");
  });

  it("allows a mat that only fits when the sheet is rotated", () => {
    // 33.75 × 25.75 exceeds 30 on its long side but fits within 42 — rotation is legal
    const config = makeConfig({
      enteredLengthIn: 28,
      enteredWidthIn: 20,
      mat: {
        included: true,
        source: "store",
        border: { lengthIn: 3, widthIn: 3 },
        unitRate: 2.5,
        layers: [layer({})],
      },
    });
    expect(resolveGeometry(config).matOuter).toEqual({ lengthIn: 33.75, widthIn: 25.75 });
    expect(matFitsSheet(config, matBoards)).toBeNull();
  });

  it("passes an oversized mat when cut from a larger sheet", () => {
    const config = oversized();
    config.mat.layers = [
      layer({ matBoardItemId: BIG_BOARD_ID }),
    ];
    expect(matFitsSheet(config, matBoards)).toBeNull();
  });

  it("returns null when matting is off", () => {
    const config = makeConfig({ mat: { included: false, source: "store",
      border: { lengthIn: 2, widthIn: 2 },
        unitRate: 2.5, layers: [] } });
    expect(matFitsSheet(config, matBoards)).toBeNull();
  });

  it("fits exactly at the boundary", () => {
    // artwork sized so the mat outer lands exactly on 30 × 42
    const config = makeConfig({
      enteredLengthIn: 26.25,
      enteredWidthIn: 38.25,
      mat: { included: true, source: "store",
      border: { lengthIn: 2, widthIn: 2 },
        unitRate: 2.5, layers: [layer()] } });
    const geometry = resolveGeometry(config);
    expect(geometry.matOuter).toEqual({ lengthIn: 30, widthIn: 42 });
    expect(matFitsSheet(config, matBoards)).toBeNull();
  });
});

describe("validation — hard errors", () => {
  it("accepts a well-formed configuration", () => {
    expect(validateConfiguration(makeConfig())).toEqual([]);
  });

  it("rejects a frame wider than the outside size allows", () => {
    const config = makeConfig({
      sizeMode: "outside",
      enteredLengthIn: 4,
      enteredWidthIn: 4,
      frameWidthIn: 3,
      mat: { included: false, source: "store",
      border: { lengthIn: 2, widthIn: 2 },
        unitRate: 2.5, layers: [] } });
    expect(validateConfiguration(config).join(" ")).toContain("wider than the outside size");
  });

  it("rejects borders that consume the whole opening", () => {
    const config = makeConfig({
      enteredLengthIn: 4,
      enteredWidthIn: 4,
      mat: { included: true, source: "store",
      border: { lengthIn: 2, widthIn: 2 },
        unitRate: 2.5, layers: [layer(), layer({ layerIndex: 1 })] } });
    // bottom opening 3.75 − but the layer above widens it, so check the smallest
    const errors = validateConfiguration({ ...config, enteredLengthIn: 0.2, enteredWidthIn: 0.2 });
    expect(errors.length).toBeGreaterThan(0);
  });

  it("rejects duplicate layer positions", () => {
    const config = makeConfig({
      mat: {
        included: true,
        source: "store",
      border: { lengthIn: 2, widthIn: 2 },
        unitRate: 2.5,
        layers: [layer({ layerIndex: 0 }), layer({ layerIndex: 0 })] } });
    expect(validateConfiguration(config).join(" ")).toContain("distinct position");
  });

  it("rejects matting turned on with no layers", () => {
    const config = makeConfig({ mat: { included: true, source: "store",
      border: { lengthIn: 2, widthIn: 2 },
        unitRate: 2.5, layers: [] } });
    expect(validateConfiguration(config).join(" ")).toContain("at least one mat layer");
  });
});

describe("pricing — billing modes", () => {
  it("produces one billed row per component for chop & join", () => {
    const pricing = priceLine(makeConfig({ billingMode: "chop_join" }));
    // moulding + mat + glazing + backing + flexipoints
    expect(pricing.components).toHaveLength(5);
    expect(pricing.billedLineCount).toBe(5);
  });

  it("produces exactly one priced row for framing", () => {
    // Not a collapsed view of five parts: framing bills one figure, so there is
    // one component and the parts carry no money at all.
    const pricing = priceLine(makeConfig({ billingMode: "framing", frameRate: 50 }));
    expect(pricing.components).toHaveLength(1);
    expect(pricing.components[0].kind).toBe("frame");
    expect(pricing.billedLineCount).toBe(1);
  });

  it("ignores the component rates entirely in framing", () => {
    // Doubling every part's rate must not move a framing total — the frame rate
    // is the whole charge.
    const base = makeConfig({ billingMode: "framing", frameRate: 50 });
    const dearer = makeConfig({
      billingMode: "framing",
      frameRate: 50,
      glazing: { ...base.glazing, unitRate: base.glazing.unitRate * 2 },
      backing: { ...base.backing, unitRate: base.backing.unitRate * 2 },
      moulding: { ...base.moulding, unitRate: base.moulding.unitRate * 2 },
    });
    expect(priceLine(dearer).total).toBe(priceLine(base).total);
  });

  it("does not total the same as chop & join — they bill different things", () => {
    const chop = priceLine(makeConfig({ billingMode: "chop_join" }));
    const framing = priceLine(makeConfig({ billingMode: "framing", frameRate: 50 }));
    expect(framing.total).not.toBeCloseTo(chop.total, 2);
  });
});

describe("framing bills one figure for the whole frame", () => {
  const framed = (over: Partial<FrameConfiguration> = {}) =>
    makeConfig({ billingMode: "framing", frameRate: 50, ...over });

  const total = (config: FrameConfiguration) => priceLine(config).total;

  it("prices the shop's example — 21 x 16 polystyrene at 50 is 1850", () => {
    // (21 + 16) x 50, on the size the frame surrounds.
    const config = framed({
      enteredLengthIn: 21,
      enteredWidthIn: 16,
      overlapIn: 0,
      mat: { included: false, source: "store", border: { lengthIn: 2, widthIn: 2 },
        unitRate: 2.5, layers: [] },
      moulding: { ...makeConfig().moulding, material: "polystyrene" },
    });
    expect(total(config)).toBe(1850);
  });

  it("prices on the mat outer when a mat is present", () => {
    // A 2" border makes it (25 + 20) x 50 — the frame surrounds the mat.
    const config = framed({
      enteredLengthIn: 21,
      enteredWidthIn: 16,
      overlapIn: 0,
      mat: {
        included: true,
        source: "store",
        border: { lengthIn: 2, widthIn: 2 },
        unitRate: 2.5,
        layers: [layer({ layerIndex: 0 })],
      },
      moulding: { ...makeConfig().moulding, material: "polystyrene" },
    });
    expect(total(config)).toBe(2250);
  });

  it("uses the wood formula, which alone includes the frame width", () => {
    // (21 + 16 + 1.5) / 3 x 50
    const config = framed({
      enteredLengthIn: 21,
      enteredWidthIn: 16,
      frameWidthIn: 1.5,
      overlapIn: 0,
      mat: { included: false, source: "store", border: { lengthIn: 2, widthIn: 2 },
        unitRate: 2.5, layers: [] },
      moulding: { ...makeConfig().moulding, material: "wood" },
    });
    expect(total(config)).toBeCloseTo(641.67, 2);
  });

  it("leaves polystyrene untouched by the frame width", () => {
    const withoutWidth = framed({
      enteredLengthIn: 21,
      enteredWidthIn: 16,
      frameWidthIn: 0,
      overlapIn: 0,
      mat: { included: false, source: "store", border: { lengthIn: 2, widthIn: 2 },
        unitRate: 2.5, layers: [] },
      moulding: { ...makeConfig().moulding, material: "polystyrene" },
    });
    const withWidth = framed({
      ...withoutWidth,
      frameWidthIn: 3,
    });
    expect(total(withWidth)).toBe(total(withoutWidth));
  });

  it("multiplies by the frame quantity", () => {
    const config = framed({
      enteredLengthIn: 21,
      enteredWidthIn: 16,
      overlapIn: 0,
      quantity: 3,
      mat: { included: false, source: "store", border: { lengthIn: 2, widthIn: 2 },
        unitRate: 2.5, layers: [] },
      moulding: { ...makeConfig().moulding, material: "polystyrene" },
    });
    expect(total(config)).toBe(5550);
  });

  it("refuses to save a framing line with no rate", () => {
    // Zero would price the frame at nothing and look deliberate.
    const errors = validateConfiguration(framed({ frameRate: 0 }));
    expect(errors.some((error) => /frame rate/i.test(error))).toBe(true);
  });
});

describe("pricing — components", () => {
  it("scales every component by the frame quantity", () => {
    const single = priceLine(makeConfig({ quantity: 1 }));
    const triple = priceLine(makeConfig({ quantity: 3 }));

    // Each component scales exactly; the line total may differ from single × 3
    // by a rounding cent because component amounts are rounded for billing.
    // Within a cent per component: each amount is rounded once for billing, so
    // computing at 3× is not bit-identical to rounding at 1× and multiplying.
    single.components.forEach((component, index) => {
      expect(triple.components[index].amount).toBeCloseTo(component.amount * 3, 1);
    });
    expect(triple.total).toBeCloseTo(single.total * 3, 1);
  });

  it("keeps the per-frame unit price stable as quantity rises", () => {
    // Within a cent — see the note on unitPrice about display rounding.
    expect(unitPrice(makeConfig({ quantity: 4 }))).toBeCloseTo(
      unitPrice(makeConfig({ quantity: 1 })),
      1
    );
  });

  it("keeps the line total equal to the sum of its printed component amounts", () => {
    // A chop & join invoice prints every component and then the total; if these
    // disagree the customer sees rows that do not add up.
    const pricing = priceLine(makeConfig({ quantity: 3 }));
    const summed = pricing.components.reduce((sum, component) => sum + component.amount, 0);
    expect(pricing.total).toBeCloseTo(summed, 2);
  });

  it("prices a mat the same whoever supplied the board", () => {
    // The Store / Customer toggle records who brought the board for the
    // workshop; it does not change the charge.
    const mat = (source: "store" | "customer") =>
      priceLine(
        makeConfig({
          mat: {
            included: true,
            source,
            border: { lengthIn: 2, widthIn: 2 },
        unitRate: 2.5,
            layers: [layer()],
          },
        })
      ).components.find(
        (component) => component.kind === "mat"
      )!;
    expect(mat("customer").amount).toBeCloseTo(mat("store").amount, 2);
  });

  it("bills a mat as (L + W) × rate, like the moulding", () => {
    // 8 × 10 artwork with a 2″ border → mat cut 12 × 14, so (12 + 14) × 2.50.
    const config = makeConfig({
      enteredLengthIn: 8,
      enteredWidthIn: 10,
      overlapIn: 0,
      mat: {
        included: true,
        source: "store",
      border: { lengthIn: 2, widthIn: 2 },
        unitRate: 2.5,
        layers: [layer({ })] } });
    const mat = priceLine(config).components.find((component) => component.kind === "mat")!;
    expect(mat.amount).toBe(65);
  });

  it("adds one component per mat layer", () => {
    const pricing = priceLine(
      makeConfig({
        mat: {
          included: true,
          source: "store",
      border: { lengthIn: 2, widthIn: 2 },
        unitRate: 2.5,
          layers: [layer({ layerIndex: 0 }), layer({ layerIndex: 1 }), layer({ layerIndex: 2 })] } })
    );
    expect(pricing.components.filter((c) => c.kind === "mat")).toHaveLength(3);
  });

  it("omits components that are switched off", () => {
    const pricing = priceLine(
      makeConfig({
        mat: { included: false, source: "store",
      border: { lengthIn: 2, widthIn: 2 },
        unitRate: 2.5, layers: [] },
        glazing: { ...makeConfig().glazing, included: false },
        backing: { backingType: null, backingItemId: null, label: "", unitRate: 0 },
        hardware: {
          flexipoints: { included: false, fraction: { numerator: 1, denominator: 2 }, unitRate: 1.5, itemId: "hw-flexi" },
          multipoints: { included: false, fraction: { numerator: 1, denominator: 2 }, unitRate: 8, itemId: "hw-multi" },
          lSupport: { included: false, size: "small", unitRate: 35, itemId: "hw-lsup" } } })
    );
    expect(pricing.components).toHaveLength(1);
    expect(pricing.components[0].kind).toBe("moulding");
  });

  it("labels each component's rate source so the UI can explain the number", () => {
    const pricing = priceLine(makeConfig());
    const byKind = Object.fromEntries(pricing.components.map((c) => [c.kind, c.rateSource]));
    expect(byKind.moulding).toBe("tier");
    expect(byKind.mat).toBe("entered");
    expect(byKind.glazing).toBe("entered");
    expect(byKind.flexipoints).toBe("fixed");
  });

  it("multiplies glazing by the sheet count", () => {
    const one = priceLine(makeConfig()).components.find((c) => c.kind === "glazing")!;
    const two = priceLine(
      makeConfig({ glazing: { ...makeConfig().glazing, sheets: 2 } })
    ).components.find((c) => c.kind === "glazing")!;
    // Within a cent — the single-sheet amount is itself rounded for billing.
    expect(two.amount).toBeCloseTo(one.amount * 2, 1);
  });
});

describe("description", () => {

  it("summarises the configuration in one line", () => {
    expect(specSummary(makeConfig())).toBe(
      "1574-36B-BLK · Single matting · Clear glass · Plywood ⅛″ · flexi 1/2"
    );
  });

  it("leads with the moulding, the one part every frame has", () => {
    // A moulding-only frame still bills — summarising it as "no components"
    // contradicted the priced requisition rendered next to it.
    const mouldingOnly = makeConfig({
      mat: { included: false, source: "store",
      border: { lengthIn: 2, widthIn: 2 },
        unitRate: 2.5, layers: [] },
      glazing: { ...makeConfig().glazing, included: false },
      backing: { backingType: null, backingItemId: null, label: "", unitRate: 0 },
      hardware: {
        flexipoints: { included: false, fraction: { numerator: 1, denominator: 2 }, unitRate: 1.5, itemId: "hw-flexi" },
        multipoints: { included: false, fraction: { numerator: 1, denominator: 2 }, unitRate: 8, itemId: "hw-multi" },
        lSupport: { included: false, size: "small", unitRate: 35, itemId: "hw-lsup" } } });
    expect(specSummary(mouldingOnly)).toBe("1574-36B-BLK");
  });

  it("says so when nothing is configured", () => {
    const bare = makeConfig({
      moulding: { itemId: "", code: "", name: "", unitRate: 0, material: "polystyrene" },
      mat: { included: false, source: "store",
      border: { lengthIn: 2, widthIn: 2 },
        unitRate: 2.5, layers: [] },
      glazing: { ...makeConfig().glazing, included: false },
      backing: { backingType: null, backingItemId: null, label: "", unitRate: 0 },
      hardware: {
        flexipoints: { included: false, fraction: { numerator: 1, denominator: 2 }, unitRate: 1.5, itemId: "hw-flexi" },
        multipoints: { included: false, fraction: { numerator: 1, denominator: 2 }, unitRate: 8, itemId: "hw-multi" },
        lSupport: { included: false, size: "small", unitRate: 35, itemId: "hw-lsup" } } });
    expect(specSummary(bare)).toBe("No components");
  });
});

describe("area helper", () => {
  it("computes square inches", () => {
    expect(areaSqIn({ lengthIn: 10, widthIn: 8 })).toBe(80);
  });
});

describe("mat opening — the border is added to the artwork", () => {
  const withOverlap = (overlapIn: number) =>
    resolveGeometry(
      makeConfig({
        enteredLengthIn: 8,
        enteredWidthIn: 10,
        overlapIn,
        mat: {
          included: true,
          source: "store",
      border: { lengthIn: 2, widthIn: 2 },
        unitRate: 2.5,
          layers: [layer({ })] } })
    );

  it("cuts the opening to the artwork when no overlap is asked for", () => {
    // The shop sizes the opening to the artwork; deducting an eighth unasked
    // produced an 11 3/4 x 13 3/4 mat where 12 x 14 was expected.
    const geometry = withOverlap(0);
    expect(geometry.openings[0].lengthIn).toBe(8);
    expect(geometry.openings[0].widthIn).toBe(10);
  });

  it("adds the border to each edge, so 2 inches adds four", () => {
    const geometry = withOverlap(0);
    expect(geometry.matOuter?.lengthIn).toBe(12);
    expect(geometry.matOuter?.widthIn).toBe(14);
  });

  it("still honours an overlap when a line asks for one", () => {
    // The technique remains available where the artwork must not fall through.
    const geometry = withOverlap(0.125);
    expect(geometry.openings[0].lengthIn).toBe(7.75);
    expect(geometry.matOuter?.lengthIn).toBe(11.75);
  });
});

describe("moulding pricing follows the shop's formulas", () => {
  const priced = (config: FrameConfiguration) =>
    priceLine(config).components.find((component) => component.kind === "moulding")!;

  // 8 × 10 artwork with a 2″ border → mat cut 12 × 14, so L + W = 26.
  const withMoulding = (
    material: "polystyrene" | "wood" | null,
    billingMode: "chop_join" | "framing",
    unitRate: number
  ) =>
    makeConfig({
      billingMode,
      enteredLengthIn: 8,
      enteredWidthIn: 10,
      frameWidthIn: 2.25,
      overlapIn: 0,
      moulding: { itemId: "m", code: "057-02Q", name: "WHITE", unitRate, material },
      mat: {
        included: true,
        source: "store",
      border: { lengthIn: 2, widthIn: 2 },
        unitRate: 2.5,
        layers: [layer({ })] } });

  it("bills polystyrene as (L + W) × rate on the mat cut size", () => {
    // Framing has no moulding row at all now — the whole frame is one charge —
    // so these formulas live on the chop & join component.
    expect(priced(withMoulding("polystyrene", "chop_join", 1.98)).amount).toBe(51.48);
  });

  it("bills wood as (L + W + FW) / 3 × rate", () => {
    // (26 + 2.25) / 3 × 26 = 244.83, before the chop & join factor.
    const framingEquivalent = priceLine(
      makeConfig({
        billingMode: "framing",
        frameRate: 26,
        enteredLengthIn: 8,
        enteredWidthIn: 10,
        frameWidthIn: 2.25,
        overlapIn: 0,
        moulding: { itemId: "m", code: "057-02Q", name: "WHITE", unitRate: 26, material: "wood" },
        mat: {
          included: true,
          source: "store",
          border: { lengthIn: 2, widthIn: 2 },
        unitRate: 2.5,
          layers: [layer({})],
        },
      })
    ).total;
    expect(framingEquivalent).toBeCloseTo(244.83, 2);
  });

  it("takes 20% of the wood charge for chop & join", () => {
    expect(priced(withMoulding("wood", "chop_join", 26)).amount).toBeCloseTo(48.97, 2);
  });

  it("prices on the mat cut, not the finished outside size", () => {
    // The outside is 16.5 × 18.5 here; billing that would give 35 × rate.
    const component = priced(withMoulding("polystyrene", "chop_join", 1.98));
    expect(component.cutSize).toEqual({ lengthIn: 12, widthIn: 14 });
  });

  it("applies no waste multiplier — the rate already includes it", () => {
    // The old implementation multiplied footage by 1.1; 26 × 1.98 must be exact.
    expect(priced(withMoulding("polystyrene", "chop_join", 1.98)).amount).toBe(
      Math.round(26 * 1.98 * 100) / 100
    );
  });

  it("refuses to apply a line whose moulding has no material", () => {
    const errors = validateConfiguration(withMoulding(null, "chop_join", 1.98));
    expect(errors.some((error) => error.includes("material"))).toBe(true);
  });
});

describe("backing thickness", () => {
  const plywood = (thicknessIn?: number) =>
    makeConfig({
      backing: {
        backingType: "plywood",
        backingItemId: "bck-ply",
        label: "Plywood",
        unitRate: 0.16,
        thicknessIn } });

  it("does not change the price", () => {
    // Thickness is a specification, not a multiplier — the rate entered beside
    // it already reflects the board chosen. Multiplying would double-count it.
    expect(priceLine(plywood(0.125)).total).toBe(priceLine(plywood()).total);
    expect(priceLine(plywood(0.5)).total).toBe(priceLine(plywood()).total);
  });

  it("prints on the backing label so the workshop pulls the right sheet", () => {
    const component = priceLine(plywood(0.125)).components.find((c) => c.kind === "backing");
    expect(component?.label).toContain("Plywood 1/8″");
  });

  it("prints nothing extra when no thickness was given", () => {
    const component = priceLine(plywood()).components.find((c) => c.kind === "backing");
    expect(component?.label).toContain("Plywood");
    expect(component?.label).not.toMatch(/Plywood\s+\d/);
  });

  it("is ignored for boards that come in one thickness", () => {
    // Only plywood is stocked in several; a stray value on MDF must not print.
    const mdf = makeConfig({
      backing: { backingType: "mdf", backingItemId: "b", label: "MDF", unitRate: 0.16, thicknessIn: 0.5 } });
    const component = priceLine(mdf).components.find((c) => c.kind === "backing");
    expect(component?.label).not.toContain("1/2");
  });
});

describe("validation — material must be chosen", () => {
  it("does not price a mat until its board and border are selected", () => {
    const withoutBoard = makeConfig({
      mat: {
        included: true,
        source: "store",
        border: { lengthIn: 2, widthIn: 2 },
        unitRate: 2.5,
        layers: [layer({ matBoardItemId: "" })],
      },
    });
    const withoutBorder = makeConfig({
      mat: {
        included: true,
        source: "store",
        border: { lengthIn: 0, widthIn: 0 },
        unitRate: 2.5,
        layers: [layer()],
      },
    });

    expect(priceLine(withoutBoard).components.some((component) => component.kind === "mat")).toBe(
      false
    );
    expect(priceLine(withoutBorder).components.some((component) => component.kind === "mat")).toBe(
      false
    );
  });

  it("rejects a mat layer with no board", () => {
    // The amount remains zero while incomplete, and validation also prevents a
    // mat the workshop cannot pull from reaching a saved quotation.
    const noBoard = makeConfig({
      mat: { included: true, source: "store",
      border: { lengthIn: 2, widthIn: 2 },
        unitRate: 2.5, layers: [layer({ matBoardItemId: "" })] } });
    expect(validateConfiguration(noBoard)).toContain("Choose a mat board for every layer.");
  });

  it("rejects when only one of several layers is unset", () => {
    const partial = makeConfig({
      mat: {
        included: true,
        source: "store",
      border: { lengthIn: 2, widthIn: 2 },
        unitRate: 2.5,
        layers: [layer({ layerIndex: 0 }), layer({ layerIndex: 1, matBoardItemId: "" })] } });
    expect(validateConfiguration(partial)).toContain("Choose a mat board for every layer.");
  });

  it("passes when every layer has a board", () => {
    expect(validateConfiguration(makeConfig())).not.toContain(
      "Choose a mat board for every layer."
    );
  });

  it("ignores boards when matting is off", () => {
    const noMat = makeConfig({ mat: { included: false, source: "store",
      border: { lengthIn: 2, widthIn: 2 },
        unitRate: 2.5, layers: [] } });
    expect(validateConfiguration(noMat)).not.toContain("Choose a mat board for every layer.");
  });
});

describe("validateMatting — the matting dialog's own guard", () => {
  it("blocks a layer with no board", () => {
    const noBoard = makeConfig({
      mat: { included: true, source: "store",
      border: { lengthIn: 2, widthIn: 2 },
        unitRate: 2.5, layers: [layer({ matBoardItemId: "" })] } });
    expect(validateMatting(noBoard)).toEqual(["Choose a mat board for every layer."]);
  });

  it("blocks when a second layer is unset", () => {
    const partial = makeConfig({
      mat: {
        included: true,
        source: "store",
      border: { lengthIn: 2, widthIn: 2 },
        unitRate: 2.5,
        layers: [layer({ layerIndex: 0 }), layer({ layerIndex: 1, matBoardItemId: "" })] } });
    expect(validateMatting(partial)).toHaveLength(1);
  });

  it("passes once every layer has a board", () => {
    expect(validateMatting(makeConfig())).toEqual([]);
  });

  it("reports nothing the matting dialog cannot fix", () => {
    // Dimensions belong to the parent; blocking Apply on those would strand the
    // operator on a screen where they cannot be corrected.
    const noSize = makeConfig({ enteredLengthIn: 0, enteredWidthIn: 0 });
    expect(validateMatting(noSize)).toEqual([]);
    expect(validateConfiguration(noSize).length).toBeGreaterThan(0);
  });
});

describe("per-component discounts", () => {
  it("discounts only the component it names", () => {
    // The reference receipt: a wood moulding at 20% while the mat and glass on
    // the same frame carry none.
    const priced = priceLine(makeConfig({ componentDiscounts: { moulding: 20 } }));
    const moulding = priced.components.find((c) => c.kind === "moulding")!;
    const glazing = priced.components.find((c) => c.kind === "glazing")!;

    expect(moulding.discountPercent).toBe(20);
    expect(glazing.discountPercent).toBe(0);
    expect(glazing.discountAmount).toBe(0);
  });

  it("bills the amount net of the discount", () => {
    const full = priceLine(makeConfig());
    const cut = priceLine(makeConfig({ componentDiscounts: { moulding: 20 } }));
    const before = full.components.find((c) => c.kind === "moulding")!.amount;
    const after = cut.components.find((c) => c.kind === "moulding")!;

    expect(after.discountAmount).toBeCloseTo(before * 0.2, 2);
    expect(after.amount).toBeCloseTo(before * 0.8, 2);
  });

  it("reduces the line total by exactly the discount", () => {
    // The line total is the sum of net component amounts, so a discount on a
    // part has to move the line by the same money and no more.
    const full = priceLine(makeConfig()).total;
    const cut = priceLine(makeConfig({ componentDiscounts: { moulding: 20 } }));
    const taken = cut.components.find((c) => c.kind === "moulding")!.discountAmount;
    expect(cut.total).toBeCloseTo(full - taken, 2);
  });

  it("discounts a named mat layer only", () => {
    const priced = priceLine(makeConfig({ componentDiscounts: { "mat-0": 50 } }));
    const mat = priced.components.find((c) => c.key === "mat-0")!;
    expect(mat.discountPercent).toBe(50);
    expect(priced.components.filter((c) => c.discountPercent > 0)).toHaveLength(1);
  });

  it("leaves pricing untouched when no discounts are set", () => {
    // Every existing quote must price exactly as before.
    expect(priceLine(makeConfig()).total).toBe(priceLine(makeConfig({ componentDiscounts: {} })).total);
  });

  it("clamps a nonsense rate rather than inverting the price", () => {
    // A negative rate would *increase* the charge; over 100 would owe the
    // customer money. Both are data-entry slips, not pricing decisions.
    const over = priceLine(makeConfig({ componentDiscounts: { moulding: 250 } }));
    const under = priceLine(makeConfig({ componentDiscounts: { moulding: -50 } }));
    expect(over.components.find((c) => c.kind === "moulding")!.amount).toBe(0);
    expect(under.components.find((c) => c.kind === "moulding")!.discountAmount).toBe(0);
  });
});

describe("point pricing follows the shop's fraction formula", () => {
  const withPoints = (
    flexi: { numerator: number; denominator: number },
    multi: { numerator: number; denominator: number },
    quantity = 1
  ) =>
    makeConfig({
      quantity,
      hardware: {
        flexipoints: { included: true, fraction: flexi, unitRate: 1.5, itemId: "hw-flexi" },
        multipoints: { included: true, fraction: multi, unitRate: 8, itemId: "hw-multi" },
        lSupport: { included: false, size: "small", unitRate: 32, itemId: "hw-lsup" } } });

  const amountOf = (config: FrameConfiguration, key: string) =>
    priceLine(config).components.find((component) => component.key === key)?.amount;

  it("prices the shop's worked example — 1/2 flexipoints is 9.00", () => {
    // (1 + 2) x 2 x 1.50
    const config = withPoints({ numerator: 1, denominator: 2 }, { numerator: 1, denominator: 2 });
    expect(amountOf(config, "flexipoints")).toBe(9);
  });

  it("prices multipoints off the same formula at their own rate", () => {
    // (1 + 2) x 2 x 8.00
    const config = withPoints({ numerator: 1, denominator: 2 }, { numerator: 1, denominator: 2 });
    expect(amountOf(config, "multipoints")).toBe(48);
  });

  it("charges an unreduced fraction more than its reduced twin", () => {
    // The formula reads the two integers, not the fraction's value, so 2/4
    // bills double 1/2 despite being the same number. This is the whole reason
    // the pair cannot be stored as a decimal.
    const half = withPoints({ numerator: 1, denominator: 2 }, { numerator: 1, denominator: 2 });
    const twoQuarters = withPoints(
      { numerator: 2, denominator: 4 },
      { numerator: 1, denominator: 2 }
    );
    expect(amountOf(half, "flexipoints")).toBe(9);
    expect(amountOf(twoQuarters, "flexipoints")).toBe(18);
  });

  it("charges a finer division more, not less", () => {
    // (1 + 8) x 2 x 1.50 = 27.00 against 1/2's 9.00 — a smaller fraction costs
    // more, because the denominator tracks how finely the strip is cut.
    const config = withPoints({ numerator: 1, denominator: 8 }, { numerator: 1, denominator: 2 });
    expect(amountOf(config, "flexipoints")).toBe(27);
  });

  it("multiplies the whole charge by the frame count", () => {
    const config = withPoints(
      { numerator: 1, denominator: 2 },
      { numerator: 1, denominator: 2 },
      3
    );
    expect(amountOf(config, "flexipoints")).toBe(27);
  });

  it("counts frames on the invoice, since the fraction is a size not a count", () => {
    const config = withPoints(
      { numerator: 1, denominator: 2 },
      { numerator: 1, denominator: 2 },
      3
    );
    const flexi = priceLine(config).components.find((c) => c.key === "flexipoints");
    expect(flexi?.quantity).toBe(3);
    expect(flexi?.detail).toBe("1/2 per frame");
  });
});

describe("L-support is a flat per-frame charge", () => {
  const withSupport = (unitRate: number, quantity = 1) =>
    makeConfig({
      quantity,
      hardware: {
        flexipoints: {
          included: false,
          fraction: { numerator: 1, denominator: 2 },
          unitRate: 1.5,
          itemId: "hw-flexi" },
        multipoints: {
          included: false,
          fraction: { numerator: 1, denominator: 2 },
          unitRate: 8,
          itemId: "hw-multi" },
        lSupport: { included: true, size: "big", unitRate, itemId: "hw-lsup" } } });

  it("bills the item price as-is, with no per-side arithmetic", () => {
    // 72.00 is the big support's stored price. The shop reckons it as 4 sides
    // x 18.00, but that reasoning lives in the item price, not in code.
    const support = priceLine(withSupport(72)).components.find(
      (component) => component.key === "l_support"
    );
    expect(support?.amount).toBe(72);
    expect(support?.unitRate).toBe(72);
  });

  it("multiplies only by the frame count", () => {
    const support = priceLine(withSupport(32, 4)).components.find(
      (component) => component.key === "l_support"
    );
    expect(support?.amount).toBe(128);
  });
});

describe("the border must absorb every reveal", () => {
  const withMats = (border: { lengthIn: number; widthIn: number }, count: number) =>
    makeConfig({
      mat: {
        included: true,
        source: "store",
        border,
        unitRate: 2.5,
        layers: Array.from({ length: count }, (_, index) => layer({ layerIndex: index })),
      },
    });

  it("allows a stack the border can carry", () => {
    // 2" holds three mats: two reveals take 1/2", leaving 1 1/2" of top mat.
    expect(matStackFitsBorder({ lengthIn: 2, widthIn: 2 }, 3)).toBe(true);
    expect(validateMatting(withMats({ lengthIn: 2, widthIn: 2 }, 3))).toEqual([]);
  });

  it("rejects a stack whose reveals would consume the whole border", () => {
    // 1/2" with three mats needs 1/2" of reveal, leaving the top mat nothing.
    expect(matStackFitsBorder({ lengthIn: 0.5, widthIn: 0.5 }, 3)).toBe(false);
    expect(validateMatting(withMats({ lengthIn: 0.5, widthIn: 0.5 }, 3))).not.toEqual([]);
  });

  it("checks each axis, so a weighted border is limited by its narrow side", () => {
    expect(matStackFitsBorder({ lengthIn: 3, widthIn: 0.25 }, 2)).toBe(false);
  });

  it("reports the cap the border allows", () => {
    expect(maxMatsForBorder({ lengthIn: 2, widthIn: 2 })).toBe(3);
    expect(maxMatsForBorder({ lengthIn: 0.5, widthIn: 0.5 })).toBe(2);
    expect(maxMatsForBorder({ lengthIn: 0.25, widthIn: 0.25 })).toBe(1);
  });
});

describe("one mat rate for the whole stack", () => {
  const stacked = (unitRate: number, count: number) =>
    makeConfig({
      enteredLengthIn: 20,
      enteredWidthIn: 16,
      overlapIn: 0,
      mat: {
        included: true,
        source: "store",
        border: { lengthIn: 2, widthIn: 2 },
        unitRate,
        layers: Array.from({ length: count }, (_, index) => layer({ layerIndex: index })),
      },
    });

  const matRows = (config: FrameConfiguration) =>
    priceLine(config).components.filter((component) => component.kind === "mat");

  it("bills every layer at the stack rate", () => {
    const rows = matRows(stacked(2.5, 3));
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.unitRate === 2.5)).toBe(true);
    // (24 + 20) x 2.5 on the mat outer, the same for each layer.
    expect(rows.every((row) => row.amount === 110)).toBe(true);
  });

  it("moves every layer when the one rate changes", () => {
    const cheap = matRows(stacked(2.5, 2)).reduce((sum, row) => sum + row.amount, 0);
    const dear = matRows(stacked(5, 2)).reduce((sum, row) => sum + row.amount, 0);
    expect(dear).toBe(cheap * 2);
  });

  it("still discounts a single layer on its own", () => {
    // The rate is shared; the discount is not — a top mat can be marked down
    // while the one beneath it is not.
    const config = stacked(2.5, 2);
    config.componentDiscounts = { "mat-0": 50 };
    const rows = matRows(config);
    expect(rows[0].discountPercent).toBe(50);
    expect(rows[1].discountPercent).toBe(0);
    expect(rows[0].amount).toBe(rows[1].amount / 2);
  });
});

describe("the mat rate is required, not defaulted", () => {
  const matted = (unitRate: number, billingMode: "chop_join" | "framing" = "chop_join") =>
    makeConfig({
      billingMode,
      frameRate: billingMode === "framing" ? 50 : 0,
      mat: {
        included: true,
        source: "store",
        border: { lengthIn: 2, widthIn: 2 },
        unitRate,
        layers: [layer({ layerIndex: 0 })],
      },
    });

  it("blocks a chop & join mat with no rate", () => {
    // Zero used to be seeded as 2.5, which quoted lines at a rate nobody chose.
    expect(validateMatting(matted(0))).toEqual(["Enter a mat rate."]);
  });

  it("allows it once a rate is entered", () => {
    expect(validateMatting(matted(2.5))).toEqual([]);
  });

  it("does not demand one in framing, where the field is hidden", () => {
    // The frame rate is the whole charge there, so a zero mat rate is correct.
    expect(validateMatting(matted(0, "framing"))).toEqual([]);
  });

  it("does not demand one when there is no mat at all", () => {
    const bare = makeConfig({
      mat: {
        included: false,
        source: "store",
        border: { lengthIn: 2, widthIn: 2 },
        unitRate: 0,
        layers: [],
      },
    });
    expect(validateMatting(bare)).toEqual([]);
  });
});
