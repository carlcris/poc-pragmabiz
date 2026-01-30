/**
 * Dashboard Reorder Alerts API
 *
 * Endpoint:
 * - GET /api/analytics/dashboard/reorder-alerts - Get items below reorder point
 */

import { NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

export async function GET() {
  try {
    await requirePermission(RESOURCES.REPORTS, "view");
    const { supabase } = await createServerClientWithBU();

    // Get current user and company
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData, error: companyError } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (companyError || !userData?.company_id) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const companyId = userData.company_id;

    type ItemWarehouseAlertRow = {
      item_id: string;
      warehouse_id: string;
      current_stock: number | string | null;
      reorder_level: number | string | null;
      items:
        | {
            item_code: string;
            item_name: string;
          }
        | {
            item_code: string;
            item_name: string;
          }[];
    };

    // Get items with stock levels below reorder level across all warehouses
    const { data: alerts, error: alertsError } = await supabase
      .from("item_warehouse")
      .select(
        `
        item_id,
        warehouse_id,
        current_stock,
        reorder_level,
        items!inner (
          id,
          item_code,
          item_name,
          company_id
        )
      `
      )
      .eq("items.company_id", companyId)
      .not("reorder_level", "is", null)
      .order("current_stock", { ascending: true })
      .limit(100);

    if (alertsError) {
      return NextResponse.json({ error: "Failed to fetch reorder alerts" }, { status: 500 });
    }

    // Filter alerts where current stock is below reorder level and transform
    const reorderAlerts = ((alerts as ItemWarehouseAlertRow[] | null) || [])
      .filter((alert) => {
        const currentStock = Number(alert.current_stock) || 0;
        const reorderLevel = Number(alert.reorder_level) || 0;
        return currentStock < reorderLevel;
      })
      .sort((a, b) => {
        const aStock = Number(a.current_stock) || 0;
        const bStock = Number(b.current_stock) || 0;
        return aStock - bStock;
      })
      .slice(0, 10)
      .map((alert) => {
        const item = Array.isArray(alert.items) ? alert.items[0] : alert.items;
        return {
          id: alert.item_id,
          code: item?.item_code || "",
          name: item?.item_name || "",
          currentStock: Number(alert.current_stock) || 0,
          reorderPoint: Number(alert.reorder_level) || 0,
          warehouseId: alert.warehouse_id,
        };
      });

    return NextResponse.json(reorderAlerts);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
