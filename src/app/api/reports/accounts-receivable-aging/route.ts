import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";
import { GRANULAR_CAPABILITIES } from "@/constants/granular-permissions";
import { canAccessCapability } from "@/services/permissions/permissionResolver";
import type {
  AccountsReceivableAgingBucket,
  AccountsReceivableAgingReportResponse,
  AccountsReceivableAgingReportRow,
} from "@/hooks/useAccountsReceivableAgingReport";

type RpcError = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

type RpcClient = {
  rpc: (
    functionName: string,
    args: Record<string, unknown>
  ) => Promise<{ data: unknown; error: RpcError | null }>;
};

type AccountsReceivableAgingRpcRow = {
  customer_id?: string | null;
  customer_code?: string | null;
  customer_name?: string | null;
  invoice_id?: string | null;
  invoice_code?: string | null;
  invoice_date?: string | null;
  due_date?: string | null;
  status?: string | null;
  total_amount?: number | string | null;
  amount_paid?: number | string | null;
  balance?: number | string | null;
  days_overdue?: number | string | null;
  current_amount?: number | string | null;
  days_1_to_30?: number | string | null;
  days_31_to_60?: number | string | null;
  days_61_to_90?: number | string | null;
  days_90_plus?: number | string | null;
  total_count?: number | string | null;
  summary_customer_count?: number | string | null;
  summary_invoice_count?: number | string | null;
  summary_current_amount?: number | string | null;
  summary_days_1_to_30?: number | string | null;
  summary_days_31_to_60?: number | string | null;
  summary_days_61_to_90?: number | string | null;
  summary_days_90_plus?: number | string | null;
  summary_total_balance?: number | string | null;
};

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 50;
const VALID_BUCKETS: AccountsReceivableAgingBucket[] = [
  "all",
  "current",
  "1_30",
  "31_60",
  "61_90",
  "90_plus",
];
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const asRpcClient = (client: unknown): RpcClient => client as RpcClient;

const toNumber = (value: number | string | null | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parsePositiveInt = (value: string | null, fallback: number, max = MAX_PAGE_SIZE) => {
  const parsed = Number.parseInt(value || "", 10);
  const normalized = Number.isFinite(parsed) ? Math.max(parsed, 1) : fallback;
  return Math.min(normalized, max);
};

const parseBucket = (value: string | null): AccountsReceivableAgingBucket =>
  VALID_BUCKETS.includes(value as AccountsReceivableAgingBucket)
    ? (value as AccountsReceivableAgingBucket)
    : "all";

const parseUuid = (value: string | null) => {
  if (!value || value === "all") return null;
  return UUID_REGEX.test(value) ? value : null;
};

const parseAsOfDate = (value: string | null) => {
  if (!value) return new Date().toISOString().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : new Date().toISOString().slice(0, 10);
};

const transformRow = (
  row: AccountsReceivableAgingRpcRow
): AccountsReceivableAgingReportRow | null => {
  if (
    !row.customer_id ||
    !row.customer_code ||
    !row.customer_name ||
    !row.invoice_id ||
    !row.invoice_code ||
    !row.invoice_date ||
    !row.due_date
  ) {
    return null;
  }

  return {
    customerId: row.customer_id,
    customerCode: row.customer_code,
    customerName: row.customer_name,
    invoiceId: row.invoice_id,
    invoiceCode: row.invoice_code,
    invoiceDate: row.invoice_date,
    dueDate: row.due_date,
    status: row.status || "",
    totalAmount: toNumber(row.total_amount),
    amountPaid: toNumber(row.amount_paid),
    balance: toNumber(row.balance),
    daysOverdue: toNumber(row.days_overdue),
    current: toNumber(row.current_amount),
    days1To30: toNumber(row.days_1_to_30),
    days31To60: toNumber(row.days_31_to_60),
    days61To90: toNumber(row.days_61_to_90),
    days90Plus: toNumber(row.days_90_plus),
  };
};

export async function GET(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.REPORTS, "view");
    if (unauthorized) return unauthorized;

    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, userId, companyId, currentBusinessUnitId } = context;
    const canViewFinancialReports = await canAccessCapability(
      userId,
      GRANULAR_CAPABILITIES.REPORTS_FINANCIAL_CARDS,
      "view",
      currentBusinessUnitId
    );

    if (!canViewFinancialReports) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const asOfDate = parseAsOfDate(searchParams.get("asOfDate"));
    const customerId = parseUuid(searchParams.get("customerId"));
    const bucket = parseBucket(searchParams.get("bucket"));
    const search = searchParams.get("search")?.trim() || null;
    const page = parsePositiveInt(searchParams.get("page"), 1, Number.MAX_SAFE_INTEGER);
    const limit = parsePositiveInt(searchParams.get("limit"), DEFAULT_PAGE_SIZE);

    const result = await asRpcClient(supabase).rpc("get_accounts_receivable_aging_report", {
      p_company_id: companyId,
      p_business_unit_id: currentBusinessUnitId || null,
      p_as_of_date: asOfDate,
      p_customer_id: customerId,
      p_bucket: bucket,
      p_search: search,
      p_page: page,
      p_limit: limit,
    });

    if (result.error) {
      console.error("Failed to fetch accounts receivable aging report:", result.error);
      return NextResponse.json(
        { error: "Failed to fetch accounts receivable aging report" },
        { status: 500 }
      );
    }

    const rpcRows = Array.isArray(result.data)
      ? (result.data as AccountsReceivableAgingRpcRow[])
      : [];
    const rows = rpcRows
      .map(transformRow)
      .filter((row): row is AccountsReceivableAgingReportRow => Boolean(row));
    const firstRow = rpcRows[0];
    const total = toNumber(firstRow?.total_count);

    const response: AccountsReceivableAgingReportResponse = {
      data: rows,
      summary: {
        customerCount: toNumber(firstRow?.summary_customer_count),
        invoiceCount: toNumber(firstRow?.summary_invoice_count),
        current: toNumber(firstRow?.summary_current_amount),
        days1To30: toNumber(firstRow?.summary_days_1_to_30),
        days31To60: toNumber(firstRow?.summary_days_31_to_60),
        days61To90: toNumber(firstRow?.summary_days_61_to_90),
        days90Plus: toNumber(firstRow?.summary_days_90_plus),
        totalBalance: toNumber(firstRow?.summary_total_balance),
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      filters: {
        asOfDate,
        customerId,
        bucket,
        search,
        currentBusinessUnitId: currentBusinessUnitId || null,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Unexpected accounts receivable aging report error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
