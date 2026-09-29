import { describe, expect, it } from "vitest";

import { frameConfigToLineItem } from "@/lib/framing/toLineItem";
import type { FrameConfiguration } from "@/lib/framing/types";
import type { ItemSelectOption } from "@/components/common/ItemSelect";
import { buildFrameJobOrderRequisitionRows } from "./requisition";

const option = (id: string, code: string, name: string): ItemSelectOption => ({
  id,
  code,
  name,
  uom: "CUT",
  uomId: "cut-uom",
  listPrice: 0,
});

const moulding = option("moulding-1", "057-02Q", "White Polystyrene Picture Frame Mouldings");
const matBoard = option("mat-1", "EM 2035-CUT1012", "Biscuit Block Brown Matboard");

const configuration: FrameConfiguration = {
  billingMode: "chop_join",
  quantity: 2,
  sizeMode: "artwork",
  enteredLengthIn: 21,
  enteredWidthIn: 16,
  frameWidthIn: 1.5,
  frameRate: 0,
  overlapIn: 0,
  moulding: {
    itemId: moulding.id,
    code: moulding.code,
    name: moulding.name,
    unitRate: 6.19,
    material: "polystyrene",
  },
  mat: {
    included: true,
    source: "store",
    border: { lengthIn: 2, widthIn: 2 },
    unitRate: 2.5,
    layers: [{ layerIndex: 0, matBoardItemId: matBoard.id }],
  },
  glazing: {
    included: true,
    glazingType: "clear",
    glazingItemId: "glass-clear",
    label: "Clear glass",
    unitRate: 0.35,
    sheets: 1,
    cutToMatOuter: true,
  },
  backing: {
    backingType: "plywood",
    backingItemId: "backing-plywood",
    label: "Plywood",
    unitRate: 0.16,
    thicknessIn: 0.125,
  },
  hardware: {
    flexipoints: {
      included: true,
      fraction: { numerator: 1, denominator: 2 },
      unitRate: 1.5,
      itemId: "flexipoints",
    },
    multipoints: {
      included: false,
      fraction: { numerator: 1, denominator: 2 },
      unitRate: 8,
      itemId: "multipoints",
    },
    lSupport: {
      included: false,
      size: "small",
      unitRate: 32,
      itemId: "l-support",
    },
  },
  framingInstructions: "Keep the artwork centered.",
  attachments: [],
};

describe("buildFrameJobOrderRequisitionRows", () => {
  it("rebuilds a saved size with its workshop details", () => {
    const saved = frameConfigToLineItem(
      configuration,
      {
        moulding,
        matBoards: { 0: matBoard },
        glazing: null,
        backing: null,
      },
      "cut-uom"
    );

    const rows = buildFrameJobOrderRequisitionRows([
      {
        frameConfiguration: saved.frameConfiguration,
        frameComponents: saved.frameComponents,
        matLayers: saved.matLayers,
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      quantity: 2,
      artwork: { lengthIn: "21", widthIn: "16" },
      matOuter: { lengthIn: "25", widthIn: "20" },
      instructions: "Keep the artwork centered.",
    });
    expect(rows[0].articles[0].lines[0].text).toContain("057-02Q");
    expect(rows[0].articles.at(-1)?.lines[0].text).toContain("Plywood 1/8\u2033 backing");
  });
});
