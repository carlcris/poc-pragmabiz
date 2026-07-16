import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";
import { requireLoadListReceivingView } from "@/lib/receiving/permissions";
import {
  LoadListLineValidationError,
  resolveLoadListLineUnitOptions,
} from "./line-item-unit-options";
import { resolveLoadListCapabilities } from "@/lib/load-lists/permissions";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

const normalizeOptionalDate = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeCurrency = (value: unknown) => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : null;
};

const resolveRequestCurrency = (value: unknown) => {
  if (value == null || value === "") return "PHP";
  const normalized = normalizeCurrency(value);
  if (!normalized) return null;
  return normalized;
};

type LoadListItemSummaryRow = {
  load_list_qty: number | string | null;
  unit_price: number | string | null;
  qty_per_unit: number | string;
};

const toNumber = (value: number | string | null | undefined) => {
  if (value == null) return 0;
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

// GET /api/load-lists
async function GETHandler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const receivingOnly = searchParams.get("receivingOnly") === "true";
    const unauthorized = receivingOnly
      ? await requireLoadListReceivingView()
      : await requirePermission(RESOURCES.LOAD_LISTS, "view");
    if (unauthorized) return unauthorized;
    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, userId, companyId, currentBusinessUnitId } = context;
    const capabilities = await resolveLoadListCapabilities(userId, currentBusinessUnitId);
    const warehouseId = searchParams.get("warehouseId");
    if (!currentBusinessUnitId) {
      return NextResponse.json({
        data: [],
        capabilities,
        pagination: {
          total: 0,
          page: 1,
          limit: DEFAULT_PAGE_SIZE,
          totalPages: 0,
        },
      });
    }

    const { data: businessUnitWarehouses, error: warehousesError } = await supabase
      .from("warehouses")
      .select("id")
      .eq("company_id", companyId)
      .eq("business_unit_id", currentBusinessUnitId)
      .eq("is_active", true)
      .is("deleted_at", null);

    if (warehousesError) {
      console.error("Error loading business-unit warehouses:", warehousesError);
      return NextResponse.json({ error: "Failed to fetch load lists" }, { status: 500 });
    }

    const businessUnitWarehouseIds = (businessUnitWarehouses ?? []).map(
      (warehouse) => warehouse.id
    );

    if (receivingOnly && (!warehouseId || !businessUnitWarehouseIds.includes(warehouseId))) {
      return NextResponse.json({
        data: [],
        capabilities,
        pagination: {
          total: 0,
          page: 1,
          limit: DEFAULT_PAGE_SIZE,
          totalPages: 0,
        },
      });
    }

    // Build query
    let query = supabase
      .from("load_lists")
      .select(
        `
        id,
        ll_number,
        supplier_ll_number,
        company_id,
        business_unit_id,
        supplier_id,
        warehouse_id,
        container_number,
        seal_number,
        batch_number,
        liner_name,
        estimated_arrival_date,
        actual_arrival_date,
        load_date,
        status,
        currency,
        created_by,
        received_by,
        approved_by,
        received_date,
        approved_date,
        notes,
        created_at,
        updated_at,
        supplier:suppliers(id, supplier_name, supplier_code),
        warehouse:warehouses(id, warehouse_name, warehouse_code, business_unit_id),
        business_unit:business_units(id, name, code),
        created_by_user:users!load_lists_created_by_fkey(id, email, first_name, last_name),
        received_by_user:users!load_lists_received_by_fkey(id, email, first_name, last_name),
        approved_by_user:users!load_lists_approved_by_fkey(id, email, first_name, last_name),
        items:load_list_items(
          load_list_qty,
          unit_price,
          qty_per_unit
        )
      `,
        { count: "exact" }
      )
      .eq("company_id", companyId)
      .is("deleted_at", null);

    query =
      businessUnitWarehouseIds.length > 0
        ? query.or(
            `business_unit_id.eq.${currentBusinessUnitId},warehouse_id.in.(${businessUnitWarehouseIds.join(",")})`
          )
        : query.eq("business_unit_id", currentBusinessUnitId);

    if (receivingOnly) {
      query = query.eq("warehouse_id", warehouseId);
    }

    // Apply filters
    const status = searchParams.get("status");
    if (receivingOnly && status === "pending_receipts") {
      query = query.in("status", ["arrived", "receiving"]);
    } else if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const supplierId = searchParams.get("supplierId");
    if (supplierId) {
      query = query.eq("supplier_id", supplierId);
    }

    if (!receivingOnly && warehouseId) {
      query = query.eq("warehouse_id", warehouseId);
    }

    const businessUnitId = searchParams.get("businessUnitId");
    if (businessUnitId) {
      query = query.eq("business_unit_id", businessUnitId);
    }

    const search = searchParams.get("search");
    if (search) {
      query = query.or(
        `ll_number.ilike.%${search}%,supplier_ll_number.ilike.%${search}%,container_number.ilike.%${search}%,seal_number.ilike.%${search}%,batch_number.ilike.%${search}%`
      );
    }

    // Date range filters
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    if (startDate) {
      query = query.gte("estimated_arrival_date", startDate);
    }
    if (endDate) {
      query = query.lte("estimated_arrival_date", endDate);
    }

    // Pagination
    const parsedPage = Number.parseInt(searchParams.get("page") || "1", 10);
    const parsedLimit = Number.parseInt(searchParams.get("limit") || `${DEFAULT_PAGE_SIZE}`, 10);
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const limit =
      Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(parsedLimit, MAX_PAGE_SIZE)
        : DEFAULT_PAGE_SIZE;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    query = query.range(from, to).order("created_at", { ascending: false });

    const { data: loadLists, error, count } = await query;

    if (error) {
      console.error("Error fetching load lists:", error);
      return NextResponse.json({ error: "Failed to fetch load lists" }, { status: 500 });
    }

    // Format response
    const formattedLoadLists = loadLists?.map((ll) => {
      const businessUnit = Array.isArray(ll.business_unit)
        ? ll.business_unit[0]
        : (ll.business_unit ?? null);
      const supplier = Array.isArray(ll.supplier) ? ll.supplier[0] : (ll.supplier ?? null);
      const warehouse = Array.isArray(ll.warehouse) ? ll.warehouse[0] : (ll.warehouse ?? null);
      const createdByUser = Array.isArray(ll.created_by_user)
        ? ll.created_by_user[0]
        : (ll.created_by_user ?? null);
      const receivedByUser = Array.isArray(ll.received_by_user)
        ? ll.received_by_user[0]
        : (ll.received_by_user ?? null);
      const approvedByUser = Array.isArray(ll.approved_by_user)
        ? ll.approved_by_user[0]
        : (ll.approved_by_user ?? null);
      const totalAmount = ((ll.items as LoadListItemSummaryRow[] | null) ?? []).reduce(
        (sum, item) => {
          return (
            sum +
            toNumber(item.load_list_qty) * toNumber(item.qty_per_unit) * toNumber(item.unit_price)
          );
        },
        0
      );

      return {
        id: ll.id,
        llNumber: ll.ll_number,
        supplierLlNumber: ll.supplier_ll_number,
        companyId: ll.company_id,
        businessUnitId: ll.business_unit_id,
        businessUnit: businessUnit
          ? {
              id: businessUnit.id,
              name: businessUnit.name,
              code: businessUnit.code,
            }
          : null,
        supplierId: ll.supplier_id,
        supplier: supplier
          ? {
              id: supplier.id,
              name: supplier.supplier_name,
              code: supplier.supplier_code,
            }
          : null,
        warehouseId: ll.warehouse_id,
        warehouse: warehouse
          ? {
              id: warehouse.id,
              name: warehouse.warehouse_name,
              code: warehouse.warehouse_code,
            }
          : null,
        isSourceBusinessUnit: ll.business_unit_id === currentBusinessUnitId,
        isTargetBusinessUnit: warehouse?.business_unit_id === currentBusinessUnitId,
        containerNumber: ll.container_number,
        sealNumber: ll.seal_number,
        batchNumber: ll.batch_number,
        linerName: ll.liner_name,
        estimatedArrivalDate: ll.estimated_arrival_date,
        actualArrivalDate: ll.actual_arrival_date,
        loadDate: ll.load_date,
        status: ll.status,
        currency: normalizeCurrency(ll.currency) ?? "PHP",
        totalAmount,
        capabilities,
        createdBy: ll.created_by,
        createdByUser: createdByUser
          ? {
              id: createdByUser.id,
              email: createdByUser.email,
              firstName: createdByUser.first_name,
              lastName: createdByUser.last_name,
            }
          : null,
        receivedBy: ll.received_by,
        receivedByUser: receivedByUser
          ? {
              id: receivedByUser.id,
              email: receivedByUser.email,
              firstName: receivedByUser.first_name,
              lastName: receivedByUser.last_name,
            }
          : null,
        approvedBy: ll.approved_by,
        approvedByUser: approvedByUser
          ? {
              id: approvedByUser.id,
              email: approvedByUser.email,
              firstName: approvedByUser.first_name,
              lastName: approvedByUser.last_name,
            }
          : null,
        receivedDate: ll.received_date,
        approvedDate: ll.approved_date,
        notes: ll.notes,
        createdAt: ll.created_at,
        updatedAt: ll.updated_at,
      };
    });

    return NextResponse.json({
      data: formattedLoadLists,
      capabilities,
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/load-lists
async function POSTHandler(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.LOAD_LISTS, "create");
    if (unauthorized) return unauthorized;
    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, userId, companyId, currentBusinessUnitId } = context;
    const body = await request.json();

    if (!currentBusinessUnitId) {
      return NextResponse.json({ error: "Business unit context required" }, { status: 400 });
    }

    // Validate required fields
    if (!body.supplierId) {
      return NextResponse.json({ error: "Supplier is required" }, { status: 400 });
    }

    if (!body.warehouseId) {
      return NextResponse.json({ error: "Warehouse is required" }, { status: 400 });
    }

    if (!body.items || body.items.length === 0) {
      return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
    }

    if (body.items.some((item: { unitPrice?: unknown }) => item.unitPrice == null)) {
      return NextResponse.json(
        { error: "Unit price is required for each load list line" },
        { status: 400 }
      );
    }

    const currency = resolveRequestCurrency(body.currency);
    if (!currency) {
      return NextResponse.json(
        { error: "Currency must be a 3-letter currency code" },
        { status: 400 }
      );
    }

    let resolvedLineItems;
    try {
      resolvedLineItems = await resolveLoadListLineUnitOptions(supabase, companyId, body.items);
    } catch (error) {
      if (error instanceof LoadListLineValidationError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }

    const estimatedArrivalDate = normalizeOptionalDate(body.estimatedArrivalDate);
    const loadDate = normalizeOptionalDate(body.loadDate);

    // Create load list
    const { data: ll, error: llError } = await supabase
      .from("load_lists")
      .insert({
        company_id: companyId,
        business_unit_id: currentBusinessUnitId,
        supplier_ll_number: body.supplierLlNumber,
        supplier_id: body.supplierId,
        warehouse_id: body.warehouseId,
        container_number: body.containerNumber,
        seal_number: body.sealNumber,
        batch_number: body.batchNumber,
        liner_name: body.linerName,
        estimated_arrival_date: estimatedArrivalDate,
        load_date: loadDate,
        status: body.status || "draft",
        currency,
        notes: body.notes,
        created_by: userId,
        updated_by: userId,
      })
      .select("id, ll_number, status, currency")
      .single();

    if (llError) {
      console.error("Error creating load list:", llError);
      return NextResponse.json({ error: "Failed to create load list" }, { status: 500 });
    }

    // Create line items
    const itemsToInsert = resolvedLineItems.map((item) => ({
      load_list_id: ll.id,
      item_id: item.itemId,
      item_unit_option_id: item.item_unit_option_id,
      uom_id: item.uom_id,
      unit_name: item.unit_name,
      qty_per_unit: item.qty_per_unit,
      load_list_qty: item.loadListQty,
      unit_price: Number(item.unitPrice),
      received_qty: 0,
      damaged_qty: 0,
      notes: item.notes,
    }));

    const { error: itemsError } = await supabase.from("load_list_items").insert(itemsToInsert);

    if (itemsError) {
      console.error("Error creating load list items:", itemsError);
      // Rollback: delete the created LL
      await supabase.from("load_lists").delete().eq("id", ll.id);
      return NextResponse.json({ error: "Failed to create load list items" }, { status: 500 });
    }

    return NextResponse.json(
      {
        id: ll.id,
        llNumber: ll.ll_number,
        status: ll.status,
        currency: ll.currency,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "load_lists",
  route: "/api/load-lists",
});
export const POST = withActivityLogging(POSTHandler, {
  action: "create",
  resourceType: "load_lists",
  route: "/api/load-lists",
});
