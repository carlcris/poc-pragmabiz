/**
 * The two generated documents, built from a live configuration.
 *
 * These follow `docs/prototypes/chop-and-join-final.html`, which is the approved
 * visual source of truth for both:
 *
 *   Job requisition — customer-facing, mirrors the shop's paper form
 *   Cut list        — workshop-facing: what to cut, to what size, how many
 *
 * The row-building logic here is a port of the prototype's `artParts()` and
 * `renderCut()`. Dimensions print as fractions rather than the prototype's
 * decimals, matching the paper receipts and the rest of the app.
 */

import { formatInches } from "./formatInches";
import { formatFraction } from "./pointFraction";
import {
  CUT_CLEARANCE_IN,
  MAT_REVEAL_IN,
  areaSqIn,
  glazingCutSize,
  mouldingFootage,
  resolveGeometry,
} from "./geometry";
import { matCountLabel } from "./pricing";
import { backingLabel } from "./types";
import type {
  FrameConfiguration,
  MatBoardSheet,
  MatBorder,
  MatSource,
} from "./types";

/** Labels for a mat layer by depth, top-down. */
const MAT_LAYER_LABELS = ["Top mat", "2nd mat", "3rd mat"] as const;

const layerLabel = (index: number) => MAT_LAYER_LABELS[index] ?? `Mat layer ${index + 1}`;

/** Names for the item behind each configured component, resolved by the caller. */
export type DocumentLabels = {
  moulding: string;
  matBoards: Record<number, string | undefined>;
  /** Fallback only — glass is chosen by type, so `config.glazing.label` wins. */
  glazing?: string;
  backing?: string;
};

/**
 * One block of the "Article / Description" column: a heading and its lines.
 *
 * The column used to be a flat bullet list ending in a single run-on line —
 * "… -(Store) w/ With Double Glass w/ MDF w/ Flexi ×8" — with "w/" repeated for
 * every part and no grouping. Three fixed headings (Moulding / Matting /
 * Finishing) put each part in a predictable place instead.
 */
export type ArticleBlock = {
  heading: string;
  /** Lines under the heading. `bullet` marks a mat layer, which prints indented. */
  lines: { text: string; bullet?: boolean }[];
  /** The moulding block is what the shop reads first. */
  emphasis?: boolean;
};

/**
 * The border or reveal a mat layer is cut to.
 *
 * The top mat shows a *border* — the band from its outer edge to its opening.
 * Layers beneath show a *reveal*, the sliver of colour visible below the layer
 * above. They are different measurements and the workshop cuts to both, so the
 * wording follows the position rather than being called "border" throughout.
 *
 * Equal length and width collapse to one figure; the shop writes 2″ rather than
 * 2″ × 2″ when a border is even.
 */
function matBorderText(border: MatBorder): string {
  const lengthIn = formatInches(border.lengthIn);
  const widthIn = formatInches(border.widthIn);
  const size = lengthIn === widthIn ? `${lengthIn}″` : `${lengthIn}″ × ${widthIn}″`;
  return `border ${size}`;
}

/**
 * Whether fitting hardware belongs on this line's paperwork.
 *
 * Only chop & join chooses and bills it. Framing rolls it into the frame rate
 * and hides the section entirely, so a line reopened in framing mode must not
 * print flags it can no longer edit.
 */
function showsHardware(config: FrameConfiguration): boolean {
  return config.billingMode === "chop_join";
}

const matSourceWord = (source: MatSource) =>
  source === "store" ? "store-supplied" : "customer-supplied";

/**
 * Build the grouped blocks for the requisition's Article / Description column.
 *
 * Empty groups are omitted rather than printed as "None" — a frame with no mat
 * should not carry a Matting heading at all.
 */
