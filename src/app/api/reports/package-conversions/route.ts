import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

/**
 * GET /api/reports/package-conversions
 *
 * Returns a detailed audit report of all package conversions in stock transactions.
 * Shows input quantities, selected packages, conversion factors, and normalized quantities.
 */
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
    const hasConversion = searchParams.get("hasConversion"); // Filter for only non-base package transactions
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Build query for stock transaction items with conversion metadata
    let query = supabase
      .from("stock_transaction_items")
      .select(
        `
        id,
        posting_date,
        input_qty,
        normalized_qty,
        conversion_factor,
        quantity,
        valuation_rate,
        total_amount,
        item_id,
        input_packaging_id,
        base_package_id,
        transaction:stock_transactions!inner(
          id,
          transaction_code,
          transaction_type,
          transaction_date,
          reference_number,
          warehouse_id,
          warehouse:warehouses(
            id,
            warehouse_code,
            warehouse_name
          )
        ),
        item:items!inner(
          id,
          item_code,
          item_name
        ),
        input_packaging:item_packaging!stock_transaction_items_input_packaging_id_fkey(
          id,
          pack_name,
          pack_type,
          qty_per_pack
        ),
        base_package:item_packaging!stock_transaction_items_base_package_id_fkey(
          id,
          pack_name,
          pack_type,
          qty_per_pack
        )
      `,
        { count: "exact" }
      )
      .eq("transaction.company_id", userData.company_id)
      .is("deleted_at", null)
      .order("posting_date", { ascending: false })
      .range(offset, offset + limit - 1);

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

    // Filter for only transactions that used non-base packages
    if (hasConversion === "true") {
      query = query.not("input_packaging_id", "is", null);
    }

    const { data: transactions, error, count } = await query;

    if (error) {
      console.error("Failed to fetch package conversion data:", error);
      return NextResponse.json(
        { error: "Failed to fetch package conversion data" },
        { status: 500 }
      );
    }

    // Calculate summary statistics
    const summary = {
      totalTransactions: count || 0,
      transactionsWithConversion: 0,
      transactionsWithBasePackage: 0,
      totalInputQty: 0,
      totalNormalizedQty: 0,
      averageConversionFactor: 0,
      packageTypesUsed: new Set<string>(),
    };

    let totalConversionFactor = 0;
    let conversionCount = 0;

    for (const txn of transactions || []) {
      const inputPackaging = Array.isArray(txn.input_packaging)
        ? txn.input_packaging[0]
        : txn.input_packaging;
      if (txn.input_packaging_id) {
        summary.transactionsWithConversion++;
        summary.packageTypesUsed.add(inputPackaging?.pack_type || "unknown");
        totalConversionFactor += parseFloat(String(txn.conversion_factor || 1));
        conversionCount++;
      } else {
        summary.transactionsWithBasePackage++;
      }

      summary.totalInputQty += parseFloat(String(txn.input_qty || txn.quantity || 0));
      summary.totalNormalizedQty += parseFloat(String(txn.normalized_qty || txn.quantity || 0));
    }

    if (conversionCount > 0) {
      summary.averageConversionFactor = totalConversionFactor / conversionCount;
    }

    // Format transaction data
    const formattedTransactions = (transactions || []).map((txn) => {
      const transaction = Array.isArray(txn.transaction) ? txn.transaction[0] : txn.transaction;
      const warehouse = Array.isArray(transaction?.warehouse)
        ? transaction?.warehouse[0]
        : transaction?.warehouse;
      const item = Array.isArray(txn.item) ? txn.item[0] : txn.item;
      const inputPackaging = Array.isArray(txn.input_packaging)
        ? txn.input_packaging[0]
        : txn.input_packaging;
      const basePackage = Array.isArray(txn.base_package)
        ? txn.base_package[0]
        : txn.base_package;
      return {
        id: txn.id,
        postingDate: txn.posting_date,
        transactionCode: transaction?.transaction_code,
        transactionType: transaction?.transaction_type,
        referenceNumber: transaction?.reference_number,
        warehouse: {
          id: warehouse?.id,
          code: warehouse?.warehouse_code,
          name: warehouse?.warehouse_name,
        },
        item: {
          id: item?.id,
          code: item?.item_code,
          name: item?.item_name,
        },
      inputQty: parseFloat(String(txn.input_qty || txn.quantity || 0)),
      normalizedQty: parseFloat(String(txn.normalized_qty || txn.quantity || 0)),
      conversionFactor: parseFloat(String(txn.conversion_factor || 1)),
        inputPackage: inputPackaging
        ? {
            id: inputPackaging.id,
            name: inputPackaging.pack_name,
            type: inputPackaging.pack_type,
            qtyPerPack: parseFloat(String(inputPackaging.qty_per_pack)),
          }
        : null,
        basePackage: basePackage
        ? {
            id: basePackage.id,
            name: basePackage.pack_name,
            type: basePackage.pack_type,
            qtyPerPack: parseFloat(String(basePackage.qty_per_pack)),
          }
        : null,
      valuationRate: parseFloat(String(txn.valuation_rate || 0)),
      totalAmount: parseFloat(String(txn.total_amount || 0)),
      usedConversion: !!txn.input_packaging_id,
      };
    });

    // Package type breakdown
    const packageBreakdown: Record<
      string,
      {
        packType: string;
        count: number;
        totalInputQty: number;
        totalNormalizedQty: number;
        averageConversionFactor: number;
      }
    > = {};

    for (const txn of formattedTransactions) {
      if (txn.inputPackage) {
        const packType = txn.inputPackage.type;
        if (!packageBreakdown[packType]) {
          packageBreakdown[packType] = {
            packType,
            count: 0,
            totalInputQty: 0,
            totalNormalizedQty: 0,
            averageConversionFactor: 0,
          };
        }

        packageBreakdown[packType].count++;
        packageBreakdown[packType].totalInputQty += txn.inputQty;
        packageBreakdown[packType].totalNormalizedQty += txn.normalizedQty;
        packageBreakdown[packType].averageConversionFactor =
          packageBreakdown[packType].totalNormalizedQty / packageBreakdown[packType].totalInputQty;
      }
    }

    return NextResponse.json({
      data: formattedTransactions,
      summary: {
        ...summary,
        packageTypesUsed: Array.from(summary.packageTypesUsed),
      },
      packageBreakdown: Object.values(packageBreakdown),
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: offset + limit < (count || 0),
      },
      filters: {
        startDate,
        endDate,
        warehouseId,
        itemId,
        hasConversion,
      },
    });
  } catch (error) {
    console.error("Error in package conversions report:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
