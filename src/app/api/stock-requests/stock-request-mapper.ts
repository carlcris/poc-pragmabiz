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

type StockRequestDbRecord = {
  id: string;
  company_id: string;
  business_unit_id?: string | null;
  request_code: string;
  request_date: string;
  required_date: string;
  source_warehouse_id: string;
  destination_warehouse_id?: string | null;
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
  source_warehouse?: StockRequestLocation | StockRequestLocation[] | null;
  destination_warehouse?: StockRequestLocation | StockRequestLocation[] | null;
  requested_by_user?: StockRequestUser | null;
  received_by_user?: StockRequestUser | null;
  stock_request_items?: StockRequestItem[] | null;
};

export const mapStockRequest = (record: StockRequestDbRecord): StockRequest => {
  const {
    source_warehouse_id,
    destination_warehouse_id,
    source_warehouse,
    destination_warehouse,
    stock_request_items,
    requested_by_user,
    received_by_user,
    ...rest
  } = record;
  const sourceWarehouse = Array.isArray(source_warehouse)
    ? source_warehouse[0] ?? null
    : source_warehouse ?? null;
  const destinationWarehouse = Array.isArray(destination_warehouse)
    ? destination_warehouse[0] ?? null
    : destination_warehouse ?? null;
  const requestedByUser = Array.isArray(requested_by_user)
    ? requested_by_user[0] ?? null
    : requested_by_user ?? null;
  const receivedByUser = Array.isArray(received_by_user)
    ? received_by_user[0] ?? null
    : received_by_user ?? null;

  return {
    ...rest,
    from_location_id: source_warehouse_id,
    to_location_id: destination_warehouse_id ?? null,
    from_location: sourceWarehouse
      ? {
          id: sourceWarehouse.id,
          warehouse_code: sourceWarehouse.warehouse_code,
          warehouse_name: sourceWarehouse.warehouse_name,
          businessUnitId: sourceWarehouse.business_unit_id ?? null,
        }
      : null,
    to_location: destinationWarehouse
      ? {
          id: destinationWarehouse.id,
          warehouse_code: destinationWarehouse.warehouse_code,
          warehouse_name: destinationWarehouse.warehouse_name,
          businessUnitId: destinationWarehouse.business_unit_id ?? null,
        }
      : null,
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
