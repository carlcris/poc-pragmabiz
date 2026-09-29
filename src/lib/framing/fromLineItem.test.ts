import { describe, expect, it } from "vitest";

import { frameConfigToLineItem, frameSizesToLineItem } from "./toLineItem";
import { hasMissingFittingItems } from "./validation";
import {
  frameLineToConfig,
  frameLineToSizes,
  isConfiguredLine,
  type RestoredFrame } from "./fromLineItem";
import type { FrameConfiguration, MatLayer } from "./types";
import type { ItemSelectOption } from "@/components/common/ItemSelect";

const option = (id: string, code: string, name: string): ItemSelectOption => ({
  id, code, name, uom: "PC", uomId: "uom-1", listPrice: 0 });
const MOULDING = option("moulding-1", "1574-36B-BLK", "Blk Polystyrene Moulding");
const BOARD_A = option("mat-1", "EM 1019", "Cream White Matboard");
const BOARD_B = option("mat-2", "EM 3301", "Charcoal Grey Matboard");

const layer = (o: Partial<MatLayer> = {}): MatLayer => ({
  layerIndex: 0, matBoardItemId: BOARD_A.id, ...o });

const makeConfig = (o: Partial<FrameConfiguration> = {}): FrameConfiguration => ({
  billingMode: "chop_join",
  quantity: 2,
  sizeMode: "artwork",
  enteredLengthIn: 15,
  enteredWidthIn: 12,
  frameRate: 0,
  frameWidthIn: 2.25,
  overlapIn: 0.125,
  moulding: { itemId: MOULDING.id, code: MOULDING.code, name: MOULDING.name, unitRate: 6.19, material: "polystyrene" },
  mat: { included: true, source: "store",
      border: { lengthIn: 2, widthIn: 2 },
        unitRate: 2.5, layers: [layer()] },
  glazing: {
    included: true, glazingType: "double", glazingItemId: "glz-double",
    label: "Double glass", unitRate: 0.35, sheets: 2, cutToMatOuter: true },
  backing: { backingType: "plywood", backingItemId: "bck-ply", label: "Plywood", unitRate: 0.16 },
  hardware: {
    flexipoints: { included: true, fraction: { numerator: 1, denominator: 2 }, unitRate: 1.5, itemId: "hw-flexi" },
    multipoints: { included: false, fraction: { numerator: 1, denominator: 2 }, unitRate: 8, itemId: "hw-multi" },
    lSupport: { included: true, size: "big", unitRate: 60, itemId: "hw-lsup" } },
  attachments: [],
  ...o });

const selections: RestoredFrame["selections"] = {
  moulding: MOULDING,
  matBoards: { 0: BOARD_A },
  glazing: null,
  backing: null };

/** Save a configuration, then reopen it — the trip an edit actually makes. */
const roundTrip = (config: FrameConfiguration, sel = selections) => {
  const line = frameConfigToLineItem(config, sel, "uom-1");
  return frameLineToConfig(
    {
      itemId: line.itemId,
      itemCode: line.itemCode,
      itemName: line.itemName,
      quantity: line.quantity,
      frameConfiguration: line.frameConfiguration,
      frameComponents: line.frameComponents,
      matLayers: line.matLayers },
    "uom-1"
  );
};

describe("isConfiguredLine", () => {
  it("is true only for lines carrying a frame configuration", () => {
    expect(isConfiguredLine({ quantity: 1, frameConfiguration: null })).toBe(false);
    expect(isConfiguredLine({ quantity: 1 })).toBe(false);
  });
});

