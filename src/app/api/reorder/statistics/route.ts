import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
type ItemWarehouseRow = {
  current_stock: number | string | null;
  reorder_level: number | string | null;
  reorder_quantity: number | string | null;
};
type ItemRow = { purchase_price: number | string | null };
type WarehouseRow = { id: string; business_unit_id: string | null };

type StockLevelRow = ItemWarehouseRow & {
  items: Pick<ItemRow, "purchase_price"> | Pick<ItemRow, "purchase_price">[] | null;
  warehouses:
    | Pick<WarehouseRow, "id" | "business_unit_id">
    | Pick<WarehouseRow, "id" | "business_unit_id">[]
    | null;
};

// GET /api/reorder/statistics
// Returns summary statistics for reorder management
export async function GET() {
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

    // Get all stock levels for the current business unit
    // Filter by warehouses belonging to current business unit
    const { data: stockLevels, error: stockError } = await supabase
      .from("item_warehouse")
      .select(
        `
        current_stock,
        reorder_level,
        reorder_quantity,
        items!inner(purchase_price),
        warehouses!inner(id, business_unit_id)
      `
      )
      .eq("company_id", userData.company_id)
      .eq("warehouses.business_unit_id", currentBusinessUnitId)
      .is("deleted_at", null)
      .is("items.deleted_at", null)
      .is("warehouses.deleted_at", null);

    if (stockError) {
      return NextResponse.json({ error: stockError.message }, { status: 500 });
    }

    // Calculate statistics
    let itemsOk = 0;
    let itemsLowStock = 0;
    let itemsCritical = 0;
    let totalEstimatedReorderCost = 0;

    (stockLevels as StockLevelRow[] | null)?.forEach((stock) => {
      const item = Array.isArray(stock.items) ? stock.items[0] : stock.items;
      const currentStock = Number(stock.current_stock || 0);
      const reorderLevel = Number(stock.reorder_level || 0);
      const reorderQuantity = Number(stock.reorder_quantity || 0);
      const purchasePrice = Number(item?.purchase_price || 0);

      // Skip items without reorder level set
      if (reorderLevel <= 0) {
        return;
      }

      const stockPercentage = (currentStock / reorderLevel) * 100;

      if (currentStock <= 0 || stockPercentage <= 50) {
        // Critical: out of stock or <= 50% of reorder level
        itemsCritical++;
        totalEstimatedReorderCost += reorderQuantity * purchasePrice;
      } else if (currentStock < reorderLevel) {
        // Low stock: between 50% and 100% of reorder level
        itemsLowStock++;
        totalEstimatedReorderCost += reorderQuantity * purchasePrice;
      } else {
        // OK: at or above reorder level
        itemsOk++;
      }
    });

    return NextResponse.json({
      itemsOk,
      itemsLowStock,
      itemsCritical,
      pendingSuggestions: 0, // Not yet implemented (requires reorder_suggestions table)
      totalEstimatedReorderCost,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
