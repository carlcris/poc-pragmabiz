import type { CSSProperties } from "react";

// Quantities that track a saved document's progress after it leaves draft.
export type DocumentTrackingColumn =
  | "receivedQty"
  | "damagedQty"
  | "shortageQty"
  | "fulfilledQty"
  | "outstandingQty"
  | "deliveredQty";

export type DocumentLineColumn =
  | "item"
  | "unit"
  | "qty"
  | "totalQty"
  | DocumentTrackingColumn
  | "batch"
  | "unitCost"
  | "lineTotal"
  | "action";

const LINE_COLUMN_WEIGHTS: Record<DocumentLineColumn, number> = {
  item: 33,
  unit: 15,
  qty: 9,
  totalQty: 10,
  receivedQty: 9,
  damagedQty: 9,
  shortageQty: 9,
  fulfilledQty: 10,
  outstandingQty: 11,
  deliveredQty: 10,
  batch: 20,
  unitCost: 13,
  lineTotal: 11,
  action: 9,
};

type DocumentLineColumnOptions = {
  trackingColumns: readonly DocumentTrackingColumn[];
  showBatch?: boolean;
  showUnitCost: boolean;
  showLineTotal: boolean;
  showAction: boolean;
};

export const getDocumentLineColumns = ({
  trackingColumns,
  showBatch = false,
  showUnitCost,
  showLineTotal,
  showAction,
}: DocumentLineColumnOptions): DocumentLineColumn[] => [
  "item",
  "unit",
  "qty",
  "totalQty",
  ...trackingColumns,
  ...(showBatch ? (["batch"] as const) : []),
  ...(showUnitCost ? (["unitCost"] as const) : []),
  ...(showLineTotal ? (["lineTotal"] as const) : []),
  ...(showAction ? (["action"] as const) : []),
];

export const getDocumentLineColumnWidth = (
  columns: DocumentLineColumn[],
  column: DocumentLineColumn
) => {
  const totalWeight = columns.reduce((sum, current) => sum + LINE_COLUMN_WEIGHTS[current], 0);
  return `${(LINE_COLUMN_WEIGHTS[column] / totalWeight) * 100}%`;
};

// The New item grid and the lines table share these tracks so entry fields sit over their columns.
export const getDocumentLineGridStyle = (columns: DocumentLineColumn[]) =>
  ({
    "--document-line-columns": columns
      .map((column) => `minmax(0, ${LINE_COLUMN_WEIGHTS[column]}fr)`)
      .join(" "),
  }) as CSSProperties;
