/**
 * Turning a saved quotation line back into an editable frame configuration.
 *
 * The inverse of `toLineItem`. Editing a configured line has to reopen the same
 * dialog it was created in — otherwise a chop & join line drops into the plain
 * item form and re-saving silently discards its geometry, mats and components.
 *
 * Everything here comes from stored columns rather than being inferred from the
 * component rows: component descriptions are printed text, and reading a glass
 * type back out of "19 11/16 X 16 11/16 - With Double Glass" would be guesswork.
 */

import { glazingFallbackLabel, backingFallbackLabel } from "./types";
import type { FrameConfiguration, GlazingType, BackingType, MatLayer } from "./types";
import type { ItemSelectOption } from "@/components/common/ItemSelect";
import type {
  FrameQuotationComponent,
  FrameQuotationConfiguration,
  FrameQuotationMatLayer,
  FrameQuotationSize,
} from "@/types/quotation";

const DEFAULT_GLASS_RATE = 0.35;
const DEFAULT_BACKING_RATE = 0.16;

export type SavedFrameLine = {
  itemId?: string;
  itemCode?: string;
  itemName?: string;
  quantity: number;
  unitPrice?: number;
  frameConfiguration?: FrameQuotationConfiguration | null;
  frameComponents?: FrameQuotationComponent[];
  matLayers?: FrameQuotationMatLayer[];
};

export type RestoredFrame = {
  config: FrameConfiguration;
  selections: {
    moulding: ItemSelectOption | null;
    matBoards: Record<number, ItemSelectOption | null>;
    glazing: ItemSelectOption | null;
    backing: ItemSelectOption | null;
  };
};

/** A line is configurable when it carries a frame configuration. */
export function isConfiguredLine(line: SavedFrameLine): boolean {
  return Boolean(line.frameConfiguration);
}

const option = (
  id: string | undefined,
  code: string | undefined,
  name: string | undefined,
  uomId: string
): ItemSelectOption | null =>
  id ? { id, code: code ?? "", name: name ?? "", uom: "", uomId, listPrice: 0 } : null;

/**
 * Rebuild the editable configuration for a saved line.
 *
 * Returns null when the line is not a configured frame, so the caller can fall
 * back to the plain item dialog.
 */
export function frameLineToConfig(
  line: SavedFrameLine,
  fallbackUomId: string
): RestoredFrame | null {
  const stored = line.frameConfiguration;
  if (!stored) return null;

  const layers: MatLayer[] = (line.matLayers ?? [])
    .slice()
    .sort((a, b) => a.layerIndex - b.layerIndex)
    .map((layer, position) => ({
      layerIndex: position,
      matBoardItemId: layer.matBoardItemId,
    }));

  // `matIncluded` was added alongside the type columns; a line saved before that
  // still has its mat layers, so their presence is the fallback signal.
  const matIncluded = stored.matIncluded ?? layers.length > 0;
  const glazingType = (stored.glazingType ?? "clear") as GlazingType;
  const backingType = (stored.backingType ?? null) as BackingType | null;

  // The moulding's rate is not stored on the configuration, but the component
  // row it produced carries it.
  const mouldingComponent = (line.frameComponents ?? []).find(
    (component) => component.componentType === "molding"
  );
  const glazingComponent = (line.frameComponents ?? []).find(
    (component) => component.itemId && component.description?.includes(glazingFallbackLabel(glazingType))
  );

  const config: FrameConfiguration = {
    billingMode: stored.billingMode ?? "framing",
    quantity: Math.max(1, line.quantity || 1),
    sizeMode: stored.sizeMode ?? "artwork",
    // `artworkLengthIn` is what the user typed in artwork mode; in outside mode
    // the entered pair was the finished size, which is width/height.
    enteredLengthIn:
      stored.sizeMode === "outside" ? stored.height : (stored.artworkLengthIn ?? stored.height),
    enteredWidthIn:
      stored.sizeMode === "outside" ? stored.width : (stored.artworkWidthIn ?? stored.width),
    frameWidthIn: stored.frameWidthIn ?? 0,
    frameRate: stored.frameRate ?? 0,
    overlapIn: stored.overlapIn ?? 0,
    moulding: {
      itemId: stored.moldingItemId ?? line.itemId ?? "",
      code: stored.moldingItemCode ?? line.itemCode ?? "",
      name: stored.moldingItemName ?? line.itemName ?? "",
      unitRate: mouldingComponent?.unitRate ?? 0,
      material: (stored.mouldingMaterial as FrameConfiguration["moulding"]["material"]) ?? null,
    },
    mat: {
      included: matIncluded,
      source: stored.matSource ?? "store",
      border: {
        lengthIn: stored.matBorderLIn ?? 0,
        widthIn: stored.matBorderWIn ?? 0,
      },
      // Layers all share one rate now; a line saved with per-layer rates takes
      // the first, which is the top mat.
      unitRate: stored.matUnitRate ?? 0,
      layers,
    },
    glazing: {
      included: stored.glazingIncluded ?? Boolean(glazingComponent),
      glazingType,
      glazingItemId: glazingComponent?.itemId ?? null,
      label: glazingFallbackLabel(glazingType),
      unitRate: stored.glazingUnitRate ?? glazingComponent?.unitRate ?? DEFAULT_GLASS_RATE,
      sheets: stored.glazingSheets ?? 1,
      cutToMatOuter: stored.glazingCutToMatOuter ?? true,
    },
    backing: {
      backingType,
      backingItemId: null,
      label: backingType ? backingFallbackLabel(backingType) : "",
      unitRate: stored.backingUnitRate ?? DEFAULT_BACKING_RATE,
      thicknessIn: stored.backingThicknessIn ?? undefined,
    },
    // Hardware is reconstructed from its component rows: quantity and rate are
    // both on the row, and presence of the row is what "included" means.
    hardware: restoreHardware(line.frameComponents ?? [], stored),
    framingInstructions: stored.framingInstructions ?? undefined,
    componentDiscounts: stored.componentDiscounts ?? undefined,
    // Attachments come back on their own rows, not derived from anything.
    attachments: (stored.attachments ?? []).map((attachment) => ({
      id: attachment.id,
      storagePath: attachment.storagePath,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      fileSizeBytes: attachment.fileSizeBytes,
    })),
  };

  const matBoards: Record<number, ItemSelectOption | null> = {};
  (line.matLayers ?? [])
    .slice()
    .sort((a, b) => a.layerIndex - b.layerIndex)
    .forEach((layer, position) => {
      matBoards[position] = option(
        layer.matBoardItemId,
        layer.matBoardItemCode,
        layer.matBoardItemName,
        fallbackUomId
      );
    });

  return {
    config,
    selections: {
      moulding: option(
        config.moulding.itemId,
        config.moulding.code,
        config.moulding.name,
        fallbackUomId
      ),
      matBoards,
      // Glass and backing are types, not catalogue picks — no option to restore.
      glazing: null,
      backing: null,
    },
  };
}

