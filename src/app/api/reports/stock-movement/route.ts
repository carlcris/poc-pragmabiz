import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

type StockMovementEntry = {
  itemId: string;
  itemCode: string | null;
  itemName: string | null;
  warehouseId: string | null;
  warehouseCode: string | null;
  warehouseName: string | null;
  uom: string;
  totalIn: number;
  totalOut: number;
  netMovement: number;
  totalInValue: number;
  totalOutValue: number;
  netValue: number;
  transactionCount: number;
};

type StockMovementItem = {
  item_id: string;
  quantity: number | string | null;
  valuation_rate: number | string | null;
  stock_value_before: number | string | null;
  stock_value_after: number | string | null;
  transaction?: {
    warehouse_id: string | null;
    transaction_type?: string | null;
  } | {
    warehouse_id: string | null;
    transaction_type?: string | null;
  }[] | null;
  item?: {
    item_code: string | null;
    item_name: string | null;
    uom?: {
      code: string | null;
    } | { code: string | null }[] | null;
  } | {
    item_code: string | null;
    item_name: string | null;
    uom?: { code: string | null } | { code: string | null }[] | null;
  }[] | null;
};

type PrevTransactionItem = {
  quantity: number | string | null;
  stock_value_before: number | string | null;
  stock_value_after: number | string | null;
  transaction?: {
    transaction_type?: string | null;
  } | null;
};

