import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import type {
  CustomerLedgerEntry,
  CustomerLedgerResponse,
  CustomerLedgerSourceType,
  CustomerLedgerSummary,
} from "@/types/customer";

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

type CustomerLedgerSummaryRow = {
  opening_balance?: number | string | null;
  closing_balance?: number | string | null;
  period_debits?: number | string | null;
  period_credits?: number | string | null;
  invoice_charges?: number | string | null;
  payments_received?: number | string | null;
  pos_sales?: number | string | null;
  active_invoice_count?: number | string | null;
  overdue_invoice_count?: number | string | null;
  last_activity_at?: string | null;
};

type CustomerLedgerEntryRow = {
  entry_id?: string | null;
  sort_key?: string | null;
  source_type?: string | null;
  source_id?: string | null;
  document_number?: string | null;
  event_at?: string | null;
  due_date?: string | null;
  status?: string | null;
  description?: string | null;
  debit?: number | string | null;
  credit?: number | string | null;
  amount?: number | string | null;
  balance_effect?: number | string | null;
  running_balance?: number | string | null;
  payment_method?: string | null;
  reference?: string | null;
  total_count?: number | string | null;
};

const VALID_SOURCE_TYPES: CustomerLedgerSourceType[] = ["all", "invoice", "payment", "pos"];

const asRpcClient = (client: unknown): RpcClient => client as RpcClient;

const toNumber = (value: number | string | null | undefined) => Number(value ?? 0);

const parseSourceType = (value: string | null): CustomerLedgerSourceType => {
  if (!value) return "all";
  return VALID_SOURCE_TYPES.includes(value as CustomerLedgerSourceType)
    ? (value as CustomerLedgerSourceType)
    : "all";
};

const parsePositiveInt = (value: string | null, fallback: number, max?: number) => {
  const parsed = Number.parseInt(value || "", 10);
  const normalized = Number.isFinite(parsed) ? Math.max(parsed, 1) : fallback;
  return max ? Math.min(normalized, max) : normalized;
};

const transformSummary = (
  row: CustomerLedgerSummaryRow | null | undefined
): CustomerLedgerSummary => ({
  openingBalance: toNumber(row?.opening_balance),
  closingBalance: toNumber(row?.closing_balance),
  periodDebits: toNumber(row?.period_debits),
  periodCredits: toNumber(row?.period_credits),
  invoiceCharges: toNumber(row?.invoice_charges),
  paymentsReceived: toNumber(row?.payments_received),
  posSales: toNumber(row?.pos_sales),
  activeInvoiceCount: toNumber(row?.active_invoice_count),
  overdueInvoiceCount: toNumber(row?.overdue_invoice_count),
  lastActivityAt: row?.last_activity_at || undefined,
});

const isLedgerSourceType = (
  value: string | null | undefined
): value is Exclude<CustomerLedgerSourceType, "all"> =>
  value === "invoice" || value === "payment" || value === "pos";

const transformEntry = (row: CustomerLedgerEntryRow): CustomerLedgerEntry | null => {
  if (
    !row.entry_id ||
    !row.sort_key ||
    !isLedgerSourceType(row.source_type) ||
    !row.source_id ||
    !row.document_number ||
    !row.event_at
  ) {
    return null;
  }

  return {
    id: row.entry_id,
    sortKey: row.sort_key,
    sourceType: row.source_type,
    sourceId: row.source_id,
    documentNumber: row.document_number,
    eventAt: row.event_at,
    dueDate: row.due_date || undefined,
    status: row.status || "",
    description: row.description || "",
    debit: toNumber(row.debit),
    credit: toNumber(row.credit),
    amount: toNumber(row.amount),
    balanceEffect: toNumber(row.balance_effect),
    runningBalance: toNumber(row.running_balance),
    paymentMethod: row.payment_method || undefined,
    reference: row.reference || undefined,
  };
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const unauthorized = await requirePermission(RESOURCES.CUSTOMERS, "view");
    if (unauthorized) return unauthorized;

    const { id: customerId } = await params;
    const { supabase, companyId } = await createServerClientWithBU();

    if (!companyId) {
      return NextResponse.json({ error: "User company not found" }, { status: 400 });
    }

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id")
      .eq("id", customerId)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .maybeSingle();

    if (customerError) {
      console.error("Failed to verify customer before loading ledger:", customerError);
      return NextResponse.json({ error: "Failed to load customer ledger" }, { status: 500 });
    }

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const dateFrom = searchParams.get("dateFrom") || null;
    const dateTo = searchParams.get("dateTo") || null;
    const sourceType = parseSourceType(searchParams.get("sourceType"));
    const search = searchParams.get("search")?.trim() || null;
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const limit = parsePositiveInt(searchParams.get("limit"), 20, 50);

    const rpc = asRpcClient(supabase);

    const summaryResult = await rpc.rpc("get_customer_ledger_summary", {
      p_company_id: companyId,
      p_customer_id: customerId,
      p_date_from: dateFrom,
      p_date_to: dateTo,
    });

    if (summaryResult.error) {
      console.error("Failed to load customer ledger summary:", summaryResult.error);
      return NextResponse.json({ error: "Failed to load customer ledger" }, { status: 500 });
    }

    const entriesResult = await rpc.rpc("get_customer_ledger_entries", {
      p_company_id: companyId,
      p_customer_id: customerId,
      p_date_from: dateFrom,
      p_date_to: dateTo,
      p_source_type: sourceType,
      p_search: search,
      p_page: page,
      p_limit: limit,
    });

    if (entriesResult.error) {
      console.error("Failed to load customer ledger entries:", entriesResult.error);
      return NextResponse.json({ error: "Failed to load customer ledger" }, { status: 500 });
    }

    const summaryRows = Array.isArray(summaryResult.data)
      ? (summaryResult.data as CustomerLedgerSummaryRow[])
      : [];
    const entryRows = Array.isArray(entriesResult.data)
      ? (entriesResult.data as CustomerLedgerEntryRow[])
      : [];
    const entries = entryRows
      .map(transformEntry)
      .filter((entry): entry is CustomerLedgerEntry => Boolean(entry));
    const total = toNumber(entryRows[0]?.total_count);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const response: CustomerLedgerResponse = {
      data: entries,
      summary: transformSummary(summaryRows[0]),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Unexpected customer ledger error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
