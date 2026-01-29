import { useQuery } from "@tanstack/react-query";

interface CommissionSummaryParams {
  dateFrom?: Date;
  dateTo?: Date;
  employeeId?: string;
}

interface CommissionSummary {
  totalCommission: number;
  totalSales: number;
  transactionCount: number;
  paidCommission: number;
  pendingCommission: number;
  uniqueEmployees: number;
  avgCommissionPerTransaction: number;
  effectiveRate: number;
}

interface CommissionRecord {
  id: string;
  invoiceCode: string;
  invoiceDate: string;
  invoiceAmount: number;
  invoiceStatus: string;
  employeeCode: string;
  employeeName: string;
  commissionRate: number;
  commissionAmount: number;
  splitPercentage: number;
  createdAt: string;
}

interface CommissionSummaryResponse {
  summary: CommissionSummary;
  commissions: CommissionRecord[];
}

export function useCommissionSummary(params?: CommissionSummaryParams) {
  return useQuery<CommissionSummaryResponse>({
    queryKey: ["commission", "summary", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();

      if (params?.dateFrom) {
        searchParams.set("dateFrom", params.dateFrom.toISOString().split("T")[0]);
      }
      if (params?.dateTo) {
        searchParams.set("dateTo", params.dateTo.toISOString().split("T")[0]);
      }
      if (params?.employeeId) {
        searchParams.set("employeeId", params.employeeId);
      }

      const response = await fetch(`/api/commission/summary?${searchParams.toString()}`);

      if (!response.ok) {
        throw new Error("Failed to fetch commission summary");
      }

      return response.json();
    },
  });
}
