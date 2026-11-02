import type { CSSProperties } from "react";

export type LoadListLineColumn =
  | "item"
  | "unit"
  | "qty"
  | "totalQty"
  | "receivedQty"
  | "damagedQty"
  | "shortageQty"
  | "unitCost"
  | "lineTotal"
  | "action";

const LINE_COLUMN_WEIGHTS: Record<LoadListLineColumn, number> = {
  item: 33,
  unit: 15,
  qty: 9,
  totalQty: 10,
  receivedQty: 9,
  damagedQty: 9,
  shortageQty: 9,
  unitCost: 13,
  lineTotal: 11,
  action: 9,
};

type LoadListLineColumnOptions = {
  showReceipt: boolean;
  showUnitCost: boolean;
  showLineTotal: boolean;
  showAction: boolean;
};

export const getLoadListLineColumns = ({
  showReceipt,
  showUnitCost,
  showLineTotal,
  showAction,
}: LoadListLineColumnOptions): LoadListLineColumn[] => [
  "item",
  "unit",
  "qty",
  "totalQty",
  ...(showReceipt ? (["receivedQty", "damagedQty", "shortageQty"] as const) : []),
  ...(showUnitCost ? (["unitCost"] as const) : []),
  ...(showLineTotal ? (["lineTotal"] as const) : []),
  ...(showAction ? (["action"] as const) : []),
];

export const getLoadListLineColumnWidth = (
  columns: LoadListLineColumn[],
  column: LoadListLineColumn
) => {
  const totalWeight = columns.reduce((sum, current) => sum + LINE_COLUMN_WEIGHTS[current], 0);
  return `${(LINE_COLUMN_WEIGHTS[column] / totalWeight) * 100}%`;
};

// The New item grid and the lines table share these tracks so entry fields sit over their columns.
export const getLoadListLineGridStyle = (columns: LoadListLineColumn[]) =>
  ({
    "--load-list-line-columns": columns
      .map((column) => `minmax(0, ${LINE_COLUMN_WEIGHTS[column]}fr)`)
      .join(" "),
  }) as CSSProperties;
