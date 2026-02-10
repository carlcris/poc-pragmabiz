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

    const { supabase } = await createServerClientWithBU();

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
    const stockStatus = searchParams.get("status");
    const itemType = searchParams.get("itemType");
    const includeStats = searchParams.get("includeStats") !== "false";
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

    const buildItemsQuery = (warehouseItemIds?: string[] | null) => {
      let query = supabase
        .from("items")
        .select(
          `
          id,
          item_code,
          item_name,
          item_name_cn,
          category_id,
          uom_id,
          cost_price,
          purchase_price,
          sales_price,
          item_type,
          is_active,
          image_url,
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

      if (search) {
        query = query.or(
          `item_code.ilike.%${search}%,item_name.ilike.%${search}%,item_name_cn.ilike.%${search}%`
        );
      }

      if (category) {
        query = query.or(`category_id.eq.${category},item_categories.name.eq.${category}`);
      }

      if (itemType) {
        query = query.eq("item_type", itemType);
      }

      if (warehouseItemIds) {
        if (warehouseItemIds.length === 0) {
          return query.in("id", ["00000000-0000-0000-0000-000000000000"]);
        }
        query = query.in("id", warehouseItemIds);
      }

      return query;
    };

    let effectiveBusinessUnitId = null as string | null;
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

    let warehouseItemIds: string[] | null = null;
    if (warehouseId) {
      const { data: warehouseItems, error: warehouseItemsError } = await supabase
        .from("item_warehouse")
        .select("item_id")
        .eq("company_id", userData.company_id)
        .eq("warehouse_id", warehouseId)
        .is("deleted_at", null);

      if (warehouseItemsError) {
        return NextResponse.json(
          { error: "Failed to resolve warehouse items", details: warehouseItemsError.message },
          { status: 500 }
        );
      }

      warehouseItemIds = Array.from(
        new Set((warehouseItems || []).map((row) => row.item_id))
      );

      if (warehouseItemIds.length === 0) {
        return NextResponse.json({
          data: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
          statistics: {
            totalAvailableValue: 0,
            lowStockCount: 0,
            outOfStockCount: 0,
          },
        });
      }
    }

    // Apply pagination before fetching
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const itemsQuery = buildItemsQuery(warehouseItemIds)
      .order("item_name", { ascending: true })
      .range(from, to);

    const { data: items, error: itemsError, count } = await itemsQuery;

    if (itemsError) {
      return NextResponse.json(
        { error: "Failed to fetch items", details: itemsError.message },
        { status: 500 }
      );
    }

    const needsFullStatus = Boolean(stockStatus && stockStatus !== "all");
    const shouldFetchFull =
      needsFullStatus || (includeStats && count && count > (items?.length ?? 0));

    if ((!items || items.length === 0) && !shouldFetchFull) {
      return NextResponse.json({
        data: [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: count ? Math.ceil(count / limit) : 0,
        },
        statistics: {
          totalAvailableValue: 0,
          lowStockCount: 0,
          outOfStockCount: 0,
        },
      });
    }

    const itemRows = (items || []) as unknown as ItemRow[];
    const itemIds = itemRows.map((i) => i.id);

    // Supplier data not available on items (no supplier_id column)

    // Get current stock levels (On Hand) and reorder levels from item_warehouse
    let itemWarehouseData: ItemWarehouseRow[] | null = null;
    let salesOrderItems: SalesOrderItemRow[] | null = null;
    let poItems: PurchaseOrderItemRow[] | null = null;

    if (itemIds.length > 0) {
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

      // Prepare other stock-related queries (in parallel)
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
        poItemsQuery = poItemsQuery.eq(
          "purchase_orders.business_unit_id",
          effectiveBusinessUnitId
        );
      }

      const [
        { data: warehouseData, error: stockError },
        { data: soItems, error: salesOrderError },
        { data: purchaseItems, error: poItemsError },
      ] = await Promise.all([stockQuery, salesOrderItemsQuery, poItemsQuery]);

      if (stockError) {
        return NextResponse.json(
          { error: "Failed to fetch item stock data", details: stockError.message },
          { status: 500 }
        );
      }

      if (salesOrderError) {
        return NextResponse.json(
          { error: "Failed to fetch sales order allocations", details: salesOrderError.message },
          { status: 500 }
        );
      }

      if (poItemsError) {
        return NextResponse.json(
          { error: "Failed to fetch purchase order quantities", details: poItemsError.message },
          { status: 500 }
        );
      }

      itemWarehouseData = warehouseData as ItemWarehouseRow[] | null;
      salesOrderItems = soItems as SalesOrderItemRow[] | null;
      poItems = purchaseItems as PurchaseOrderItemRow[] | null;
    }

    const suppliersMap = new Map<string, string>();

    const buildStockMaps = (
      warehouseRows: ItemWarehouseRow[] | null | undefined,
      soRows: SalesOrderItemRow[] | null | undefined,
      poRows: PurchaseOrderItemRow[] | null | undefined
    ) => {
      const onHandMap = new Map<string, number>();
      const reorderPointMap = new Map<string, number>();
      const inTransitMap = new Map<string, number>();
      const estimatedArrivalMap = new Map<string, string | null>();
      const allocatedMap = new Map<string, number>();
      const onSOMap = new Map<string, number>();
      const onPOMap = new Map<string, number>();

      if (warehouseRows) {
        for (const entry of warehouseRows) {
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

          const reorderLevel = Number(entry.reorder_level || 0);
          const currentMax = reorderPointMap.get(itemId) || 0;
          if (reorderLevel > currentMax) {
            reorderPointMap.set(itemId, reorderLevel);
          }
        }
      }

      if (soRows) {
        for (const item of soRows) {
          const itemId = item.item_id;
          const pending = Number(item.quantity) - (Number(item.quantity_delivered) || 0);
          const currentAllocated = allocatedMap.get(itemId) || 0;
          const currentOnSO = onSOMap.get(itemId) || 0;
          allocatedMap.set(itemId, currentAllocated + pending);
          onSOMap.set(itemId, currentOnSO + Number(item.quantity));
        }
      }

      if (poRows) {
        for (const item of poRows) {
          const itemId = item.item_id;
          const pending = Number(item.quantity) - (Number(item.quantity_received) || 0);
          const currentOnPO = onPOMap.get(itemId) || 0;
          onPOMap.set(itemId, currentOnPO + pending);
        }
      }

      return {
        onHandMap,
        reorderPointMap,
        inTransitMap,
        estimatedArrivalMap,
        allocatedMap,
        onSOMap,
        onPOMap,
      };
    };

    const {
      onHandMap,
      reorderPointMap,
      inTransitMap,
      estimatedArrivalMap,
      allocatedMap,
      onSOMap,
      onPOMap,
    } = buildStockMaps(
      itemWarehouseData as ItemWarehouseRow[] | null,
      salesOrderItems as SalesOrderItemRow[] | null,
      poItems as PurchaseOrderItemRow[] | null
    );

    // Build enhanced items with stock data
    const itemsWithStock: ItemWithStock[] = itemRows.map((item) => {
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
      const categoryId = item.category_id || "";
      const supplierId = "";
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

    const baseStatistics = {
      totalAvailableValue: filteredItems.reduce(
        (sum, item) => sum + item.available * item.listPrice,
        0
      ),
      lowStockCount: filteredItems.filter((item) => item.status === "low_stock").length,
      outOfStockCount: filteredItems.filter((item) => item.status === "out_of_stock").length,
    };

    let statistics = baseStatistics;
    let totalFiltered = filteredItems.length;

    if (shouldFetchFull) {
      const { data: allItems, error: allItemsError } = await buildItemsQuery(warehouseItemIds);
      if (allItemsError) {
        return NextResponse.json(
          { error: "Failed to fetch items for stats", details: allItemsError.message },
          { status: 500 }
        );
      }

      const allItemRows = (allItems || []) as unknown as ItemRow[];
      const allItemIds = allItemRows.map((item) => item.id);

      if (allItemIds.length === 0) {
        filteredItems = [];
        statistics = {
          totalAvailableValue: 0,
          lowStockCount: 0,
          outOfStockCount: 0,
        };
        totalFiltered = 0;
      } else {
      let statsWarehouseQuery = supabase
        .from("item_warehouse")
        .select(
          "item_id, warehouse_id, current_stock, reorder_level, in_transit, estimated_arrival_date, warehouses!inner(business_unit_id)"
        )
        .eq("company_id", userData.company_id)
        .in("item_id", allItemIds)
        .is("deleted_at", null);

      if (effectiveBusinessUnitId) {
        statsWarehouseQuery = statsWarehouseQuery.eq(
          "warehouses.business_unit_id",
          effectiveBusinessUnitId
        );
      }

      if (warehouseId) {
        statsWarehouseQuery = statsWarehouseQuery.eq("warehouse_id", warehouseId);
      }

      let statsSalesOrderQuery = supabase
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
        .in("item_id", allItemIds)
        .in("sales_orders.status", ["draft", "confirmed", "in_progress", "shipped"]);

      if (effectiveBusinessUnitId) {
        statsSalesOrderQuery = statsSalesOrderQuery.eq(
          "sales_orders.business_unit_id",
          effectiveBusinessUnitId
        );
      }

      let statsPoQuery = supabase
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
        .in("item_id", allItemIds)
        .in("purchase_orders.status", ["draft", "approved", "partially_received"]);

      if (effectiveBusinessUnitId) {
        statsPoQuery = statsPoQuery.eq("purchase_orders.business_unit_id", effectiveBusinessUnitId);
      }

      const [
        { data: statsWarehouse, error: statsWarehouseError },
        { data: statsSales, error: statsSalesError },
        { data: statsPo, error: statsPoError },
      ] = await Promise.all([statsWarehouseQuery, statsSalesOrderQuery, statsPoQuery]);

      if (statsWarehouseError || statsSalesError || statsPoError) {
        return NextResponse.json(
          { error: "Failed to fetch stats data" },
          { status: 500 }
        );
      }

      const statsMaps = buildStockMaps(
        statsWarehouse as ItemWarehouseRow[] | null,
        statsSales as SalesOrderItemRow[] | null,
        statsPo as PurchaseOrderItemRow[] | null
      );

      const statsItemsWithStock: ItemWithStock[] = allItemRows.map((item) => {
        const onHand = statsMaps.onHandMap.get(item.id) || 0;
        const allocated = statsMaps.allocatedMap.get(item.id) || 0;
        const available = onHand - allocated;
        const onPO = statsMaps.onPOMap.get(item.id) || 0;
        const onSO = statsMaps.onSOMap.get(item.id) || 0;
        const inTransit = statsMaps.inTransitMap.get(item.id) || 0;
        const estimatedArrivalDate = statsMaps.estimatedArrivalMap.get(item.id) || null;
        const reorderPoint = statsMaps.reorderPointMap.get(item.id) || 0;

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

        return {
          id: item.id,
          code: item.item_code,
          name: item.item_name,
          chineseName: item.item_name_cn || undefined,
          category: item.item_categories?.name || "",
          categoryId: item.category_id || "",
          supplier: "",
          supplierId: "",
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

      let statsFiltered = statsItemsWithStock;
      if (stockStatus && stockStatus !== "all") {
        statsFiltered = statsFiltered.filter((item) => item.status === stockStatus);
      }

      if (needsFullStatus) {
        const startIndex = from;
        const endIndex = from + limit;
        filteredItems = statsFiltered.slice(startIndex, endIndex);
      }

      statistics = {
        totalAvailableValue: statsFiltered.reduce(
          (sum, item) => sum + item.available * item.listPrice,
          0
        ),
        lowStockCount: statsFiltered.filter((item) => item.status === "low_stock").length,
        outOfStockCount: statsFiltered.filter((item) => item.status === "out_of_stock").length,
      };

      totalFiltered = statsFiltered.length;
      }
    }

    const total = stockStatus && stockStatus !== "all" ? totalFiltered : count || 0;
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
        totalAvailableValue: statistics.totalAvailableValue,
        lowStockCount: statistics.lowStockCount,
        outOfStockCount: statistics.outOfStockCount,
      },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
