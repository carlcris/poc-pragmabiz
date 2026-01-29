import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import type { Tables } from "@/types/supabase";

type ItemWarehouseRow = Tables<"item_warehouse">;
type ItemRow = Tables<"items">;
type WarehouseRow = Tables<"warehouses">;

type StockLevelRow = ItemWarehouseRow & {
  items: Pick<ItemRow, "item_code" | "item_name">;
  warehouses: Pick<WarehouseRow, "warehouse_name">;
};

type ReorderAlert = {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  warehouseId: string;
  warehouseName: string;
  currentStock: number;
  reorderPoint: number;
  reorderQuantity: number;
  minimumLevel: number;
  maxQuantity: number;
  severity: "critical" | "warning" | "info";
  message: string;
  alertType: "low_stock";
  createdAt: string;
  acknowledged: boolean;
};

// GET /api/reorder/alerts
// Returns low stock alerts based on current stock levels and reorder levels
export async function GET(request: NextRequest) {
  try {
    await requirePermission(RESOURCES.REORDER_MANAGEMENT, "view");
    const { supabase, currentBusinessUnitId } = await createServerClientWithBU();

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

    // Validate business unit context
    if (!currentBusinessUnitId) {
      return NextResponse.json({ error: "Business unit context required" }, { status: 400 });
    }

    const searchParams = request.nextUrl.searchParams;
    const severity = searchParams.get("severity");
    const warehouseId = searchParams.get("warehouseId");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    // Query items with stock levels below reorder point
    // We compare current_stock against reorder_level to detect low stock
    // Filter by warehouses belonging to current business unit
    let query = supabase
      .from("item_warehouse")
      .select(
        `
        id,
        item_id,
        warehouse_id,
        current_stock,
        reorder_level,
        reorder_quantity,
        max_quantity,
        items!inner (
          id,
          item_code,
          item_name
        ),
        warehouses!inner (
          id,
          warehouse_code,
          warehouse_name,
          business_unit_id
        )
      `,
        { count: "exact" }
      )
      .eq("company_id", userData.company_id)
      .eq("warehouses.business_unit_id", currentBusinessUnitId)
      .is("deleted_at", null)
      .is("items.deleted_at", null)
      .is("warehouses.deleted_at", null);

    // Apply filters
    if (warehouseId) {
      query = query.eq("warehouse_id", warehouseId);
    }

    // Execute query
    const { data: stockLevels, error } = await query.range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Process alerts - filter by stock level and determine severity
    const alerts = ((stockLevels as StockLevelRow[] | null) || [])
      .map((stock) => {
        const currentStock = Number(stock.current_stock || 0);
        const reorderLevel = Number(stock.reorder_level || 0);
        const reorderQuantity = Number(stock.reorder_quantity || 0);
        const maxQuantity = Number(stock.max_quantity || 0);

        // Skip items without reorder level set or with adequate stock
        if (reorderLevel <= 0 || currentStock >= reorderLevel) {
          return null;
        }

        // Determine severity based on how far below reorder level
        // Critical: stock is at or below 50% of reorder level
        // Warning: stock is between 50% and 100% of reorder level
        const stockPercentage = (currentStock / reorderLevel) * 100;
        let alertSeverity: "critical" | "warning" | "info";
        let message: string;

        if (currentStock <= 0) {
          alertSeverity = "critical";
          message = "Out of stock - immediate action required";
        } else if (stockPercentage <= 50) {
          alertSeverity = "critical";
          message = `Critical low stock: ${currentStock.toFixed(2)} units remaining (${stockPercentage.toFixed(0)}% of reorder level)`;
        } else {
          alertSeverity = "warning";
          message = `Low stock: ${currentStock.toFixed(2)} units remaining (below reorder level of ${reorderLevel})`;
        }

        return {
          id: stock.id,
          itemId: stock.item_id,
          itemCode: stock.items.item_code,
          itemName: stock.items.item_name,
          warehouseId: stock.warehouse_id,
          warehouseName: stock.warehouses.warehouse_name,
          currentStock: currentStock,
          reorderPoint: reorderLevel,
          reorderQuantity: reorderQuantity,
          minimumLevel: reorderLevel * 0.5, // Use 50% of reorder level as minimum
          maxQuantity: maxQuantity,
          severity: alertSeverity,
          message,
          alertType: "low_stock",
          createdAt: new Date().toISOString(),
          acknowledged: false,
        };
      })
      .filter((alert): alert is ReorderAlert => alert !== null); // Remove nulls (items with adequate stock)

    // Apply severity filter if provided
    const filteredAlerts = severity
      ? alerts.filter((alert) => alert.severity === severity)
      : alerts;

    // Note: acknowledged filter not yet implemented (would require reorder_alerts table)
    // For now, all alerts are unacknowledged

    return NextResponse.json({
      data: filteredAlerts,
      pagination: {
        page,
        limit,
        total: filteredAlerts.length,
        totalPages: Math.ceil(filteredAlerts.length / limit),
      },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
