// A line being edited on a create/edit document page before it is saved.
export type DocumentFormLine = {
  key: string;
  /** Id of the persisted line this row was loaded from; absent for lines added in this session. */
  savedLineId?: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  itemUnitOptionId: string;
  uomId: string;
  unitLabel: string;
  /** Plain UOM code for the "144 per BOX" hint; the unit label may already carry the quantity. */
  uomCode: string;
  qtyPerUnit: number;
  quantity: number;
  unitPrice: number;
  unitPriceCurrency: string | null;
  notes?: string;
};