describe("frameLineToConfig — a saved line reopens as it was built", () => {
  it("returns null for a plain item line, so the caller falls back", () => {
    expect(frameLineToConfig({ quantity: 1, frameConfiguration: null }, "uom-1")).toBeNull();
  });

  it("restores the geometry the user entered", () => {
    const restored = roundTrip(makeConfig())!;
    expect(restored.config.enteredLengthIn).toBe(15);
    expect(restored.config.enteredWidthIn).toBe(12);
    expect(restored.config.frameWidthIn).toBe(2.25);
    expect(restored.config.overlapIn).toBe(0.125);
    expect(restored.config.sizeMode).toBe("artwork");
    expect(restored.config.quantity).toBe(2);
  });

  it("restores the billing mode, so the dialog opens in the right mode", () => {
    expect(roundTrip(makeConfig({ billingMode: "framing" }))!.config.billingMode).toBe("framing");
    expect(roundTrip(makeConfig({ billingMode: "chop_join" }))!.config.billingMode).toBe("chop_join");
  });

  it("restores the glass type, rate and sheets", () => {
    const glazing = roundTrip(makeConfig())!.config.glazing;
    expect(glazing.included).toBe(true);
    expect(glazing.glazingType).toBe("double");
    expect(glazing.unitRate).toBe(0.35);
    expect(glazing.sheets).toBe(2);
  });

  it("restores the backing type and its rate", () => {
    const backing = roundTrip(makeConfig())!.config.backing;
    expect(backing.backingType).toBe("plywood");
    expect(backing.unitRate).toBe(0.16);
  });

  it("restores every mat layer with its own border and rate", () => {
    const config = makeConfig({
      mat: {
        included: true,
        source: "customer",
      border: { lengthIn: 2, widthIn: 2 },
        unitRate: 2.5,
        layers: [layer({ layerIndex: 0 }), layer({ layerIndex: 1, matBoardItemId: BOARD_B.id })] } });
    const restored = roundTrip(config, {
      ...selections,
      matBoards: { 0: BOARD_A, 1: BOARD_B } })!;

    expect(restored.config.mat.included).toBe(true);
    expect(restored.config.mat.source).toBe("customer");
    expect(restored.config.mat.layers).toHaveLength(2);
    // The border belongs to the stack now, not the layers.
    expect(restored.config.mat.border).toEqual({ lengthIn: 2, widthIn: 2 });
    expect(restored.selections.matBoards[1]?.code).toBe("EM 3301");
  });

  it("blocks selected fittings whose item IDs were cleared by a draft reset", () => {
    const config = makeConfig();
    config.hardware.flexipoints.itemId = null;
    expect(hasMissingFittingItems(config)).toBe(true);
    config.hardware.flexipoints.itemId = "hw-flexi";
    expect(hasMissingFittingItems(config)).toBe(false);
    config.hardware.multipoints.itemId = null;
    expect(hasMissingFittingItems(config)).toBe(false);
    config.hardware.multipoints.included = true;
    expect(hasMissingFittingItems(config)).toBe(true);
    config.billingMode = "framing";
    expect(hasMissingFittingItems(config)).toBe(false);
  });

  it("persists every selected fitting through save and reopen", () => {
    const config = makeConfig();
    config.hardware.multipoints.included = true;
    const restored = roundTrip(config)!.config.hardware;
    expect(restored.flexipoints).toEqual(config.hardware.flexipoints);
    expect(restored.multipoints).toEqual(config.hardware.multipoints);
    expect(restored.lSupport).toEqual(config.hardware.lSupport);
  });

  it("restores hardware from its component rows", () => {
    const hardware = roundTrip(makeConfig())!.config.hardware;
    expect(hardware.flexipoints.included).toBe(true);
    expect(hardware.flexipoints.fraction).toEqual({ numerator: 1, denominator: 2 });
    expect(hardware.multipoints.included).toBe(false);
    expect(hardware.lSupport.included).toBe(true);
    expect(hardware.lSupport.size).toBe("big");
  });

  it("round-trips a point fraction without reducing it", () => {
    // 2/4 must not come back as 1/2: they are the same number and bill
    // differently, so any reduction on the way through changes the price.
    const config = makeConfig();
    config.hardware.flexipoints = {
      ...config.hardware.flexipoints,
      included: true,
      fraction: { numerator: 2, denominator: 4 } };

    const hardware = roundTrip(config)!.config.hardware;
    expect(hardware.flexipoints.fraction).toEqual({ numerator: 2, denominator: 4 });
  });

  it("restores a frame with no mat as having none", () => {
    const config = makeConfig({ mat: { included: false, source: "store",
      border: { lengthIn: 2, widthIn: 2 },
        unitRate: 2.5, layers: [] } });
    const restored = roundTrip(config)!;
    expect(restored.config.mat.included).toBe(false);
    expect(restored.config.mat.layers).toEqual([]);
  });

  it("keeps the moulding selectable, so the picker shows what was chosen", () => {
    const restored = roundTrip(makeConfig())!;
    expect(restored.selections.moulding?.id).toBe(MOULDING.id);
    expect(restored.selections.moulding?.code).toBe("1574-36B-BLK");
    expect(restored.config.moulding.unitRate).toBe(6.19);
  });

  it("restores the moulding rate from its saved component row", () => {
    // The rate is not on the configuration; without this an edited line would
    // re-price at zero.
    const restored = roundTrip(makeConfig())!;
    expect(restored.config.moulding.unitRate).toBe(6.19);
  });

  it("restores the moulding without price tiers, which callers must not read as unpriced", () => {
    // Stored columns carry no tiers. Treating absent tiers as "no rate" made the
    // dialog warn on every edit about a moulding that is priced perfectly well.
    const restored = roundTrip(makeConfig())!;
    expect(restored.selections.moulding?.priceTiers).toBeUndefined();
    expect(restored.config.moulding.unitRate).toBeGreaterThan(0);
  });

  it("restores the moulding material, so an edit reprices identically", () => {
    // The formula branches on material; losing it would silently reprice a wood
    // line as polystyrene.
    const restored = roundTrip(makeConfig())!;
    expect(restored.config.moulding.material).toBe("polystyrene");
  });

  it("survives a second round trip unchanged", () => {
    // Editing and re-saving repeatedly must not drift.
    const once = roundTrip(makeConfig())!;
    const twice = roundTrip(once.config, once.selections)!;
    expect(twice.config.glazing.glazingType).toBe(once.config.glazing.glazingType);
    expect(twice.config.backing.backingType).toBe(once.config.backing.backingType);
    expect(twice.config.mat.layers).toEqual(once.config.mat.layers);
    expect(twice.config.enteredLengthIn).toBe(once.config.enteredLengthIn);
  });
});

