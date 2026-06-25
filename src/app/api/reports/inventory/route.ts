import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

type InventoryStatus = "all" | "on_hand" | "available" | "allocated" | "in_transit" | "zero";
type SortBy = "updated_at" | "current_stock" | "reserved_stock" | "available_stock" | "in_transit";

type InventorySourceRow = {
  id: string;
  item_id: string;
  warehouse_id: string;
  current_stock: number | string | null;
  reserved_stock: number | string | null;
  available_stock: number | string | null;
  in_transit: number | string | null;
  max_quantity: number | string | null;
  updated_at: string;
  item?:
    | {
        id: string;
        item_code: string | null;
        item_name: string | null;
        category_id: string | null;
        purchase_price: number | string | null;
        reorder_level: number | string | null;
        reorder_quantity: number | string | null;
        category?: { name: string | null } | { name: string | null }[] | null;
        uom?: { code: string | null } | { code: string | null }[] | null;
      }
    | {
        id: string;
        item_code: string | null;
        item_name: string | null;
        category_id: string | null;
        purchase_price: number | string | null;
        reorder_level: number | string | null;
        reorder_quantity: number | string | null;
        category?: { name: string | null } | { name: string | null }[] | null;
        uom?: { code: string | null } | { code: string | null }[] | null;
      }[]
    | null;
  warehouse?:
    | {
        id: string;
        warehouse_code: string | null;
        warehouse_name: string | null;
        business_unit_id: string | null;
      }
    | {
        id: string;
        warehouse_code: string | null;
        warehouse_name: string | null;
        business_unit_id: string | null;
      }[]
    | null;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SORT_FIELDS = new Set<SortBy>([
  "updated_at",
  "current_stock",
  "reserved_stock",
  "available_stock",
  "in_transit",
]);
const STATUSES = new Set<InventoryStatus>([
  "all",
  "on_hand",
  "available",
  "allocated",
  "in_transit",
  "zero",
]);

const one = <T>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

const toNumber = (value: number | string | null | undefined) => {
  if (value == null) return 0;
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

const clampPageSize = (value: string | null, fallback: number) => {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 10), 50);
};

const escapeFilterValue = (value: string) =>
  value
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_")
    .replaceAll(",", "\\,");

const resolveStatus = (
  currentStock: number,
  reservedStock: number,
  availableStock: number,
  inTransit: number,
  reorderLevel: number
): InventoryStatus => {
  if (currentStock <= 0 && inTransit <= 0) return "zero";
  if (availableStock > 0 && reorderLevel > 0 && availableStock <= reorderLevel) return "available";
  if (reservedStock > 0) return "allocated";
  if (inTransit > 0) return "in_transit";
  if (currentStock > 0) return "on_hand";
  return "zero";
};

