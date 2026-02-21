import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import {
  adjustItemLocation,
  ensureWarehouseDefaultLocation,
} from "@/services/inventory/locationService";

type TransactionListItemRow = {
  id: string;
  quantity: number | string | null;
  unit_cost: number | string | null;
  total_cost: number | string | null;
  batch_no: string | null;
  serial_no: string | null;
  expiry_date: string | null;
  notes: string | null;
  created_at: string;
  transaction:
    | {
        id: string;
        transaction_code: string;
        transaction_type: string;
        transaction_date: string;
        warehouse_id: string | null;
        to_warehouse_id: string | null;
        from_location_id: string | null;
        to_location_id: string | null;
        reference_type: string | null;
        reference_id: string | null;
        status: string;
        notes: string | null;
        created_by: string | null;
        created_at: string;
        warehouse:
          | { id: string; warehouse_code: string | null; warehouse_name: string | null }
          | { id: string; warehouse_code: string | null; warehouse_name: string | null }[]
          | null;
        toWarehouse:
          | { id: string; warehouse_code: string | null; warehouse_name: string | null }
          | { id: string; warehouse_code: string | null; warehouse_name: string | null }[]
          | null;
        fromLocation:
          | { id: string; code: string | null; name: string | null }
          | { id: string; code: string | null; name: string | null }[]
          | null;
        toLocation:
          | { id: string; code: string | null; name: string | null }
          | { id: string; code: string | null; name: string | null }[]
          | null;
        creator:
          | { id: string; first_name: string | null; last_name: string | null }
          | { id: string; first_name: string | null; last_name: string | null }[]
          | null;
      }
    | {
        id: string;
        transaction_code: string;
        transaction_type: string;
        transaction_date: string;
        warehouse_id: string | null;
        to_warehouse_id: string | null;
        from_location_id: string | null;
        to_location_id: string | null;
        reference_type: string | null;
        reference_id: string | null;
        status: string;
        notes: string | null;
        created_by: string | null;
        created_at: string;
        warehouse:
          | { id: string; warehouse_code: string | null; warehouse_name: string | null }
          | { id: string; warehouse_code: string | null; warehouse_name: string | null }[]
          | null;
        toWarehouse:
          | { id: string; warehouse_code: string | null; warehouse_name: string | null }
          | { id: string; warehouse_code: string | null; warehouse_name: string | null }[]
          | null;
        fromLocation:
          | { id: string; code: string | null; name: string | null }
          | { id: string; code: string | null; name: string | null }[]
          | null;
        toLocation:
          | { id: string; code: string | null; name: string | null }
          | { id: string; code: string | null; name: string | null }[]
          | null;
        creator:
          | { id: string; first_name: string | null; last_name: string | null }
          | { id: string; first_name: string | null; last_name: string | null }[]
          | null;
      }[]
    | null;
  item:
    | {
        id: string;
        item_code: string | null;
        item_name: string | null;
        uom?:
          | {
              id: string;
              code: string | null;
              name: string | null;
            }
          | {
              id: string;
              code: string | null;
              name: string | null;
            }[]
          | null;
      }
    | {
        id: string;
        item_code: string | null;
        item_name: string | null;
        uom?:
          | {
              id: string;
              code: string | null;
              name: string | null;
            }
          | {
              id: string;
              code: string | null;
              name: string | null;
            }[]
          | null;
      }[]
    | null;
};