export function articleBlocks(
  config: FrameConfiguration,
  labels: DocumentLabels
): ArticleBlock[] {
  const blocks: ArticleBlock[] = [];

  blocks.push({
    heading: "Moulding",
    lines: [{ text: labels.moulding }],
    emphasis: true,
  });

  if (config.mat.included && config.mat.layers.length > 0) {
    const count = config.mat.layers.length;
    const multiLayer = count > 1;
    const named = config.mat.layers
      .map((_, index) => ({ index, name: labels.matBoards[index] }))
      .filter((entry): entry is { index: number; name: string } => Boolean(entry.name));

    blocks.push({
      // "Matting — triple, store-supplied": the count and who supplied the board
      // belong on the heading, so the lines below are purely the boards.
      heading: `Matting — ${matCountLabel(count).toLowerCase().replace(" matting", "")}, ${matSourceWord(config.mat.source)}`,
      lines: named.map(({ index, name }) => ({
        // With one mat the position needs no qualifier; "Top mat" on a lone
        // layer reads as though a second is missing. The border itself lives in
        // the left pane, beside the sizes it produces.
        text: multiLayer ? `${layerLabel(index)} — ${name}` : name,
        bullet: true,
      })),
    });
  }

  // Glass, backing and hardware are all "what finishes the frame" — one group,
  // separated by middots rather than a repeated "w/".
  const finishing: string[] = [];
  const glazingName = config.glazing.label || labels.glazing;
  if (config.glazing.included && glazingName) finishing.push(glazingName);
  if (config.backing.backingType && labels.backing) finishing.push(`${labels.backing} backing`);

  const { flexipoints, multipoints, lSupport } = config.hardware;
  // Framing has no fitting-hardware section — it is inside the frame rate — so
  // the requisition must not list hardware the operator cannot see or change.
  // A line switched from chop & join keeps its old flags, which would otherwise
  // print here.
  // No "×" before the fraction: it is the size of the point, not how many of
  // them, and the multiplication sign told the bench to read it as a count.
  // Bare, it matches the plain names either side of it — "MDF backing",
  // "L-support (small)".
  if (showsHardware(config)) {
    if (flexipoints.included) finishing.push(`Flexipoints ${formatFraction(flexipoints.fraction)}`);
    if (multipoints.included) finishing.push(`Multipoints ${formatFraction(multipoints.fraction)}`);
    if (lSupport.included) finishing.push(`L-support (${lSupport.size})`);
  }

  if (finishing.length > 0) {
    blocks.push({ heading: "Finishing", lines: [{ text: finishing.join(" · ") }] });
  }

  return blocks;
}

/** The single row of the requisition table. */
export type RequisitionRow = {
  quantity: number;
  unit: string;
  /** Artwork size — the pair the customer gave. */
  artwork: { lengthIn: string; widthIn: string };
  /**
   * The mat's outer edge — the size the board is actually cut to, and what the
   * border produces. Null when the frame has no mat.
   */
  matOuter: { lengthIn: string; widthIn: string } | null;
  /**
   * What each mat layer is cut to, printed under the sizes: a border on the top
   * mat, a reveal on the layers beneath. Empty when the frame has no mat.
   */
  matBorders: { label: string; text: string }[];
  articles: ArticleBlock[];
  /**
   * Bench direction for this frame, printed under its article blocks. Empty
   * when none was given — the requisition should not carry a blank heading.
   */
  instructions: string;
};

export function requisitionRow(
  config: FrameConfiguration,
  labels: DocumentLabels
): RequisitionRow {
  const geometry = resolveGeometry(config);
  return {
    quantity: Math.max(1, config.quantity),
    unit: "CUT",
    artwork: {
      lengthIn: formatInches(geometry.artwork.lengthIn),
      widthIn: formatInches(geometry.artwork.widthIn),
    },
    matOuter: geometry.matOuter
      ? {
          lengthIn: formatInches(geometry.matOuter.lengthIn),
          widthIn: formatInches(geometry.matOuter.widthIn),
        }
      : null,
    // One border for the stack, then the fixed reveal each extra mat takes from
    // within it — the layers no longer carry measurements of their own.
    matBorders:
      config.mat.included && config.mat.layers.length > 0
        ? [
            { label: "", text: matBorderText(config.mat.border) },
            ...(config.mat.layers.length > 1
              ? [
                  {
                    label: "",
                    text: `${config.mat.layers.length - 1} × reveal ${formatInches(MAT_REVEAL_IN)}″`,
                  },
                ]
              : []),
          ]
        : [],
    articles: articleBlocks(config, labels),
    instructions: config.framingInstructions?.trim() ?? "",
  };
}

/** One line of the workshop cut list. */
export type CutListRow = {
  key: string;
  material: string;
  spec: string;
  perCut: string;
  total: string;
};

/**
 * The production cut list — port of the prototype's `renderCut()`.
 *
 * Every row answers the same three questions for the person at the saw: what
 * material, cut to what, and how many.
 */
