export type ItemBatchQr = { itemId: string; batchNumber: string };

/** Strict item/batch identity; location and box-specific payloads are not accepted. */
export const parseItemBatchQr = (raw: string): ItemBatchQr | null => {
  if (raw.length > 1000) return null;
  try {
    const value: unknown = JSON.parse(raw.trim());
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const fields = value as Record<string, unknown>;
    if (
      Object.keys(fields).length !== 2 ||
      typeof fields.itemId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        fields.itemId
      ) ||
      typeof fields.batchNumber !== "string" ||
      !fields.batchNumber.trim() ||
      fields.batchNumber.trim().length > 100
    )
      return null;
    return { itemId: fields.itemId, batchNumber: fields.batchNumber.trim() };
  } catch {
    return null;
  }
};

export const serializeItemBatchQr = (value: ItemBatchQr): string => {
  const payload = JSON.stringify({ itemId: value.itemId, batchNumber: value.batchNumber });
  const parsed = parseItemBatchQr(payload);
  if (!parsed) throw new Error("Invalid item-batch label identity");
  return JSON.stringify(parsed);
};
