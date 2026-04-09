import { useQuery } from "@tanstack/react-query";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export type ShipmentStageFilter = "all" | "incoming" | "in_transit" | "arrived";

export type ShipmentsReportFilters = {
  page?: number;
  limit?: number;
  search?: string;
  supplierId?: string;
  shipmentStage?: ShipmentStageFilter;
  enabled?: boolean;
};

export type ShipmentsReportRow = {
  id: string;
  llNumber: string;
  supplierLlNumber: string | null;
  supplierName: string;
  supplierCode: string | null;
  warehouseName: string;
  warehouseCode: string | null;
  businessUnitName: string | null;
  containerNumber: string | null;
  sealNumber: string | null;
  batchNumber: string | null;
  linerName: string | null;
  shipmentStage: Exclude<ShipmentStageFilter, "all">;
  status: string;
  estimatedArrivalDate: string | null;
  actualArrivalDate: string | null;
  loadDate: string | null;
  itemCount: number;
  totalQuantity: number;
  totalValue: number;
  receivedQuantity: number;
  shortageQuantity: number;
  damagedQuantity: number;
  createdAt: string;
};

export type ShipmentsReportResponse = {
  data: ShipmentsReportRow[];
  summary: {
    totalShipments: number;
    totalContainers: number;
    totalQuantity: number;
    totalValue: number;
    incomingCount: number;
    inTransitCount: number;
    arrivedCount: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: {
    search: string | null;
    supplierId: string | null;
    shipmentStage: ShipmentStageFilter;
    currentBusinessUnitId: string | null;
  };
};

export function useShipmentsReport(filters: ShipmentsReportFilters) {
  const { enabled = true, ...queryFilters } = filters;

  return useQuery<ShipmentsReportResponse>({
    queryKey: ["shipments-report", queryFilters],
    enabled,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (queryFilters.page) params.append("page", String(queryFilters.page));
      if (queryFilters.limit) params.append("limit", String(queryFilters.limit));
      if (queryFilters.search) params.append("search", queryFilters.search);
      if (queryFilters.supplierId) params.append("supplierId", queryFilters.supplierId);
      if (queryFilters.shipmentStage) params.append("shipmentStage", queryFilters.shipmentStage);

      const response = await fetch(`${API_BASE_URL}/reports/shipments?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch shipments report");
      }

      return response.json();
    },
    staleTime: 60_000,
  });
}
