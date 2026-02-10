import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requireLookupDataAccess } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

export interface ItemWithStock {
  id: string;
  code: string;
  name: string;
  chineseName?: string;
  category: string;
  categoryId: string;
  supplier: string;
  supplierId: string | null;
  onHand: number;
  allocated: number;
  available: number;
  reorderPoint: number;
  onPO: number;
  onSO: number;
  inTransit: number;
  estimatedArrivalDate?: string | null;
  status: "normal" | "low_stock" | "out_of_stock" | "overstock" | "discontinued";
  uom: string;
  uomId: string;
  standardCost: number;
  purchasePrice?: number;
  listPrice: number;
  itemType: string;
  isActive: boolean;
  imageUrl?: string;
}

export async function GET(request: NextRequest) {
  try {
    // Check permission using Lookup Data Access Pattern
    // User can access if they have EITHER:
    // 1. Direct 'items' view permission, OR
    // 2. Permission to a feature that depends on items (pos, sales_orders, etc.)
    const unauthorized = await requireLookupDataAccess(RESOURCES.ITEMS);
    if (unauthorized) return unauthorized;

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

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search");
    const category = searchParams.get("category");
    const warehouseId = searchParams.get("warehouseId");
    const supplierId = searchParams.get("supplierId");
    const stockStatus = searchParams.get("status");
    const itemType = searchParams.get("itemType");
    const parsedPage = Number.parseInt(searchParams.get("page") || "1", 10);
    const parsedLimit = Number.parseInt(searchParams.get("limit") || "10", 10);
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 10;

    type ItemRow = {
      id: string;
      item_code: string;
      item_name: string;
      item_name_cn: string | null;
      category_id?: string | null;
      item_category_id?: string | null;
      supplier_id?: string | null;
      item_categories?: { id: string; name: string } | null;
      units_of_measure?: { code: string } | null;
      uom_id: string | null;
      cost_price: number | string | null;
      purchase_price: number | string | null;
      sales_price: number | string | null;
      item_type: string;
      is_active: boolean | null;
      image_url: string | null;
    };

    type SupplierRow = {
      id: string;
      supplier_name: string;
    };

    type ItemWarehouseRow = {
      item_id: string;
      current_stock: number | string;
      reorder_level: number | string | null;
      in_transit: number | string | null;
      estimated_arrival_date: string | null;
    };

    type SalesOrderItemRow = {
      item_id: string;
      quantity: number | string;
      quantity_delivered: number | string | null;
    };

    type PurchaseOrderItemRow = {
      item_id: string;
      quantity: number | string;
      quantity_received: number | string | null;
    };

    // Fetch items with categories
    let itemsQuery = supabase
      .from("items")
      .select(
        `
        *,
        item_categories (
          id,
          name
        ),
        units_of_measure (
          code
        )
      `,
        { count: "exact" }
      )
      .eq("company_id", userData.company_id)
      .is("deleted_at", null);

    // Apply filters
    if (search) {
      itemsQuery = itemsQuery.or(
        `item_code.ilike.%${search}%,item_name.ilike.%${search}%,item_name_cn.ilike.%${search}%`
      );
    }

    if (category) {
      itemsQuery = itemsQuery.or(
        `item_category_id.eq.${category},category_id.eq.${category},item_categories.name.eq.${category}`
      );
    }

    if (supplierId) {
      itemsQuery = itemsQuery.eq("supplier_id", supplierId);
    }

    if (itemType) {
      itemsQuery = itemsQuery.eq("item_type", itemType);
    }

    // Apply pagination before fetching
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Order by item_name ascending
    itemsQuery = itemsQuery.order("item_name", { ascending: true }).range(from, to);

    const { data: items, error: itemsError, count } = await itemsQuery;

    if (itemsError) {
      return NextResponse.json({ error: "Failed to fetch items" }, { status: 500 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({
        data: [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: count ? Math.ceil(count / limit) : 0,
        },
      });
    }

    const itemIds = (items as ItemRow[]).map((i) => i.id);

    // Fetch supplier data separately
    const supplierIds = (items as ItemRow[])
      .map((i) => i.supplier_id || null)
      .filter((id): id is string => id !== null && id !== undefined);

    const suppliersMap = new Map<string, string>();

    if (supplierIds.length > 0) {
      const { data: suppliers } = await supabase
        .from("suppliers")
        .select("id, supplier_name")
        .eq("company_id", userData.company_id)
        .in("id", supplierIds);

      if (suppliers) {
        for (const supplier of suppliers as SupplierRow[]) {
          suppliersMap.set(supplier.id, supplier.supplier_name);
        }
      }
    }

    let effectiveBusinessUnitId = currentBusinessUnitId;
    if (warehouseId) {
      const { data: warehouseRow, error: warehouseError } = await supabase
        .from("warehouses")
        .select("business_unit_id")
        .eq("id", warehouseId)
        .eq("company_id", userData.company_id)
        .maybeSingle();

      if (warehouseError) {
        return NextResponse.json({ error: "Failed to resolve warehouse" }, { status: 500 });
      }

      if (!warehouseRow) {
        return NextResponse.json({ error: "Invalid warehouse filter" }, { status: 400 });
      }

      effectiveBusinessUnitId = warehouseRow.business_unit_id ?? null;
    }

    // Get current stock levels (On Hand) and reorder levels from item_warehouse
    let stockQuery = supabase
      .from("item_warehouse")
      .select(
        "item_id, warehouse_id, current_stock, reorder_level, in_transit, estimated_arrival_date, warehouses!inner(business_unit_id)"
      )
      .eq("company_id", userData.company_id)
      .in("item_id", itemIds)
      .is("deleted_at", null);

    if (effectiveBusinessUnitId) {
      stockQuery = stockQuery.eq("warehouses.business_unit_id", effectiveBusinessUnitId);
    }

    if (warehouseId) {
      stockQuery = stockQuery.eq("warehouse_id", warehouseId);
    }

    const { data: itemWarehouseData } = await stockQuery;

    // Calculate On Hand per item (sum current_stock across warehouses)
    const onHandMap = new Map<string, number>();
    const reorderPointMap = new Map<string, number>();
    const inTransitMap = new Map<string, number>();
    const estimatedArrivalMap = new Map<string, string | null>();

    if (itemWarehouseData) {
      // Sum current_stock across warehouses for each item
      for (const entry of itemWarehouseData as ItemWarehouseRow[]) {
        const itemId = entry.item_id;
        const currentQty = onHandMap.get(itemId) || 0;
        onHandMap.set(itemId, currentQty + Number(entry.current_stock));
        const currentInTransit = inTransitMap.get(itemId) || 0;
        inTransitMap.set(itemId, currentInTransit + Number(entry.in_transit || 0));

        if (entry.estimated_arrival_date) {
          const existingDate = estimatedArrivalMap.get(itemId);
          if (!existingDate || entry.estimated_arrival_date < existingDate) {
            estimatedArrivalMap.set(itemId, entry.estimated_arrival_date);
          }
        }
      }
    }

    // Calculate reorder points (use max reorder level across warehouses for each item)
    if (itemWarehouseData) {
      for (const iwData of itemWarehouseData as ItemWarehouseRow[]) {
        const itemId = iwData.item_id;
        const reorderLevel = Number(iwData.reorder_level || 0);
        const currentMax = reorderPointMap.get(itemId) || 0;
        if (reorderLevel > currentMax) {
          reorderPointMap.set(itemId, reorderLevel);
        }
      }
    }

    // Get allocated quantity (from sales_order_items where order not yet delivered)
    let salesOrderItemsQuery = supabase
      .from("sales_order_items")
      .select(
        `
        item_id,
        quantity,
        quantity_delivered,
        sales_orders!inner (
          status
        )
      `
      )
      .eq("sales_orders.company_id", userData.company_id)
      .in("item_id", itemIds)
      .in("sales_orders.status", ["draft", "confirmed", "in_progress", "shipped"]);

    if (effectiveBusinessUnitId) {
      salesOrderItemsQuery = salesOrderItemsQuery.eq(
        "sales_orders.business_unit_id",
        effectiveBusinessUnitId
      );
    }

    const { data: salesOrderItems } = await salesOrderItemsQuery;

    const allocatedMap = new Map<string, number>();
    const onSOMap = new Map<string, number>();

    if (salesOrderItems) {
      for (const item of salesOrderItems as SalesOrderItemRow[]) {
        const itemId = item.item_id;
        const pending = Number(item.quantity) - (Number(item.quantity_delivered) || 0);
        const currentAllocated = allocatedMap.get(itemId) || 0;
        const currentOnSO = onSOMap.get(itemId) || 0;
        allocatedMap.set(itemId, currentAllocated + pending);
        onSOMap.set(itemId, currentOnSO + Number(item.quantity));
      }
    }
    // Get On PO (from purchase_order_items where order not yet fully received)
    let poItemsQuery = supabase
      .from("purchase_order_items")
      .select(
        `
        item_id,
        quantity,
        quantity_received,
        purchase_orders!inner (
          status
        )
      `
      )
      .eq("purchase_orders.company_id", userData.company_id)
      .in("item_id", itemIds)
      .in("purchase_orders.status", ["draft", "approved", "partially_received"]);

    if (effectiveBusinessUnitId) {
      poItemsQuery = poItemsQuery.eq("purchase_orders.business_unit_id", effectiveBusinessUnitId);
    }

    const { data: poItems } = await poItemsQuery;

    const onPOMap = new Map<string, number>();

    if (poItems) {
      for (const item of poItems as PurchaseOrderItemRow[]) {
        const itemId = item.item_id;
        const pending = Number(item.quantity) - (Number(item.quantity_received) || 0);
        const currentOnPO = onPOMap.get(itemId) || 0;
        onPOMap.set(itemId, currentOnPO + pending);
      }
    }

    // Build enhanced items with stock data
    const itemsWithStock: ItemWithStock[] = (items as ItemRow[]).map((item) => {
      const onHand = onHandMap.get(item.id) || 0;
      const allocated = allocatedMap.get(item.id) || 0;
      const available = onHand - allocated;
      const onPO = onPOMap.get(item.id) || 0;
      const onSO = onSOMap.get(item.id) || 0;
      const inTransit = inTransitMap.get(item.id) || 0;
      const estimatedArrivalDate = estimatedArrivalMap.get(item.id) || null;
      // Get reorder level from item_warehouse data (max across warehouses)
      const reorderPoint = reorderPointMap.get(item.id) || 0;

      // Determine status
      let status: ItemWithStock["status"] = "normal";
      if (!item.is_active) {
        status = "discontinued";
      } else if (available <= 0) {
        status = "out_of_stock";
      } else if (reorderPoint > 0 && available <= reorderPoint) {
        status = "low_stock";
      } else if (reorderPoint > 0 && available > reorderPoint * 3) {
        status = "overstock";
      }

      // Get category_id and supplier_id from the actual database columns
      const categoryId = item.category_id || item.item_category_id || "";
      const supplierId = item.supplier_id || "";
      return {
        id: item.id,
        code: item.item_code,
        name: item.item_name,
        chineseName: item.item_name_cn || undefined,
        category: item.item_categories?.name || "",
        categoryId,
        supplier: supplierId ? suppliersMap.get(supplierId) || "" : "",
        supplierId,
        onHand,
        allocated,
        available,
        reorderPoint,
        onPO,
        onSO,
        inTransit,
        estimatedArrivalDate,
        status,
        uom: item.units_of_measure?.code || "",
        uomId: item.uom_id || "",
        standardCost: Number(item.cost_price) || 0,
        purchasePrice: Number(item.purchase_price) || 0,
        listPrice: Number(item.sales_price) || 0,
        itemType: item.item_type,
        isActive: item.is_active ?? true,
        imageUrl: item.image_url || undefined,
      };
    });

    // Apply filters
    let filteredItems = itemsWithStock;

    // Filter by status
    if (stockStatus && stockStatus !== "all") {
      filteredItems = filteredItems.filter((item) => item.status === stockStatus);
    }

    // Calculate statistics for all filtered items (not just current page)
    const totalAvailableValue = filteredItems.reduce(
      (sum, item) => sum + item.available * item.listPrice,
      0
    );
    const lowStockCount = filteredItems.filter((item) => item.status === "low_stock").length;
    const outOfStockCount = filteredItems.filter((item) => item.status === "out_of_stock").length;

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      data: filteredItems,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      statistics: {
        totalAvailableValue,
        lowStockCount,
        outOfStockCount,
      },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
