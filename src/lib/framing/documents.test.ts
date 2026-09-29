import { describe, expect, it } from "vitest";

import { articleBlocks, cutListRows, requisitionRow } from "./documents";
import type { DocumentLabels } from "./documents";
import { GLAZING_TYPES, glazingSheetsEditable } from "./types";
import type { FrameConfiguration, MatLayer } from "./types";

const labels: DocumentLabels = {
  moulding: "1001-1-B BLK POLYSTYRENE MOULDING",
  matBoards: { 0: "em-1024 march mallow white 30 x 42" },
  glazing: "Clear glass",
  backing: "MDF" };

const layer = (overrides: Partial<MatLayer> = {}): MatLayer => ({
  layerIndex: 0,
  matBoardItemId: "mat-1",
  ...overrides });

const makeConfig = (overrides: Partial<FrameConfiguration> = {}): FrameConfiguration => ({
  billingMode: "chop_join",
  quantity: 2,
  sizeMode: "artwork",
  enteredLengthIn: 8,
  enteredWidthIn: 10,
  frameWidthIn: 1.5,
  frameRate: 0,
  overlapIn: 0.125,
  moulding: { itemId: "m1", code: "1001-1-B", name: "BLK POLYSTYRENE MOULDING", unitRate: 6.19, material: "polystyrene" },
  mat: { included: true, source: "store",
      border: { lengthIn: 2, widthIn: 2 },
        unitRate: 2.5, layers: [layer()] },
  glazing: {
    included: true,
    glazingType: "clear",
    glazingItemId: "g1",
    label: "Clear glass",
    unitRate: 0.35,
    sheets: 1,
    cutToMatOuter: true },
  backing: { backingType: "mdf", backingItemId: "b1", label: "MDF", unitRate: 0.16 },
  hardware: {
    flexipoints: { included: true, fraction: { numerator: 1, denominator: 2 }, unitRate: 1.5, itemId: "hw-flexi" },
    multipoints: { included: false, fraction: { numerator: 1, denominator: 2 }, unitRate: 8, itemId: "hw-multi" },
    lSupport: { included: false, size: "small", unitRate: 35, itemId: "hw-lsup" } },
  attachments: [],
  ...overrides });

