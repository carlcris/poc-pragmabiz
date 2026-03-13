import { useQuery } from "@tanstack/react-query";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export type ShipmentStageFilter = "all" | "incoming" | "in_transit" | "arrived";

export type ShipmentsReportFilters = {
  page?: number;
  limit?: number;
  search?: string;
  supplierId?: string;
  shipmentStage?: ShipmentStageFilter;
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
  return useQuery<ShipmentsReportResponse>({
    queryKey: ["shipments-report", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.page) params.append("page", String(filters.page));
      if (filters.limit) params.append("limit", String(filters.limit));
      if (filters.search) params.append("search", filters.search);
      if (filters.supplierId) params.append("supplierId", filters.supplierId);
      if (filters.shipmentStage) params.append("shipmentStage", filters.shipmentStage);

      const response = await fetch(`${API_BASE_URL}/reports/shipments?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch shipments report");
      }

      return response.json();
    },
    staleTime: 60_000,
  });
}