/**
 * Rebuild fitting hardware from the accessory component rows.
 *
 * The point fractions come from the configuration row rather than the component
 * rows: the component only stores a decimal `qtyPerFrame`, which cannot tell
 * `1/2` from `2/4` — a distinction that changes the price.
 */
function restoreHardware(
  components: FrameQuotationComponent[],
  stored: FrameQuotationConfiguration
): FrameConfiguration["hardware"] {
  const find = (needle: string) =>
    components.find(
      (component) =>
        component.componentType === "accessory" &&
        component.description?.toLowerCase().includes(needle)
    );

  const flexi = find("flexipoint");
  const multi = find("multipoint");
  const support = find("l-support");

  const flexipointsFraction = {
    numerator: stored.flexipointsNumerator ?? 1,
    denominator: stored.flexipointsDenominator ?? 2,
  };
  const multipointsFraction = {
    numerator: stored.multipointsNumerator ?? 1,
    denominator: stored.multipointsDenominator ?? 2,
  };

  return {
    flexipoints: {
      included: Boolean(flexi),
      fraction: flexipointsFraction,
      unitRate: flexi?.unitRate ?? 1.5,
      itemId: flexi?.itemId ?? null,
    },
    multipoints: {
      included: Boolean(multi),
      fraction: multipointsFraction,
      unitRate: multi?.unitRate ?? 8,
      itemId: multi?.itemId ?? null,
    },
    lSupport: {
      included: Boolean(support),
      size: support?.description?.toLowerCase().includes("big") ? "big" : "small",
      unitRate: support?.unitRate ?? 32,
      itemId: support?.itemId ?? null,
    },
  };
}

/**
 * Rebuild every size on a saved line, so editing reopens the whole job.
 *
 * A line without a `frameSizes` list is single-size and yields one entry, so the
 * caller never has to care which it was.
 */
export function frameLineToSizes(
  line: SavedFrameLine & { frameSizes?: FrameQuotationSize[] },
  fallbackUomId: string
): RestoredFrame[] {
  if (line.frameSizes && line.frameSizes.length > 0) {
    return line.frameSizes
      .map((size) =>
        frameLineToConfig(
          {
            // Each size restores as though it were its own line — the quantity
            // is per size, not the line's total frame count.
            itemId: size.frameConfiguration.moldingItemId ?? line.itemId,
            itemCode: size.frameConfiguration.moldingItemCode ?? line.itemCode,
            itemName: size.frameConfiguration.moldingItemName ?? line.itemName,
            quantity: size.frameConfiguration.frameQuantity ?? 1,
            frameConfiguration: size.frameConfiguration,
            frameComponents: size.frameComponents,
            matLayers: size.matLayers,
          },
          fallbackUomId
        )
      )
      .filter((restored): restored is RestoredFrame => restored !== null);
  }

  const single = frameLineToConfig(line, fallbackUomId);
  return single ? [single] : [];
}