describe("articleBlocks — the requisition's grouped description", () => {
  const find = (blocks: ReturnType<typeof articleBlocks>, prefix: string) =>
    blocks.find((block) => block.heading.startsWith(prefix));
  const textOf = (blocks: ReturnType<typeof articleBlocks>, prefix: string) =>
    find(blocks, prefix)?.lines.map((line) => line.text) ?? [];

  it("leads with the moulding, which the shop reads first", () => {
    const blocks = articleBlocks(makeConfig(), labels);
    expect(blocks[0].heading).toBe("Moulding");
    expect(blocks[0].emphasis).toBe(true);
    expect(blocks[0].lines[0].text).toContain("BLK POLYSTYRENE MOULDING");
  });

  it("puts the mat count and who supplied the board on the heading", () => {
    const blocks = articleBlocks(makeConfig(), labels);
    expect(find(blocks, "Matting")?.heading).toBe("Matting — single, store-supplied");
  });

  it("says customer-supplied when the customer brought the board", () => {
    const config = makeConfig({ mat: { included: true, source: "customer",
      border: { lengthIn: 2, widthIn: 2 },
        unitRate: 2.5, layers: [layer()] } });
    const blocks = articleBlocks(config, labels);
    expect(find(blocks, "Matting")?.heading).toContain("customer-supplied");
  });

  it("groups glass, backing and hardware under one Finishing heading", () => {
    // Replaces the old run-on line that repeated "w/" for every part.
    const finishing = textOf(articleBlocks(makeConfig(), labels), "Finishing")[0];
    expect(finishing).toBe("Clear glass · MDF backing · Flexipoints 1/2");
    expect(finishing).not.toContain("w/");
  });

  it("never repeats the glass type's own wording", () => {
    // "w/ With Double Glass" used to stutter; the label stands alone now.
    const config = makeConfig({
      glazing: {
        included: true,
        glazingType: "double",
        glazingItemId: "g",
        label: "With Double Glass",
        unitRate: 0.35,
        sheets: 2,
        cutToMatOuter: true } });
    const finishing = textOf(articleBlocks(config, labels), "Finishing")[0];
    expect(finishing).toContain("With Double Glass");
    expect(finishing).not.toContain("w/ With");
  });

  it("omits the Matting block entirely when there is no mat", () => {
    const config = makeConfig({ mat: { included: false, source: "store",
      border: { lengthIn: 2, widthIn: 2 },
        unitRate: 2.5, layers: [] } });
    const blocks = articleBlocks(config, labels);
    expect(find(blocks, "Matting")).toBeUndefined();
    expect(blocks[0].heading).toBe("Moulding");
  });

  it("omits the Finishing block when nothing finishes the frame", () => {
    const config = makeConfig({
      glazing: {
        included: false,
        glazingType: "clear",
        glazingItemId: null,
        label: "",
        unitRate: 0.35,
        sheets: 1,
        cutToMatOuter: true },
      backing: { backingType: null, backingItemId: null, label: "", unitRate: 0.16 },
      hardware: {
        flexipoints: { included: false, fraction: { numerator: 1, denominator: 2 }, unitRate: 1.5, itemId: "hw-flexi" },
        multipoints: { included: false, fraction: { numerator: 1, denominator: 2 }, unitRate: 8, itemId: "hw-multi" },
        lSupport: { included: false, size: "small", unitRate: 35, itemId: "hw-lsup" } } });
    expect(find(articleBlocks(config, labels), "Finishing")).toBeUndefined();
  });

  it("names each mat position when there is more than one layer", () => {
    const config = makeConfig({
      mat: {
        included: true,
        source: "store",
      border: { lengthIn: 2, widthIn: 2 },
        unitRate: 2.5,
        layers: [layer({ layerIndex: 0 }), layer({ layerIndex: 1 }), layer({ layerIndex: 2 })] } });
    const lines = textOf(
      articleBlocks(config, {
        ...labels,
        matBoards: { 0: "em-1024 white", 1: "em-3301 grey", 2: "em-5510 burgundy" } }),
      "Matting"
    );
    expect(lines).toEqual([
      "Top mat — em-1024 white",
      "2nd mat — em-3301 grey",
      "3rd mat — em-5510 burgundy",
    ]);
  });

  it("leaves a single mat unqualified", () => {
    // "Top mat" on a lone layer reads as though a second one is missing.
    const lines = textOf(articleBlocks(makeConfig(), labels), "Matting");
    expect(lines).toEqual(["em-1024 march mallow white 30 x 42"]);
  });

  it("marks mat layers as bullets so they print indented", () => {
    const block = find(articleBlocks(makeConfig(), labels), "Matting");
    expect(block?.lines.every((line) => line.bullet)).toBe(true);
  });

  it("names double and triple matting on the heading", () => {
    const twoLayers = makeConfig({
      mat: {
        included: true,
        source: "store",
      border: { lengthIn: 2, widthIn: 2 },
        unitRate: 2.5,
        layers: [layer({ layerIndex: 0 }), layer({ layerIndex: 1 })] } });
    expect(find(articleBlocks(twoLayers, labels), "Matting")?.heading).toContain("double");
  });
});