// GET /api/reports/stock-movement
// Returns aggregated stock movement report
export async function GET(request: NextRequest) {
  try {
    await requirePermission(RESOURCES.REPORTS, "view");
    const { supabase } = await createServerClientWithBU();
    const { searchParams } = new URL(request.url);

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's company
    const { data: userData } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: "User company not found" }, { status: 400 });
    }

    // Extract query parameters
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const warehouseId = searchParams.get("warehouseId");
    const itemId = searchParams.get("itemId");
    const groupBy = searchParams.get("groupBy") || "item"; // item, warehouse, item-warehouse

    // Build query for stock transaction items
    let query = supabase
      .from("stock_transaction_items")
      .select(
        `
        id,
        posting_date,
        quantity,
        item_id,
        valuation_rate,
        stock_value_before,
        stock_value_after,
        transaction:stock_transactions!inner(
          id,
          warehouse_id,
          transaction_type,
          transaction_date
        ),
        item:items!inner(
          id,
          item_code,
          item_name,
          uom:units_of_measure(id, code, name)
        )
      `
      )
      .eq("transaction.company_id", userData.company_id)
      .is("deleted_at", null);

    // Apply filters
    if (startDate) {
      query = query.gte("posting_date", startDate);
    }

    if (endDate) {
      query = query.lte("posting_date", endDate);
    }

    if (warehouseId) {
      query = query.eq("transaction.warehouse_id", warehouseId);
    }

    if (itemId) {
      query = query.eq("item_id", itemId);
    }

    const { data: transactionItems, error } = await query;

    if (error) {
      return NextResponse.json({ error: "Failed to fetch stock movement data" }, { status: 500 });
    }

    // Need to fetch warehouse details separately since we're joining through transaction
    const typedItems = (transactionItems || []) as StockMovementItem[];
    const warehouseIds = [
      ...new Set(
        typedItems
          .map((entry) => {
            const transaction = Array.isArray(entry.transaction)
              ? entry.transaction[0]
              : entry.transaction;
            return transaction?.warehouse_id;
          })
          .filter(Boolean)
      ),
    ] as string[];
    const { data: warehouses } = await supabase
      .from("warehouses")
      .select("id, warehouse_code, warehouse_name")
      .in("id", warehouseIds);

    const warehouseMap = new Map(warehouses?.map((w) => [w.id, w]) || []);

    // Aggregate data based on groupBy parameter
    const movementMap = new Map<string, StockMovementEntry>();

    for (const entry of typedItems) {
      const transaction = Array.isArray(entry.transaction)
        ? entry.transaction[0]
        : entry.transaction;
      const item = Array.isArray(entry.item) ? entry.item[0] : entry.item;
      const uom = Array.isArray(item?.uom) ? item?.uom[0] : item?.uom;
      const warehouseId = transaction?.warehouse_id;
      const transactionType = transaction?.transaction_type;

      let key: string;

      if (groupBy === "item") {
        key = entry.item_id;
      } else if (groupBy === "warehouse") {
        key = warehouseId ?? "unknown";
      } else {
        // item-warehouse
        key = `${entry.item_id}_${warehouseId}`;
      }

      if (!movementMap.has(key)) {
        const warehouse = warehouseMap.get(warehouseId);
        movementMap.set(key, {
          itemId: entry.item_id,
          itemCode: item?.item_code ?? null,
          itemName: item?.item_name ?? null,
          warehouseId: warehouseId ?? null,
          warehouseCode: warehouse?.warehouse_code ?? null,
          warehouseName: warehouse?.warehouse_name ?? null,
          uom: uom?.code || "",
          totalIn: 0,
          totalOut: 0,
          netMovement: 0,
          totalInValue: 0,
          totalOutValue: 0,
          netValue: 0,
          transactionCount: 0,
        });
      }

      const movement = movementMap.get(key)!;
      const qty = parseFloat(String(entry.quantity ?? 0));
      const valueDiff =
        parseFloat(String(entry.stock_value_after ?? 0)) -
        parseFloat(String(entry.stock_value_before ?? 0));

      // IN transactions have positive quantity, OUT have negative (based on transaction_type)
      if (transactionType === "in" || transactionType === "adjustment") {
        movement.totalIn += qty;
        movement.totalInValue += Math.abs(valueDiff);
      } else if (transactionType === "out") {
        movement.totalOut += qty;
        movement.totalOutValue += Math.abs(valueDiff);
      }

      movement.netMovement = movement.totalIn - movement.totalOut;
      movement.netValue = movement.totalInValue - movement.totalOutValue;
      movement.transactionCount++;
    }

    // Convert map to array and sort by net movement (descending)
    const movements = Array.from(movementMap.values()).sort(
      (a, b) => Math.abs(b.netMovement) - Math.abs(a.netMovement)
    );

    // Calculate overall summary
    const summary = {
      totalIn: movements.reduce((sum, m) => sum + m.totalIn, 0),
      totalOut: movements.reduce((sum, m) => sum + m.totalOut, 0),
      netMovement: movements.reduce((sum, m) => sum + m.netMovement, 0),
      totalInValue: movements.reduce((sum, m) => sum + m.totalInValue, 0),
      totalOutValue: movements.reduce((sum, m) => sum + m.totalOutValue, 0),
      netValue: movements.reduce((sum, m) => sum + m.netValue, 0),
      totalTransactions: movements.reduce((sum, m) => sum + m.transactionCount, 0),
      itemCount: new Set(movements.map((m) => m.itemId)).size,
      warehouseCount: new Set(movements.map((m) => m.warehouseId)).size,
    };

    // Get period comparison if dates are provided
    let periodComparison = null;
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

      const prevStartDate = new Date(start);
      prevStartDate.setDate(prevStartDate.getDate() - daysDiff);
      const prevEndDate = new Date(start);
      prevEndDate.setDate(prevEndDate.getDate() - 1);

      // Query previous period
      let prevQuery = supabase
        .from("stock_transaction_items")
        .select(
          "quantity, stock_value_before, stock_value_after, transaction:stock_transactions!inner(transaction_type)"
        )
        .eq("transaction.company_id", userData.company_id)
        .gte("posting_date", prevStartDate.toISOString().split("T")[0])
        .lte("posting_date", prevEndDate.toISOString().split("T")[0])
        .is("deleted_at", null);

      if (warehouseId) {
        prevQuery = prevQuery.eq("transaction.warehouse_id", warehouseId);
      }

      if (itemId) {
        prevQuery = prevQuery.eq("item_id", itemId);
      }

      const { data: prevTransactionItems } = await prevQuery;

      if (prevTransactionItems) {
        const typedPrevItems = prevTransactionItems as PrevTransactionItem[];
        const prevTotalIn = typedPrevItems
          .filter((e) => e.transaction?.transaction_type === "in")
          .reduce((sum, e) => sum + parseFloat(String(e.quantity ?? 0)), 0);

        const prevTotalOut = typedPrevItems
          .filter((e) => e.transaction?.transaction_type === "out")
          .reduce((sum, e) => sum + parseFloat(String(e.quantity ?? 0)), 0);

        const prevTotalInValue = typedPrevItems
          .filter((e) => e.transaction?.transaction_type === "in")
          .reduce(
            (sum, e) =>
              sum +
              (parseFloat(String(e.stock_value_after ?? 0)) -
                parseFloat(String(e.stock_value_before ?? 0))),
            0
          );

        const prevTotalOutValue = typedPrevItems
          .filter((e) => e.transaction?.transaction_type === "out")
          .reduce(
            (sum, e) =>
              sum +
              Math.abs(
                parseFloat(String(e.stock_value_after ?? 0)) -
                  parseFloat(String(e.stock_value_before ?? 0))
              ),
            0
          );

        periodComparison = {
          previousPeriod: {
            startDate: prevStartDate.toISOString().split("T")[0],
            endDate: prevEndDate.toISOString().split("T")[0],
            totalIn: prevTotalIn,
            totalOut: prevTotalOut,
            totalInValue: prevTotalInValue,
            totalOutValue: prevTotalOutValue,
          },
          changes: {
            totalInChange: summary.totalIn - prevTotalIn,
            totalInChangePercent:
              prevTotalIn > 0 ? ((summary.totalIn - prevTotalIn) / prevTotalIn) * 100 : 0,
            totalOutChange: summary.totalOut - prevTotalOut,
            totalOutChangePercent:
              prevTotalOut > 0 ? ((summary.totalOut - prevTotalOut) / prevTotalOut) * 100 : 0,
            totalInValueChange: summary.totalInValue - prevTotalInValue,
            totalInValueChangePercent:
              prevTotalInValue > 0
                ? ((summary.totalInValue - prevTotalInValue) / prevTotalInValue) * 100
                : 0,
            totalOutValueChange: summary.totalOutValue - prevTotalOutValue,
            totalOutValueChangePercent:
              prevTotalOutValue > 0
                ? ((summary.totalOutValue - prevTotalOutValue) / prevTotalOutValue) * 100
                : 0,
          },
        };
      }
    }

    return NextResponse.json({
      data: movements,
      summary,
      periodComparison,
      filters: {
        startDate: startDate || null,
        endDate: endDate || null,
        warehouseId: warehouseId || null,
        itemId: itemId || null,
        groupBy,
      },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
