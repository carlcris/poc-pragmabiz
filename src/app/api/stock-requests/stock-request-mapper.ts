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
  packaging_id?: string | null;
  packaging?: {
    id: string;
    pack_name: string;
    qty_per_pack: number;
  } | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  items?: {
    item_code: string;
    item_name: string;
  } | null;
  units_of_measure?: {
    code: string;
    symbol: string;
  } | null;
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
  source_warehouse?: StockRequestLocation | null;
  destination_warehouse?: StockRequestLocation | null;
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
    ...rest
  } = record;

  return {
    ...rest,
    from_location_id: source_warehouse_id,
    to_location_id: destination_warehouse_id ?? null,
    from_location: source_warehouse
      ? {
          id: source_warehouse.id,
          warehouse_code: source_warehouse.warehouse_code,
          warehouse_name: source_warehouse.warehouse_name,
          businessUnitId: source_warehouse.business_unit_id ?? null,
        }
      : null,
    to_location: destination_warehouse
      ? {
          id: destination_warehouse.id,
          warehouse_code: destination_warehouse.warehouse_code,
          warehouse_name: destination_warehouse.warehouse_name,
          businessUnitId: destination_warehouse.business_unit_id ?? null,
        }
      : null,
    stock_request_items: stock_request_items?.map((item) => {
      const { packaging_id, packaging, ...restItem } = item;

      return {
        ...restItem,
        packagingId: packaging_id ?? null,
        packaging: packaging
          ? {
              id: packaging.id,
              name: packaging.pack_name,
              qtyPerPack: packaging.qty_per_pack,
            }
          : undefined,
      };
    }),
  };
};