describe("frameLineToSizes — a multi-size line reopens whole", () => {
  const SERVICE = { id: "svc-cj", code: "SVC-CHOPJOIN", name: "Chop & Join" };
  const sized = (lengthIn: number, widthIn: number) => ({
    config: makeConfig({ enteredLengthIn: lengthIn, enteredWidthIn: widthIn, overlapIn: 0 }),
    selections });

  const savedLine = () => {
    const line = frameSizesToLineItem(
      [sized(8, 10), sized(12, 10)],
      "chop_join",
      SERVICE,
      "uom-1"
    );
    return {
      itemId: line.itemId,
      itemCode: line.itemCode,
      itemName: line.itemName,
      quantity: line.quantity,
      frameConfiguration: line.frameConfiguration,
      frameComponents: line.frameComponents,
      matLayers: line.matLayers,
      frameSizes: line.frameSizes };
  };

  it("restores one entry per size", () => {
    const sizes = frameLineToSizes(savedLine(), "uom-1");
    expect(sizes).toHaveLength(2);
  });

  it("restores each size's own dimensions", () => {
    const sizes = frameLineToSizes(savedLine(), "uom-1");
    expect(sizes[0].config.enteredLengthIn).toBe(8);
    expect(sizes[1].config.enteredLengthIn).toBe(12);
  });

  it("restores each size's own moulding rate and material", () => {
    // Losing either would silently reprice the line on save.
    const sizes = frameLineToSizes(savedLine(), "uom-1");
    sizes.forEach((size) => {
      expect(size.config.moulding.unitRate).toBe(6.19);
      expect(size.config.moulding.material).toBe("polystyrene");
    });
  });

  it("restores each size's own mat layers", () => {
    const sizes = frameLineToSizes(savedLine(), "uom-1");
    expect(sizes[0].config.mat.layers).toHaveLength(1);
    expect(sizes[1].config.mat.layers).toHaveLength(1);
  });

  it("re-saves to the same total, so editing does not drift", () => {
    const original = frameSizesToLineItem(
      [sized(8, 10), sized(12, 10)],
      "chop_join",
      SERVICE,
      "uom-1"
    );
    const restored = frameLineToSizes(savedLine(), "uom-1");
    const resaved = frameSizesToLineItem(
      restored.map((entry) => ({ config: entry.config, selections: entry.selections })),
      "chop_join",
      SERVICE,
      "uom-1"
    );
    expect(resaved.lineTotal).toBeCloseTo(original.lineTotal, 2);
    expect(resaved.frameSizes).toHaveLength(2);
  });

  it("treats a single-size line as one size", () => {
    const line = frameConfigToLineItem(makeConfig(), selections, "uom-1");
    const sizes = frameLineToSizes(
      {
        itemId: line.itemId,
        quantity: line.quantity,
        frameConfiguration: line.frameConfiguration,
        frameComponents: line.frameComponents,
        matLayers: line.matLayers },
      "uom-1"
    );
    expect(sizes).toHaveLength(1);
  });

  it("returns nothing for a plain item line", () => {
    expect(frameLineToSizes({ quantity: 1, frameConfiguration: null }, "uom-1")).toEqual([]);
  });
});
