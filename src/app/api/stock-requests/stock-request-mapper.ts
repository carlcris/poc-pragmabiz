import type { StockRequest, StockRequestPriority, StockRequestStatus } from "@/types/stock-request";

type StockRequestLocation = {
  id: string;
  warehouse_code: string;
  warehouse_name: string;
  business_unit_id?: string | null;
};

type StockRequestUser = {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
};

type StockRequestItem = {
  id: string;
  stock_request_id: string;
  item_id: string;
  requested_qty: number;
  picked_qty: number;
  uom_id: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  items?: {
    id?: string;
    item_code: string;
    item_name: string;
  } | { id?: string; item_code: string; item_name: string }[] | null;
  units_of_measure?: {
    code: string;
    symbol: string;
  } | { code: string; symbol: string }[] | null;
};

type DeliveryNoteSummary = {
  id: string;
  dn_no: string;
  status: string;
  created_at?: string | null;
};

type DeliveryNoteSource = {
  created_at?: string | null;
  delivery_notes?: DeliveryNoteSummary | DeliveryNoteSummary[] | null;
};

type StockRequestDbRecord = {
  id: string;
  company_id: string;
  business_unit_id?: string | null;
  request_code: string;
  request_date: string;
  required_date: string;
  requesting_warehouse_id: string;
  fulfilling_warehouse_id?: string | null;
  department?: string | null;
  status: StockRequestStatus;
  priority: StockRequestPriority;
  purpose?: string | null;
  notes?: string | null;
  requested_by_user_id: string;
  requested_by_name?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  picked_by?: string | null;
  picked_at?: string | null;
  received_by?: string | null;
  received_at?: string | null;
  created_at: string;
  created_by?: string | null;
  updated_at: string;
  updated_by?: string | null;
  deleted_at?: string | null;
  version: number;
  requesting_warehouse?: StockRequestLocation | StockRequestLocation[] | null;
  fulfilling_warehouse?: StockRequestLocation | StockRequestLocation[] | null;
  requested_by_user?: StockRequestUser | null;
  received_by_user?: StockRequestUser | null;
  stock_request_items?: StockRequestItem[] | null;
  delivery_note_sources?: DeliveryNoteSource[] | null;
};

export const mapStockRequest = (record: StockRequestDbRecord): StockRequest => {
  const {
    requesting_warehouse_id,
    fulfilling_warehouse_id,
    requesting_warehouse,
    fulfilling_warehouse,
    stock_request_items,
    delivery_note_sources,
    requested_by_user,
    received_by_user,
    ...rest
  } = record;
  const requestingWarehouse = Array.isArray(requesting_warehouse)
    ? requesting_warehouse[0] ?? null
    : requesting_warehouse ?? null;
  const fulfillingWarehouse = Array.isArray(fulfilling_warehouse)
    ? fulfilling_warehouse[0] ?? null
    : fulfilling_warehouse ?? null;
  const requestedByUser = Array.isArray(requested_by_user)
    ? requested_by_user[0] ?? null
    : requested_by_user ?? null;
  const receivedByUser = Array.isArray(received_by_user)
    ? received_by_user[0] ?? null
    : received_by_user ?? null;
  const linkedDeliveryNotes = (delivery_note_sources || [])
    .map((source) =>
      Array.isArray(source.delivery_notes)
        ? source.delivery_notes[0] ?? null
        : source.delivery_notes ?? null
    )
    .filter((note): note is DeliveryNoteSummary => Boolean(note));
  const sortedDeliveryNotes = [...linkedDeliveryNotes].sort(
    (a, b) => new Date(String(b.created_at || "")).getTime() - new Date(String(a.created_at || "")).getTime()
  );
  const fulfillingDeliveryNotes = Array.from(
    new Map(
      sortedDeliveryNotes.map((note) => [
        note.id,
        {
          id: note.id,
          dn_no: note.dn_no,
          status: note.status,
          created_at: note.created_at ?? null,
        },
      ])
    ).values()
  );
  const fulfillingDeliveryNote = fulfillingDeliveryNotes[0] || null;

  return {
    ...rest,
    requesting_warehouse_id,
    fulfilling_warehouse_id: fulfilling_warehouse_id ?? null,
    requesting_warehouse: requestingWarehouse
      ? {
          id: requestingWarehouse.id,
          warehouse_code: requestingWarehouse.warehouse_code,
          warehouse_name: requestingWarehouse.warehouse_name,
          businessUnitId: requestingWarehouse.business_unit_id ?? null,
        }
      : null,
    fulfilling_warehouse: fulfillingWarehouse
      ? {
          id: fulfillingWarehouse.id,
          warehouse_code: fulfillingWarehouse.warehouse_code,
          warehouse_name: fulfillingWarehouse.warehouse_name,
          businessUnitId: fulfillingWarehouse.business_unit_id ?? null,
        }
      : null,
    fulfilling_delivery_note: fulfillingDeliveryNote
      ? {
          id: fulfillingDeliveryNote.id,
          dn_no: fulfillingDeliveryNote.dn_no,
          status: fulfillingDeliveryNote.status,
          created_at: fulfillingDeliveryNote.created_at ?? null,
        }
      : null,
    fulfilling_delivery_notes: fulfillingDeliveryNotes,
    requested_by_user: requestedByUser ?? undefined,
    received_by_user: receivedByUser ?? undefined,
    stock_request_items: stock_request_items?.map((item) => {
      const { ...restItem } = item;
      const itemDetails = Array.isArray(item.items) ? item.items[0] ?? null : item.items ?? null;
      const uomDetails = Array.isArray(item.units_of_measure)
        ? item.units_of_measure[0] ?? null
        : item.units_of_measure ?? null;

      return {
        ...restItem,
        items: itemDetails
          ? {
              id: itemDetails.id ?? item.item_id,
              item_code: itemDetails.item_code,
              item_name: itemDetails.item_name,
            }
          : undefined,
        units_of_measure: uomDetails
          ? {
              id: item.uom_id,
              code: uomDetails.code,
              symbol: uomDetails.symbol,
            }
          : undefined,
      };
    }),
  };
};