type StockTransactionBody = {
  transactionType: "in" | "out" | "transfer";
  transactionDate?: string;
  warehouseId: string;
  toWarehouseId?: string | null;
  fromLocationId?: string | null;
  toLocationId?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  notes?: string | null;
  items: Array<{
    itemId: string;
    quantity: number | string;
    unitCost?: number | string | null;
    uomId?: string | null;
    batchNo?: string | null;
    serialNo?: string | null;
    expiryDate?: string | null;
    notes?: string | null;
  }>;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

const parsePositiveInt = (value: string | null, fallback: number) => {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizeSearch = (value: string | null) => {
  if (!value) return null;
  const normalized = value.trim().replace(/[,%]/g, " ");
  return normalized.length > 0 ? normalized : null;
};

const pickFirst = <T>(value: T | T[] | null | undefined): T | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
};

// GET /api/stock-transactions
export async function GET(request: NextRequest) {
  try {
    // Require 'stock_transactions' view permission
    const unauthorized = await requirePermission(RESOURCES.STOCK_TRANSACTIONS, "view");
    if (unauthorized) return unauthorized;

    const { supabase, currentBusinessUnitId } = await createServerClientWithBU();
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

    const page = parsePositiveInt(searchParams.get("page"), 1);
    const limit = Math.min(parsePositiveInt(searchParams.get("limit"), DEFAULT_LIMIT), MAX_LIMIT);
    const offset = (page - 1) * limit;
    const search = normalizeSearch(searchParams.get("search"));
    const transactionType = searchParams.get("transactionType");
    const warehouseId = searchParams.get("warehouseId");
    const itemId = searchParams.get("itemId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (warehouseId && !UUID_REGEX.test(warehouseId)) {
      return NextResponse.json({ error: "Invalid warehouse filter" }, { status: 400 });
    }
    if (itemId && !UUID_REGEX.test(itemId)) {
      return NextResponse.json({ error: "Invalid item filter" }, { status: 400 });
    }
    if (
      transactionType &&
      transactionType !== "all" &&
      transactionType !== "in" &&
      transactionType !== "out" &&
      transactionType !== "transfer" &&
      transactionType !== "adjustment"
    ) {
      return NextResponse.json({ error: "Invalid transaction type" }, { status: 400 });
    }

    let query = supabase
      .from("stock_transaction_items")
      .select(
        `
        id,
        quantity,
        unit_cost,
        total_cost,
        batch_no,
        serial_no,
        expiry_date,
        notes,
        created_at,
        transaction:stock_transactions!inner(
          id,
          transaction_code,
          transaction_type,
          transaction_date,
          warehouse_id,
          to_warehouse_id,
          from_location_id,
          to_location_id,
          reference_type,
          reference_id,
          status,
          notes,
          created_by,
          created_at,
          warehouse:warehouses!stock_transactions_warehouse_id_fkey(id, warehouse_code, warehouse_name),
          toWarehouse:warehouses!stock_transactions_to_warehouse_id_fkey(id, warehouse_code, warehouse_name),
          fromLocation:warehouse_locations!stock_transactions_from_location_id_fkey(id, code, name),
          toLocation:warehouse_locations!stock_transactions_to_location_id_fkey(id, code, name),
          creator:users!stock_transactions_created_by_fkey(id, first_name, last_name)
        ),
        item:items!inner(
          id,
          item_code,
          item_name,
          uom:units_of_measure(id, code, name)
        )
      `,
        { count: "exact" }
      )
      .eq("transaction.company_id", userData.company_id)
      .is("deleted_at", null)
      .is("transaction.deleted_at", null);

    if (currentBusinessUnitId) {
      query = query.eq("transaction.business_unit_id", currentBusinessUnitId);
    }

    if (transactionType && transactionType !== "all") {
      query = query.eq("transaction.transaction_type", transactionType);
    }
    if (warehouseId) {
      query = query.eq("transaction.warehouse_id", warehouseId);
    }
    if (itemId) {
      query = query.eq("item_id", itemId);
    }
    if (startDate) {
      query = query.gte("transaction.transaction_date", startDate);
    }
    if (endDate) {
      query = query.lte("transaction.transaction_date", endDate);
    }
    if (search) {
      const { data: matchedItems, error: itemSearchError } = await supabase
        .from("items")
        .select("id")
        .eq("company_id", userData.company_id)
        .is("deleted_at", null)
        .or(`item_code.ilike.%${search}%,item_name.ilike.%${search}%`)
        .limit(100);
      if (itemSearchError) {
        return NextResponse.json(
          { error: "Failed to search items", details: itemSearchError.message },
          { status: 500 }
        );
      }
      const itemIdMatches = (matchedItems || []).map((row) => row.id);
      const searchClauses = [
        `transaction.transaction_code.ilike.%${search}%`,
        `transaction.notes.ilike.%${search}%`,
      ];
      if (itemIdMatches.length > 0) {
        searchClauses.push(`item_id.in.(${itemIdMatches.join(",")})`);
      }
      query = query.or(searchClauses.join(","));
    }

    const { data: transactionItems, error: txError, count } = await query
      .order("id", { ascending: false })
      .range(offset, offset + limit - 1);

    if (txError) {
      return NextResponse.json(
        { error: "Failed to fetch transactions", details: txError.message },
        { status: 500 }
      );
    }

    // Format stock transactions
    const typedTransactionItems = (transactionItems || []) as unknown as TransactionListItemRow[];

    const formattedTransactions = typedTransactionItems
      .map((item) => {
        const transaction = pickFirst(item.transaction);
        const itemRecord = pickFirst(item.item);
        const uomRecord = pickFirst(itemRecord?.uom);
        const warehouseRecord = pickFirst(transaction?.warehouse);
        const toWarehouseRecord = pickFirst(transaction?.toWarehouse);
        const fromLocationRecord = pickFirst(transaction?.fromLocation);
        const toLocationRecord = pickFirst(transaction?.toLocation);
        const creatorRecord = pickFirst(transaction?.creator);

        if (!transaction || !itemRecord) {
          return null;
        }

        return {
          id: item.id, // Use transaction item ID as unique key
          transactionId: transaction.id,
          companyId: userData.company_id,
          transactionCode: transaction.transaction_code,
          transactionDate: transaction.transaction_date,
          transactionType: transaction.transaction_type,
          itemId: itemRecord.id,
          itemCode: itemRecord.item_code,
          itemName: itemRecord.item_name,
          warehouseId: transaction.warehouse_id,
          warehouseCode: warehouseRecord?.warehouse_code || "",
          warehouseName: warehouseRecord?.warehouse_name || "",
          fromLocationId: transaction.from_location_id,
          fromLocationCode: fromLocationRecord?.code || "",
          fromLocationName: fromLocationRecord?.name || "",
          toWarehouseId: transaction.to_warehouse_id,
          toWarehouseCode: toWarehouseRecord?.warehouse_code || "",
          toWarehouseName: toWarehouseRecord?.warehouse_name || "",
          toLocationId: transaction.to_location_id,
          toLocationCode: toLocationRecord?.code || "",
          toLocationName: toLocationRecord?.name || "",
          quantity: parseFloat(String(item.quantity ?? 0)),
          uom: uomRecord?.code || "",
          unitCost: parseFloat(String(item.unit_cost ?? 0)),
          totalCost: parseFloat(String(item.total_cost ?? 0)),
          batchNo: item.batch_no,
          serialNo: item.serial_no,
          expiryDate: item.expiry_date,
          referenceType: transaction.reference_type,
          referenceId: transaction.reference_id,
          referenceNumber: transaction.transaction_code,
          reason: transaction.notes || "",
          notes: item.notes || "",
          createdBy: transaction.created_by,
          createdByName:
            `${creatorRecord?.first_name || ""} ${creatorRecord?.last_name || ""}`.trim() ||
            "Unknown",
          createdAt: transaction.created_at,
          updatedAt: item.created_at,
        };
      })
      .filter((item) => item !== null);

    return NextResponse.json({
      data: formattedTransactions,
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/stock-transactions
export async function POST(request: NextRequest) {
  try {
    // Require 'stock_transactions' create permission
    const unauthorized = await requirePermission(RESOURCES.STOCK_TRANSACTIONS, "create");
    if (unauthorized) return unauthorized;

    const { supabase, currentBusinessUnitId } = await createServerClientWithBU();
    const body = (await request.json()) as StockTransactionBody;

    if (
      body.transactionType === "transfer" &&
      (!body.toWarehouseId || body.toWarehouseId === body.warehouseId)
    ) {
      const locationUnauthorized = await requirePermission(
        RESOURCES.TRANSFER_BETWEEN_LOCATIONS,
        "create"
      );
      if (locationUnauthorized) return locationUnauthorized;
    }

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!currentBusinessUnitId) {
      return NextResponse.json({ error: "Business unit context required" }, { status: 400 });
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

    // Validate required fields
    if (!body.items || body.items.length === 0) {
      return NextResponse.json(
        { error: "Stock transaction must have at least one item" },
        { status: 400 }
      );
    }

    // Generate transaction code (ST-YYYY-NNNN)
    const currentYear = new Date().getFullYear();
    const { data: lastTransaction } = await supabase
      .from("stock_transactions")
      .select("transaction_code")
      .eq("company_id", userData.company_id)
      .like("transaction_code", `ST-${currentYear}-%`)
      .order("transaction_code", { ascending: false })
      .limit(1);

    let nextNum = 1;
    if (lastTransaction && lastTransaction.length > 0) {
      const match = lastTransaction[0].transaction_code.match(/ST-\d+-(\d+)/);
      if (match) {
        nextNum = parseInt(match[1]) + 1;
      }
    }
    const transactionCode = `ST-${currentYear}-${String(nextNum).padStart(4, "0")}`;

    const defaultFromLocationId = await ensureWarehouseDefaultLocation({
      supabase,
      companyId: userData.company_id,
      warehouseId: body.warehouseId,
      userId: user.id,
    });

    const defaultToLocationId = body.toWarehouseId
      ? await ensureWarehouseDefaultLocation({
          supabase,
          companyId: userData.company_id,
          warehouseId: body.toWarehouseId,
          userId: user.id,
        })
      : null;

    const fromLocationId =
      body.fromLocationId || (body.transactionType === "in" ? null : defaultFromLocationId);

    const toLocationId =
      body.toLocationId ||
      (body.transactionType === "out" ? null : defaultToLocationId || defaultFromLocationId);

    // Create stock transaction header
    const { data: transaction, error: transactionError } = await supabase
      .from("stock_transactions")
      .insert({
        company_id: userData.company_id,
        business_unit_id: currentBusinessUnitId,
        transaction_code: transactionCode,
        transaction_type: body.transactionType,
        transaction_date: body.transactionDate || new Date().toISOString().split("T")[0],
        warehouse_id: body.warehouseId,
        to_warehouse_id: body.toWarehouseId || null,
        from_location_id: fromLocationId,
        to_location_id: toLocationId,
        reference_type: body.referenceType || null,
        reference_id: body.referenceId || null,
        status: "posted", // Manual transactions are posted immediately
        notes: body.notes || null,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (transactionError) {
      return NextResponse.json(
        { error: transactionError.message || "Failed to create stock transaction" },
        { status: 500 }
      );
    }

    const itemIds = body.items.map((item) => item.itemId);
    const { data: itemUoms } = await supabase
      .from("items")
      .select("id, uom_id")
      .in("id", itemIds);
    const itemUomMap = new Map(
      (itemUoms as Array<{ id: string; uom_id: string | null }> | null)?.map((row) => [
        row.id,
        row.uom_id,
      ]) || []
    );

    const resolvedItems = body.items.map((item) => {
      const quantity = Number(item.quantity);
      const unitCost = item.unitCost ? parseFloat(String(item.unitCost)) : 0;
      const uomId = item.uomId ?? itemUomMap.get(item.itemId) ?? null;

      return {
        itemId: item.itemId,
        quantity,
        unitCost,
        totalCost: quantity * unitCost,
        uomId,
      };
    });

    const postingDate = body.transactionDate || new Date().toISOString().split("T")[0];
    const postingTime = new Date().toTimeString().split(" ")[0];

    // Update stock and create transaction items
    for (let i = 0; i < resolvedItems.length; i++) {
      const item = resolvedItems[i];
      const originalItem = body.items[i];

      // Get current stock balance from item_warehouse (source of truth)
      const { data: warehouseStock } = await supabase
        .from("item_warehouse")
        .select("current_stock, default_location_id")
        .eq("item_id", item.itemId)
        .eq("warehouse_id", body.warehouseId)
        .single();

      const currentBalance = warehouseStock ? parseFloat(String(warehouseStock.current_stock)) : 0;

      if (!item.uomId) {
        await supabase.from("stock_transactions").delete().eq("id", transaction.id);
        return NextResponse.json({ error: "Item UOM not found for stock transaction" }, { status: 400 });
      }

      // Calculate actual quantity change based on transaction type
      let actualQty = item.quantity;
      if (body.transactionType === "out") {
        actualQty = -item.quantity;
      } else if (body.transactionType === "transfer" && body.warehouseId) {
        actualQty = -item.quantity;
      }

      const newBalance = currentBalance + actualQty;

      // Validate sufficient stock for OUT transactions
      if (newBalance < 0 && body.transactionType === "out") {
        return NextResponse.json(
          {
            error: `Insufficient stock for item. Available: ${currentBalance}, Requested: ${item.quantity}`,
          },
          { status: 400 }
        );
      }

      // Create stock transaction item
      const { error: stockTxItemError } = await supabase
        .from("stock_transaction_items")
        .insert({
          company_id: userData.company_id,
          transaction_id: transaction.id,
          item_id: item.itemId,
          // Standard fields
          quantity: item.quantity,
          uom_id: item.uomId,
          unit_cost: item.unitCost,
          total_cost: item.totalCost,
          // Audit fields
          qty_before: currentBalance,
          qty_after: newBalance,
          valuation_rate: item.unitCost,
          stock_value_before: currentBalance * item.unitCost,
          stock_value_after: newBalance * item.unitCost,
          posting_date: postingDate,
          posting_time: postingTime,
          // Additional fields from original item
          batch_no: originalItem.batchNo || null,
          serial_no: originalItem.serialNo || null,
          expiry_date: originalItem.expiryDate || null,
          notes: originalItem.notes || null,
          created_by: user.id,
          updated_by: user.id,
        })
        .select()
        .single();

      if (stockTxItemError) {
        // Rollback: delete the transaction
        await supabase.from("stock_transactions").delete().eq("id", transaction.id);
        return NextResponse.json(
          { error: stockTxItemError.message || "Failed to create transaction item" },
          { status: 500 }
        );
      }

      await adjustItemLocation({
        supabase,
        companyId: userData.company_id,
        itemId: item.itemId,
        warehouseId: body.warehouseId,
        locationId: fromLocationId || warehouseStock?.default_location_id || null,
        userId: user.id,
        qtyOnHandDelta: actualQty,
      });

      // Update item_warehouse current_stock
      const { error: warehouseUpdateError } = await supabase
        .from("item_warehouse")
        .update({
          current_stock: newBalance,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq("item_id", item.itemId)
        .eq("warehouse_id", body.warehouseId);

      if (warehouseUpdateError) {
        return NextResponse.json(
          { error: "Failed to update warehouse inventory" },
          { status: 500 }
        );
      }

      // For transfers, update destination warehouse
      if (body.transactionType === "transfer" && body.toWarehouseId) {
        const { data: destWarehouseStock } = await supabase
          .from("item_warehouse")
          .select("current_stock, default_location_id")
          .eq("item_id", item.itemId)
          .eq("warehouse_id", body.toWarehouseId)
          .single();

        const destCurrentBalance = destWarehouseStock
          ? parseFloat(String(destWarehouseStock.current_stock))
          : 0;

        const destNewBalance = destCurrentBalance + item.quantity;

        // Update destination warehouse stock
        if (destWarehouseStock) {
          // Update existing record
          await supabase
            .from("item_warehouse")
            .update({
              current_stock: destNewBalance,
              updated_by: user.id,
              updated_at: new Date().toISOString(),
            })
            .eq("item_id", item.itemId)
            .eq("warehouse_id", body.toWarehouseId);
        } else {
          // Create new item_warehouse record if doesn't exist
          await supabase.from("item_warehouse").insert({
            company_id: userData.company_id,
            item_id: item.itemId,
            warehouse_id: body.toWarehouseId,
            current_stock: destNewBalance,
            default_location_id: defaultToLocationId,
            created_by: user.id,
            updated_by: user.id,
          });
        }

        await adjustItemLocation({
          supabase,
          companyId: userData.company_id,
          itemId: item.itemId,
          warehouseId: body.toWarehouseId,
          locationId: toLocationId || destWarehouseStock?.default_location_id || null,
          userId: user.id,
          qtyOnHandDelta: item.quantity,
        });
      }
    }

    return NextResponse.json(
      {
        id: transaction.id,
        transactionCode: transaction.transaction_code,
        message: "Stock transaction created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
