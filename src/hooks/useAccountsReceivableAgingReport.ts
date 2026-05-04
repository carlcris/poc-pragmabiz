import { useQuery } from "@tanstack/react-query";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export type AccountsReceivableAgingBucket =
  | "all"
  | "current"
  | "1_30"
  | "31_60"
  | "61_90"
  | "90_plus";

export type AccountsReceivableAgingReportFilters = {
  asOfDate?: string;
  customerId?: string;
  bucket?: AccountsReceivableAgingBucket;
  search?: string;
  page?: number;
  limit?: number;
  enabled?: boolean;
};

export type AccountsReceivableAgingReportRow = {
  customerId: string;
  customerCode: string;
  customerName: string;
  invoiceId: string;
  invoiceCode: string;
  invoiceDate: string;
  dueDate: string;
  status: string;
  totalAmount: number;
  amountPaid: number;
  balance: number;
  daysOverdue: number;
  current: number;
  days1To30: number;
  days31To60: number;
  days61To90: number;
  days90Plus: number;
};

export type AccountsReceivableAgingReportSummary = {
  customerCount: number;
  invoiceCount: number;
  current: number;
  days1To30: number;
  days31To60: number;
  days61To90: number;
  days90Plus: number;
  totalBalance: number;
};

export type AccountsReceivableAgingReportResponse = {
  data: AccountsReceivableAgingReportRow[];
  summary: AccountsReceivableAgingReportSummary;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: {
    asOfDate: string;
    customerId: string | null;
    bucket: AccountsReceivableAgingBucket;
    search: string | null;
    currentBusinessUnitId: string | null;
  };
};

export function useAccountsReceivableAgingReport(
  filters: AccountsReceivableAgingReportFilters = {}
) {
  const { enabled = true, ...queryFilters } = filters;

  return useQuery<AccountsReceivableAgingReportResponse>({
    queryKey: ["accounts-receivable-aging-report", queryFilters],
    enabled,
    queryFn: async () => {
      const params = new URLSearchParams();

      if (queryFilters.asOfDate) params.append("asOfDate", queryFilters.asOfDate);
      if (queryFilters.customerId) params.append("customerId", queryFilters.customerId);
      if (queryFilters.bucket) params.append("bucket", queryFilters.bucket);
      if (queryFilters.search) params.append("search", queryFilters.search);
      if (queryFilters.page) params.append("page", String(queryFilters.page));
      if (queryFilters.limit) params.append("limit", String(queryFilters.limit));

      const query = params.toString();
      const response = await fetch(
        `${API_BASE_URL}/reports/accounts-receivable-aging${query ? `?${query}` : ""}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch accounts receivable aging report");
      }

      return response.json();
    },
    staleTime: 60_000,
  });
}