describe("requisitionRow", () => {
  it("prints the artwork size the customer gave", () => {
    const row = requisitionRow(makeConfig(), labels);
    expect(row.artwork).toEqual({ lengthIn: "8", widthIn: "10" });
  });

  it("prints dimensions as fractions, not decimals", () => {
    const row = requisitionRow(makeConfig({ enteredLengthIn: 8.25 }), labels);
    expect(row.artwork.lengthIn).toBe("8 1/4");
  });

  it("shows the mat cut size, which is what the border produces", () => {
    // No overlap: 8 x 10 artwork + 2" border on each edge = 12 x 14.
    const row = requisitionRow(makeConfig({ overlapIn: 0 }), labels);
    expect(row.matOuter).toEqual({ lengthIn: "12", widthIn: "14" });
  });

  it("subtracts an overlap from the mat cut size when a line asks for one", () => {
    // This fixture keeps the eighth-inch overlap, so each edge loses 1/8.
    const row = requisitionRow(makeConfig(), labels);
    expect(row.matOuter).toEqual({ lengthIn: "11 3/4", widthIn: "13 3/4" });
  });

  it("keeps the mat cut size when a second layer is added", () => {
    // The reveals come out of the border, so a second mat does not widen the
    // cut — the whole point of the stack border.
    const single = makeConfig({
      overlapIn: 0,
      mat: {
        included: true,
        source: "store",
        border: { lengthIn: 2, widthIn: 2 },
        unitRate: 2.5,
        layers: [layer({ layerIndex: 0 })],
      },
    });
    const double = makeConfig({
      overlapIn: 0,
      mat: {
        included: true,
        source: "store",
        border: { lengthIn: 2, widthIn: 2 },
        unitRate: 2.5,
        layers: [layer({ layerIndex: 0 }), layer({ layerIndex: 1 })],
      },
    });
    expect(requisitionRow(double, labels).matOuter).toEqual(
      requisitionRow(single, labels).matOuter
    );
  });

  it("prints what each mat is cut to, beside the sizes", () => {
    // The border decides the cut, so it sits with the dimensions rather than in
    // the article prose.
    const row = requisitionRow(makeConfig(), labels);
    expect(row.matBorders).toEqual([{ label: "", text: "border 2″" }]);
  });

  it("collapses an even border to a single figure", () => {
    // The shop writes 2″, not 2″ × 2″, when a border is even.
    const row = requisitionRow(makeConfig(), labels);
    expect(row.matBorders[0].text).not.toContain("2″ × 2″");
  });

  it("prints both figures when the border is uneven", () => {
    const config = makeConfig({
      mat: {
        included: true,
        source: "store",
        border: { lengthIn: 2, widthIn: 3 },
        unitRate: 2.5,
        layers: [layer({})],
      },
    });
    expect(requisitionRow(config, labels).matBorders[0].text).toBe("border 2″ × 3″");
  });

  it("states the border once, then the reveals taken from within it", () => {
    // Layers no longer carry their own measurement, so the requisition names
    // the stack border and how many reveals come out of it.
    const config = makeConfig({
      mat: {
        included: true,
        source: "store",
        border: { lengthIn: 2, widthIn: 2 },
        unitRate: 2.5,
        layers: [layer({ layerIndex: 0 }), layer({ layerIndex: 1 })],
      },
    });
    expect(requisitionRow(config, labels).matBorders).toEqual([
      { label: "", text: "border 2″" },
      { label: "", text: "1 × reveal 1/4″" },
    ]);
  });

  it("has no border figures when the frame has no mat", () => {
    const config = makeConfig({ mat: { included: false, source: "store",
      border: { lengthIn: 2, widthIn: 2 },
        unitRate: 2.5, layers: [] } });
    expect(requisitionRow(config, labels).matBorders).toEqual([]);
  });

  it("has no mat cut size when the frame has no mat", () => {
    const config = makeConfig({ mat: { included: false, source: "store",
      border: { lengthIn: 2, widthIn: 2 },
        unitRate: 2.5, layers: [] } });
    expect(requisitionRow(config, labels).matOuter).toBeNull();
  });

  it("carries the quantity and the CUT unit the paper form uses", () => {
    const row = requisitionRow(makeConfig(), labels);
    expect(row.quantity).toBe(2);
    expect(row.unit).toBe("CUT");
  });
});

