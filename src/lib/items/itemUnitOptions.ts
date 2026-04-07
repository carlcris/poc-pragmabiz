import type { ItemUnitOption } from "@/types/item";

type DbUnitOfMeasure = {
  id: string;
  code: string;
  name: string;
  symbol: string | null;
};

export type DbItemUnitOptionRow = {
  id: string;
  item_id: string;
  uom_id: string;
  option_label: string | null;
  qty_per_unit: number | string;
  barcode: string;
  is_base: boolean;
  is_default: boolean;
  is_active: boolean;
  sort_order: number | null;
  units_of_measure: DbUnitOfMeasure | DbUnitOfMeasure[] | null;
};

const formatQtyPerUnit = (value: number | string): string => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return String(value);
  if (Number.isInteger(parsed)) return String(parsed);
  return parsed.toFixed(4).replace(/\.?0+$/, "");
};

export const buildItemUnitOptionDisplayLabel = (
  uomCode: string,
  qtyPerUnit: number | string,
  baseUomCode: string,
  optionLabel?: string | null
): string => {
  if (optionLabel && optionLabel.trim()) {
    return optionLabel.trim();
  }

  const formattedQty = formatQtyPerUnit(qtyPerUnit);
  if (formattedQty === "1" && uomCode === baseUomCode) {
    return uomCode;
  }

  return `${uomCode} (${formattedQty} ${baseUomCode})`;
};

export const transformItemUnitOptionRow = (
  row: DbItemUnitOptionRow,
  baseUomCode: string
): ItemUnitOption => {
  const uom = Array.isArray(row.units_of_measure) ? row.units_of_measure[0] : row.units_of_measure;
  const uomCode = uom?.code || "";

  return {
    id: row.id,
    itemId: row.item_id,
    uomId: row.uom_id,
    uomCode,
    uomName: uom?.name || "",
    uomSymbol: uom?.symbol || undefined,
    optionLabel: row.option_label || undefined,
    displayLabel: buildItemUnitOptionDisplayLabel(uomCode, row.qty_per_unit, baseUomCode, row.option_label),
    qtyPerUnit: Number(row.qty_per_unit) || 0,
    barcode: row.barcode,
    isBase: row.is_base,
    isDefault: row.is_default,
    isActive: row.is_active,
    sortOrder: row.sort_order ?? 0,
  };
};

export const sortItemUnitOptions = (options: ItemUnitOption[]): ItemUnitOption[] =>
  [...options].sort((a, b) => {
    if (a.isBase !== b.isBase) return a.isBase ? -1 : 1;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.displayLabel.localeCompare(b.displayLabel);
  });

export const getPrimaryItemUnitOption = (options: ItemUnitOption[]): ItemUnitOption | null =>
  options.find((option) => option.isBase) ||
  options.find((option) => option.isDefault) ||
  options[0] ||
  null;