export function cutListRows(
  config: FrameConfiguration,
  labels: DocumentLabels
): CutListRow[] {
  const geometry = resolveGeometry(config);
  const quantity = Math.max(1, config.quantity);
  const rows: CutListRow[] = [];

  const footage = mouldingFootage(geometry.outside);
  rows.push({
    key: "moulding",
    material: "Moulding",
    spec: labels.moulding,
    perCut: `${footage.toFixed(1)} ft`,
    total: `${(footage * quantity).toFixed(1)} ft`,
  });

  if (config.mat.included) {
    config.mat.layers.forEach((layer, index) => {
      const opening = geometry.openings[index];
      const outer = geometry.matOuter;
      const name = labels.matBoards[index] ?? "Mat board";
      const outerText = outer
        ? `outer ${formatInches(outer.lengthIn)}″ × ${formatInches(outer.widthIn)}″ · `
        : "";
      const openingText = opening
        ? `opening ${formatInches(opening.lengthIn)}″ × ${formatInches(opening.widthIn)}″`
        : "";
      rows.push({
        key: `mat-${layer.layerIndex}`,
        material: layerLabel(index),
        spec: `${name} · ${outerText}${openingText}`,
        perCut: "1 pc",
        total: `${quantity} pcs`,
      });
    });
  }

  // Glass and backing share the clearance-cut size.
  const cut = glazingCutSize(config, geometry);
  const cutText = `cut ${formatInches(cut.lengthIn)}″ × ${formatInches(cut.widthIn)}″`;

  if (config.glazing.included) {
    const sheets = Math.max(1, config.glazing.sheets);
    rows.push({
      key: "glazing",
      material: "Glass",
      spec: `${config.glazing.label || labels.glazing || "Glass"} — ${cutText}`,
      perCut: `${sheets} pc`,
      total: `${sheets * quantity} pcs`,
    });
  }

  if (config.backing.backingType) {
    rows.push({
      key: "backing",
      material: "Backing",
      spec: `${labels.backing ?? backingLabel(config.backing)} — ${cutText}`,
      perCut: "1 pc",
      total: `${quantity} pcs`,
    });
  }

  const { flexipoints, multipoints, lSupport } = config.hardware;
  // Same gate as the requisition: framing has no hardware section, so its cut
  // list must not ask the bench for parts the line never chose.
  const withHardware = showsHardware(config);
  // The fraction is the size the workshop cuts to, so it belongs in `spec`.
  // Multiplying it by the frame count would be meaningless — one set per frame.
  if (withHardware && flexipoints.included) {
    rows.push({
      key: "flexipoints",
      material: "Flexipoints",
      spec: formatFraction(flexipoints.fraction),
      perCut: "1",
      total: String(quantity),
    });
  }
  if (withHardware && multipoints.included) {
    rows.push({
      key: "multipoints",
      material: "Multipoints",
      spec: formatFraction(multipoints.fraction),
      perCut: "1",
      total: String(quantity),
    });
  }
  if (withHardware && lSupport.included) {
    // The prototype fixes L-supports at four per frame, one per corner.
    rows.push({
      key: "l_support",
      material: "L-support",
      spec: lSupport.size,
      perCut: "4",
      total: String(4 * quantity),
    });
  }

  return rows;
}

/**
 * Whether every mat layer fits the sheet it is cut from.
 *
 * Returns the warning text, or null when everything clears. A mat is rotatable,
 * so both dimensions are compared sorted.
 */
export function sheetFitWarning(
  config: FrameConfiguration,
  sheets: Record<number, MatBoardSheet | undefined>
): string | null {
  if (!config.mat.included) return null;
  const geometry = resolveGeometry(config);
  const outer = geometry.matOuter;
  if (!outer) return null;

  const need = [outer.lengthIn, outer.widthIn].sort((a, b) => a - b);

  for (let index = 0; index < config.mat.layers.length; index += 1) {
    const sheet = sheets[index];
    if (!sheet) continue;
    const have = [sheet.sheetLengthIn, sheet.sheetWidthIn].sort((a, b) => a - b);
    if (need[0] > have[0] || need[1] > have[1]) {
      return `${sheet.label} sheets are ${formatInches(sheet.sheetLengthIn)}″ × ${formatInches(
        sheet.sheetWidthIn
      )}″ — too small for a ${formatInches(outer.lengthIn)}″ × ${formatInches(
        outer.widthIn
      )}″ mat. Choose a bigger board or reduce the border.`;
    }
  }

  return null;
}

export { CUT_CLEARANCE_IN, areaSqIn };