describe("cutListRows — what the workshop cuts", () => {
  it("leads with moulding footage, per cut and total", () => {
    const rows = cutListRows(makeConfig(), labels);
    expect(rows[0].material).toBe("Moulding");
    // 2 frames, so the total is double the per-cut footage.
    const perCut = Number(rows[0].perCut.replace(" ft", ""));
    const total = Number(rows[0].total.replace(" ft", ""));
    expect(total).toBeCloseTo(perCut * 2, 1);
  });

  it("gives each mat layer its outer and opening sizes", () => {
    const spec = cutListRows(makeConfig(), labels).find((row) => row.material === "Top mat")?.spec;
    expect(spec).toContain("outer");
    expect(spec).toContain("opening");
  });

  it("cuts glass and backing to the same clearance size", () => {
    const rows = cutListRows(makeConfig(), labels);
    const glass = rows.find((row) => row.material === "Glass");
    const backing = rows.find((row) => row.material === "Backing");
    const size = (spec?: string) => spec?.match(/cut .+$/)?.[0];
    expect(size(glass?.spec)).toBe(size(backing?.spec));
    // Mat outer is 11 3/4 × 13 3/4; the clearance cut takes a sixteenth off each.
    expect(glass?.spec).toContain("11 11/16″ × 13 11/16″");
  });

  it("counts one set of points per frame and puts the fraction in the spec", () => {
    // The fraction is the size cut, not a count, so it must not be multiplied
    // out — "1/2" across 2 frames is 2 sets of 1/2, never "1".
    const flexi = cutListRows(makeConfig(), labels).find(
      (row) => row.material === "Flexipoints"
    );
    expect(flexi?.spec).toBe("1/2");
    expect(flexi?.perCut).toBe("1");
    expect(flexi?.total).toBe("2");
  });

  it("omits hardware that is not included", () => {
    const rows = cutListRows(makeConfig(), labels);
    expect(rows.some((row) => row.material === "Multipoints")).toBe(false);
    expect(rows.some((row) => row.material === "L-support")).toBe(false);
  });

  it("fixes L-supports at four per frame, one per corner", () => {
    const config = makeConfig({
      hardware: {
        flexipoints: { included: false, fraction: { numerator: 1, denominator: 2 }, unitRate: 1.5, itemId: "hw-flexi" },
        multipoints: { included: false, fraction: { numerator: 1, denominator: 2 }, unitRate: 8, itemId: "hw-multi" },
        lSupport: { included: true, size: "big", unitRate: 60, itemId: "hw-lsup" } } });
    const support = cutListRows(config, labels).find((row) => row.material === "L-support");
    expect(support?.perCut).toBe("4");
    expect(support?.total).toBe("8");
  });

  it("skips the glass row when glazing is off", () => {
    const config = makeConfig({
      glazing: {
        included: false,
        glazingType: "clear",
        glazingItemId: null,
        label: "",
        unitRate: 0.35,
        sheets: 1,
        cutToMatOuter: true } });
    expect(cutListRows(config, labels).some((row) => row.material === "Glass")).toBe(false);
  });
});

describe("glazing type", () => {
  it("names only double glass as taking more than one pane", () => {
    expect(glazingSheetsEditable("double")).toBe(true);
    (["clear", "acrylic", "non_glare", "octagon"] as const).forEach((type) => {
      expect(glazingSheetsEditable(type)).toBe(false);
    });
  });

  it("offers the five types the legacy job-order screen lists", () => {
    expect(GLAZING_TYPES.map((entry) => entry.type)).toEqual([
      "clear",
      "double",
      "acrylic",
      "non_glare",
      "octagon",
    ]);
  });

  it("prints the chosen type on the cut list, not a catalogue item name", () => {
    const config = makeConfig({
      glazing: {
        included: true,
        glazingType: "non_glare",
        glazingItemId: null,
        label: "With Non Glare",
        unitRate: 0.35,
        sheets: 1,
        cutToMatOuter: true } });
    const glass = cutListRows(config, labels).find((row) => row.material === "Glass");
    expect(glass?.spec).toContain("With Non Glare");
    // The label on the configuration wins over any stale catalogue name.
    expect(glass?.spec).not.toContain("Clear glass");
  });

  it("carries the chosen type into the requisition description", () => {
    const config = makeConfig({
      glazing: {
        included: true,
        glazingType: "double",
        glazingItemId: null,
        label: "With Double Glass",
        unitRate: 0.35,
        sheets: 2,
        cutToMatOuter: true } });
    const finishing = articleBlocks(config, labels).find((b) =>
      b.heading.startsWith("Finishing")
    );
    expect(finishing?.lines[0].text).toContain("With Double Glass");
  });

  it("bills double glass by its pane count", () => {
    const config = makeConfig({
      glazing: {
        included: true,
        glazingType: "double",
        glazingItemId: null,
        label: "With Double Glass",
        unitRate: 0.35,
        sheets: 2,
        cutToMatOuter: true } });
    const glass = cutListRows(config, labels).find((row) => row.material === "Glass");
    expect(glass?.perCut).toBe("2 pc");
    // 2 frames × 2 panes
    expect(glass?.total).toBe("4 pcs");
  });
});