export async function GET(request: NextRequest) {
  try {
    await requirePermission(RESOURCES.REPORTS, "view");
    const { supabase } = await createServerClientWithBU();
    const { searchParams } = new URL(request.url);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single();
    if (!userData?.company_id) {
      return NextResponse.json({ error: "User company not found" }, { status: 400 });
    }

    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = clampPageSize(searchParams.get("limit"), 25);
    const warehouseId = searchParams.get("warehouseId") || undefined;
    const category = searchParams.get("category") || undefined;
    const search = searchParams.get("search")?.trim() || undefined;
    const stockStatus = STATUSES.has(searchParams.get("stockStatus") as InventoryStatus)
      ? (searchParams.get("stockStatus") as InventoryStatus)
      : "all";
    const sortBy = SORT_FIELDS.has(searchParams.get("sortBy") as SortBy)
      ? (searchParams.get("sortBy") as SortBy)
      : "updated_at";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const baseSelect = `
      id,
      item_id,
      warehouse_id,
      current_stock,
      reserved_stock,
      available_stock,
      in_transit,
      max_quantity,
      updated_at,
      item:items!inner(
        id,
        item_code,
        item_name,
        category_id,
        purchase_price,
        reorder_level,
        reorder_quantity,
        category:item_categories(id, name),
        uom:units_of_measure(id, code, name)
      ),
      warehouse:warehouses!inner(
        id,
        warehouse_code,
        warehouse_name,
        business_unit_id
      )
    `;

    let countQuery = supabase
      .from("item_warehouse")
      .select(
        "id, item:items!inner(id, item_code, item_name, category_id, category:item_categories(id, name)), warehouse:warehouses!inner(id, business_unit_id)",
        {
          count: "exact",
          head: true,
        }
      )
      .eq("company_id", userData.company_id)
      .is("deleted_at", null)
      .eq("is_active", true);

    let dataQuery = supabase
      .from("item_warehouse")
      .select(baseSelect)
      .eq("company_id", userData.company_id)
      .is("deleted_at", null)
      .eq("is_active", true);

    if (warehouseId) {
      countQuery = countQuery.eq("warehouse_id", warehouseId);
      dataQuery = dataQuery.eq("warehouse_id", warehouseId);
    }

    if (category) {
      if (UUID_REGEX.test(category)) {
        countQuery = countQuery.eq("item.category_id", category);
        dataQuery = dataQuery.eq("item.category_id", category);
      } else {
        countQuery = countQuery.eq("item.category.name", category);
        dataQuery = dataQuery.eq("item.category.name", category);
      }
    }

    if (search) {
      const escapedSearch = escapeFilterValue(search);
      countQuery = countQuery.or(
        `item_code.ilike.%${escapedSearch}%,item_name.ilike.%${escapedSearch}%`,
        {
          foreignTable: "item",
        }
      );
      dataQuery = dataQuery.or(
        `item_code.ilike.%${escapedSearch}%,item_name.ilike.%${escapedSearch}%`,
        {
          foreignTable: "item",
        }
      );
    }

    if (stockStatus === "on_hand") {
      countQuery = countQuery.gt("current_stock", 0);
      dataQuery = dataQuery.gt("current_stock", 0);
    } else if (stockStatus === "available") {
      countQuery = countQuery.gt("available_stock", 0);
      dataQuery = dataQuery.gt("available_stock", 0);
    } else if (stockStatus === "allocated") {
      countQuery = countQuery.gt("reserved_stock", 0);
      dataQuery = dataQuery.gt("reserved_stock", 0);
    } else if (stockStatus === "in_transit") {
      countQuery = countQuery.gt("in_transit", 0);
      dataQuery = dataQuery.gt("in_transit", 0);
    } else if (stockStatus === "zero") {
      countQuery = countQuery.lte("current_stock", 0).lte("in_transit", 0);
      dataQuery = dataQuery.lte("current_stock", 0).lte("in_transit", 0);
    }

    const { count, error: countError } = await countQuery;
    if (countError) {
      console.error("Error counting inventory report rows:", countError);
      return NextResponse.json({ error: "Failed to fetch inventory report" }, { status: 500 });
    }

    dataQuery = dataQuery
      .order(sortBy, { ascending: sortOrder === "asc" })
      .order("id", { ascending: true })
      .range(from, to);

    const { data, error } = await dataQuery;
    if (error) {
      console.error("Error fetching inventory report rows:", error);
      return NextResponse.json({ error: "Failed to fetch inventory report" }, { status: 500 });
    }

    const rows = ((data || []) as InventorySourceRow[]).map((row) => {
      const item = one(row.item);
      const warehouse = one(row.warehouse);
      const categoryName = one(item?.category)?.name || "Uncategorized";
      const uom = one(item?.uom);
      const currentStock = toNumber(row.current_stock);
      const reservedStock = toNumber(row.reserved_stock);
      const availableStock = toNumber(row.available_stock);
      const inTransit = toNumber(row.in_transit);
      const reorderLevel = toNumber(item?.reorder_level);
      const reorderQuantity = toNumber(item?.reorder_quantity);
      const unitCost = Math.max(0, toNumber(item?.purchase_price));

      return {
        id: row.id,
        itemId: row.item_id,
        itemCode: item?.item_code || null,
        itemName: item?.item_name || null,
        category: categoryName,
        uom: uom?.code || "",
        warehouseId: row.warehouse_id,
        warehouseCode: warehouse?.warehouse_code || null,
        warehouseName: warehouse?.warehouse_name || null,
        currentStock,
        reservedStock,
        availableStock,
        inTransit,
        reorderLevel,
        reorderQuantity,
        maxQuantity: row.max_quantity == null ? null : toNumber(row.max_quantity),
        unitCost,
        stockValue: currentStock * unitCost,
        status: resolveStatus(currentStock, reservedStock, availableStock, inTransit, reorderLevel),
        updatedAt: row.updated_at,
      };
    });

    const total = count || 0;

    return NextResponse.json({
      data: rows,
      summary: {
        rowCount: total,
        pageQtyOnHand: rows.reduce((sum, row) => sum + row.currentStock, 0),
        pageQtyReserved: rows.reduce((sum, row) => sum + row.reservedStock, 0),
        pageQtyAvailable: rows.reduce((sum, row) => sum + row.availableStock, 0),
        pageQtyInTransit: rows.reduce((sum, row) => sum + row.inTransit, 0),
        pageStockValue: rows.reduce((sum, row) => sum + row.stockValue, 0),
        lowStockRows: rows.filter(
          (row) =>
            row.reorderLevel > 0 && row.availableStock > 0 && row.availableStock <= row.reorderLevel
        ).length,
        outOfStockRows: rows.filter((row) => row.currentStock <= 0 && row.inTransit <= 0).length,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      filters: {
        warehouseId: warehouseId || null,
        category: category || null,
        search: search || null,
        stockStatus,
        sortBy,
        sortOrder,
        currentBusinessUnitId: null,
      },
    });
  } catch (error) {
    console.error("Error generating inventory report:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
