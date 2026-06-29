import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";

type JoinedRecord<T> = T | T[] | null;

type StockLedgerItemRow = {
  id: string;
  posting_date: string;
  posting_time: string;
  quantity: number | string | null;
  qty_after: number | string | null;
  valuation_rate: number | string | null;
  stock_value_after: number | string | null;
  stock_value_before: number | string | null;
  unit_cost: number | string | null;
  total_cost: number | string | null;
  item_id: string;
  notes: string | null;
  transaction_id: string;
  transaction: JoinedRecord<{
    id: string;
    transaction_code: string | null;
    transaction_type: string | null;
    transaction_date: string | null;
    reference_type: string | null;
    reference_id: string | null;
    reference_code: string | null;
    warehouse_id: string | null;
    warehouse: JoinedRecord<{
      id: string;
      warehouse_code: string | null;
      warehouse_name: string | null;
    }>;
  }>;
  item: JoinedRecord<{
    id: string;
    item_code: string | null;
    item_name: string | null;
  }>;
  uom: JoinedRecord<{
    code: string | null;
  }>;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const pickFirst = <T>(value: JoinedRecord<T>): T | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
};

const toNumber = (value: number | string | null | undefined) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parsePositiveInt = (value: string | null, fallback: number) => {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const getActualQty = (transactionType: string | null | undefined, quantity: number) => {
  if (transactionType === "out" || transactionType === "transfer") {
    return -Math.abs(quantity);
  }
  return quantity;
};

async function GETHandler(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_TRANSACTIONS, "view");
    if (unauthorized) return unauthorized;

    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, companyId, currentBusinessUnitId } = context;
    const searchParams = request.nextUrl.searchParams;

    const itemId = searchParams.get("itemId");
    const warehouseId = searchParams.get("warehouseId");
    const startDate = searchParams.get("startDate") || null;
    const endDate = searchParams.get("endDate") || null;
    const voucherType = searchParams.get("voucherType") || null;
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const limit = Math.min(parsePositiveInt(searchParams.get("limit"), DEFAULT_LIMIT), MAX_LIMIT);
    const offset = (page - 1) * limit;

    if (!itemId || !UUID_REGEX.test(itemId)) {
      return NextResponse.json({ error: "A valid item filter is required" }, { status: 400 });
    }

    if (!warehouseId || !UUID_REGEX.test(warehouseId)) {
      return NextResponse.json({ error: "A valid warehouse filter is required" }, { status: 400 });
    }

    let query = supabase
      .from("stock_transaction_items")
      .select(
        `
        id,
        posting_date,
        posting_time,
        quantity,
        qty_after,
        valuation_rate,
        stock_value_after,
        stock_value_before,
        unit_cost,
        total_cost,
        item_id,
        notes,
        transaction_id,
        transaction:stock_transactions!inner(
          id,
          transaction_code,
          transaction_type,
          transaction_date,
          reference_type,
          reference_id,
          reference_code,
          warehouse_id,
          warehouse:warehouses!stock_transactions_warehouse_id_fkey(id, warehouse_code, warehouse_name)
        ),
        item:items!inner(id, item_code, item_name),
        uom:units_of_measure(id, code)
      `,
        { count: "exact" }
      )
      .eq("company_id", companyId)
      .eq("item_id", itemId)
      .eq("transaction.warehouse_id", warehouseId)
      .is("deleted_at", null)
      .is("transaction.deleted_at", null);

    if (currentBusinessUnitId) {
      query = query.eq("transaction.business_unit_id", currentBusinessUnitId);
    }

    if (startDate) {
      query = query.gte("posting_date", startDate);
    }

    if (endDate) {
      query = query.lte("posting_date", endDate);
    }

    if (voucherType && voucherType !== "all") {
      query = query.eq("transaction.transaction_type", voucherType);
    }

    const { data, error, count } = await query
      .order("posting_date", { ascending: false })
      .order("posting_time", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching stock ledger:", error);
      return NextResponse.json({ error: "Failed to fetch stock ledger" }, { status: 500 });
    }

    let openingBalance = 0;
    if (startDate) {
      let openingQuery = supabase
        .from("stock_transaction_items")
        .select(
          `
          qty_after,
          transaction:stock_transactions!inner(id, business_unit_id, warehouse_id)
        `
        )
        .eq("company_id", companyId)
        .eq("item_id", itemId)
        .eq("transaction.warehouse_id", warehouseId)
        .lt("posting_date", startDate)
        .is("deleted_at", null)
        .is("transaction.deleted_at", null);

      if (currentBusinessUnitId) {
        openingQuery = openingQuery.eq("transaction.business_unit_id", currentBusinessUnitId);
      }

      const { data: openingRows, error: openingError } = await openingQuery
        .order("posting_date", { ascending: false })
        .order("posting_time", { ascending: false })
        .order("id", { ascending: false })
        .limit(1);

      if (openingError) {
        console.error("Error fetching stock ledger opening balance:", openingError);
        return NextResponse.json({ error: "Failed to fetch stock ledger" }, { status: 500 });
      }

      openingBalance = toNumber(openingRows?.[0]?.qty_after);
    }

    const rows = (data || []) as unknown as StockLedgerItemRow[];
    const ledgerEntries = rows
      .map((row) => {
        const transaction = pickFirst(row.transaction);
        const item = pickFirst(row.item);
        const warehouse = pickFirst(transaction?.warehouse ?? null);
        const uom = pickFirst(row.uom);

        if (!transaction || !item) {
          return null;
        }

        const quantity = toNumber(row.quantity);
        const actualQty = getActualQty(transaction.transaction_type, quantity);
        const stockValue = toNumber(row.stock_value_after ?? row.total_cost);

        return {
          id: row.id,
          postingDate: row.posting_date,
          postingTime: row.posting_time,
          voucherType: transaction.transaction_type || "unknown",
          voucherNo: transaction.reference_code || transaction.transaction_code || "",
          itemId: item.id,
          itemCode: item.item_code || "",
          itemName: item.item_name || "",
          warehouseId: warehouse?.id || transaction.warehouse_id || "",
          warehouseCode: warehouse?.warehouse_code || "",
          warehouseName: warehouse?.warehouse_name || "",
          actualQty,
          qtyAfterTransaction: toNumber(row.qty_after),
          incomingRate: toNumber(row.unit_cost),
          valuationRate: toNumber(row.valuation_rate ?? row.unit_cost),
          stockValue,
          stockValueDiff: stockValue - toNumber(row.stock_value_before),
          uom: uom?.code || "",
          transactionId: transaction.id,
          transactionCode: transaction.transaction_code || "",
          transactionType: transaction.transaction_type || "unknown",
          referenceType: transaction.reference_type,
          referenceId: transaction.reference_id,
          notes: row.notes,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    return NextResponse.json({
      data: ledgerEntries,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
      openingBalance,
    });
  } catch (error) {
    console.error("Unexpected stock ledger error:", error);
    return NextResponse.json({ error: "Failed to fetch stock ledger" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "stock_ledger",
  route: "/api/stock-ledger",
});