describe("a multi-size job on one requisition", () => {
  it("builds one row per size", () => {
    // The requisition is the document for the whole job, so several sizes each
    // get their own row — unlike the preview, which shows one at a time.
    const rows = [
      requisitionRow(makeConfig({ enteredLengthIn: 8, enteredWidthIn: 10 }), labels),
      requisitionRow(makeConfig({ enteredLengthIn: 12, enteredWidthIn: 10 }), labels),
    ];
    expect(rows.map((row) => row.artwork.lengthIn)).toEqual(["8", "12"]);
  });

  it("totals the cuts across every size", () => {
    const rows = [
      requisitionRow(makeConfig({ enteredLengthIn: 8, enteredWidthIn: 10, quantity: 2 }), labels),
      requisitionRow(makeConfig({ enteredLengthIn: 12, enteredWidthIn: 10, quantity: 3 }), labels),
    ];
    expect(rows.reduce((total, row) => total + row.quantity, 0)).toBe(5);
  });
});

describe("cutListRows — flattened across sizes", () => {
  // The cut list prints every size on the line, so the panel flattens several
  // calls into one table. Row keys are unique *within* a configuration, which
  // made "moulding" collide across sizes and threw a React duplicate-key error.
  const flatten = (configs: FrameConfiguration[]) =>
    configs.flatMap((config, sizeIndex) =>
      cutListRows(config, labels).map((row) => ({ ...row, key: `${sizeIndex}-${row.key}` }))
    );

  it("yields unique keys once several sizes are flattened", () => {
    const rows = flatten([
      makeConfig({ enteredLengthIn: 8, enteredWidthIn: 10 }),
      makeConfig({ enteredLengthIn: 12, enteredWidthIn: 10 }),
    ]);
    const keys = rows.map((row) => row.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("still prints every size's parts", () => {
    // Deduping by dropping rows would hide real cuts from the workshop.
    const one = cutListRows(makeConfig(), labels).length;
    expect(flatten([makeConfig(), makeConfig()])).toHaveLength(one * 2);
  });
});

describe("requisitionRow — framing instructions", () => {
  it("carries the note onto the row so it prints", () => {
    const row = requisitionRow(
      makeConfig({ framingInstructions: "Minimal mat reveal. Canvas torn top-left." }),
      labels
    );
    expect(row.instructions).toBe("Minimal mat reveal. Canvas torn top-left.");
  });

  it("prints nothing when no note was given", () => {
    // A blank heading on the requisition is worse than no heading.
    expect(requisitionRow(makeConfig(), labels).instructions).toBe("");
  });

  it("treats whitespace as no note", () => {
    expect(requisitionRow(makeConfig({ framingInstructions: "   " }), labels).instructions).toBe("");
  });

  it("never reaches the billed parts", () => {
    // Instructions are direction, not a component; they must not become a cut.
    const withNote = makeConfig({ framingInstructions: "Handle with care" });
    expect(cutListRows(withNote, labels)).toHaveLength(cutListRows(makeConfig(), labels).length);
    expect(
      requisitionRow(withNote, labels).articles.some((block) =>
        block.lines.some((line) => line.text.includes("Handle with care"))
      )
    ).toBe(false);
  });
});

describe("fractional hardware quantities on the job order", () => {
  const halfBox = () =>
    makeConfig({
      hardware: {
        flexipoints: { included: true, fraction: { numerator: 1, denominator: 2 }, unitRate: 1.5, itemId: "hw-flexi" },
        multipoints: { included: true, fraction: { numerator: 1, denominator: 8 }, unitRate: 8, itemId: "hw-multi" },
        lSupport: { included: false, size: "small", unitRate: 35, itemId: "hw-lsup" } } });

  it("prints the requisition in fractions, not decimals", () => {
    // The bench reads "×1/2" off the job order; "×0.5" makes them convert by hand.
    const finishing = articleBlocks(halfBox(), labels).find((b) => b.heading === "Finishing");
    expect(finishing?.lines[0].text).toContain("Flexipoints 1/2");
    expect(finishing?.lines[0].text).toContain("Multipoints 1/8");
    expect(finishing?.lines[0].text).not.toMatch(/0\.\d/);
  });

  it("prints the cut list in fractions too", () => {
    const rows = cutListRows(halfBox(), labels);
    const flexi = rows.find((row) => row.key === "flexipoints");
    expect(flexi?.spec).toBe("1/2");
    expect(rows.some((row) => /0\.\d/.test(row.spec) || /0\.\d/.test(row.total))).toBe(false);
  });

  it("prints the point size without a multiplication sign", () => {
    // "×1/8" read as a quantity on the bench — it is the size of the point, not
    // how many. The bare fraction matches the plain names either side of it.
    const finishing = articleBlocks(halfBox(), labels).find((b) => b.heading === "Finishing");
    expect(finishing?.lines[0].text).toContain("Flexipoints 1/2");
    expect(finishing?.lines[0].text).toContain("Multipoints 1/8");
    expect(finishing?.lines[0].text).not.toContain("×");
  });

  it("prints the fraction as typed, without reducing it", () => {
    // 2/4 bills double what 1/2 does, so the bench must see which was ordered.
    const unreduced = makeConfig({
      hardware: {
        flexipoints: {
          included: true,
          fraction: { numerator: 2, denominator: 4 },
          unitRate: 1.5,
          itemId: "hw-flexi" },
        multipoints: {
          included: false,
          fraction: { numerator: 1, denominator: 2 },
          unitRate: 8,
          itemId: "hw-multi" },
        lSupport: { included: false, size: "small", unitRate: 32, itemId: "hw-lsup" } } });
    const finishing = articleBlocks(unreduced, labels).find((b) => b.heading === "Finishing");
    expect(finishing?.lines[0].text).toContain("Flexipoints 2/4");
  });
});

describe("framing keeps fitting hardware off the paperwork", () => {
  // A line switched from chop & join carries its old hardware flags. Framing
  // has no hardware section — it is inside the frame rate — so the bench must
  // not be asked for parts the operator can no longer see or change.
  const withHardware = (billingMode: "chop_join" | "framing") =>
    makeConfig({
      billingMode,
      hardware: {
        flexipoints: {
          included: true,
          fraction: { numerator: 1, denominator: 2 },
          unitRate: 1.5,
          itemId: "hw-flexi",
        },
        multipoints: {
          included: true,
          fraction: { numerator: 1, denominator: 2 },
          unitRate: 8,
          itemId: "hw-multi",
        },
        lSupport: { included: true, size: "big", unitRate: 72, itemId: "hw-lsup" },
      },
    });

  it("lists hardware on a chop & join requisition", () => {
    const finishing = articleBlocks(withHardware("chop_join"), labels).find(
      (block) => block.heading === "Finishing"
    );
    expect(finishing?.lines[0].text).toContain("Flexipoints");
    expect(finishing?.lines[0].text).toContain("L-support");
  });

  it("omits it on a framing requisition", () => {
    const finishing = articleBlocks(withHardware("framing"), labels).find(
      (block) => block.heading === "Finishing"
    );
    expect(finishing?.lines[0].text ?? "").not.toContain("Flexipoints");
    expect(finishing?.lines[0].text ?? "").not.toContain("Multipoints");
    expect(finishing?.lines[0].text ?? "").not.toContain("L-support");
  });

  it("omits it from the framing cut list too", () => {
    const chopRows = cutListRows(withHardware("chop_join"), labels).map((row) => row.key);
    const framingRows = cutListRows(withHardware("framing"), labels).map((row) => row.key);
    expect(chopRows).toContain("flexipoints");
    expect(framingRows).not.toContain("flexipoints");
    expect(framingRows).not.toContain("multipoints");
    expect(framingRows).not.toContain("l_support");
  });
});
