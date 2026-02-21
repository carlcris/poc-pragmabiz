import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

// GET /api/load-lists
export async function GET(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.LOAD_LISTS, "view");
    if (unauthorized) return unauthorized;
    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, companyId } = context;
    const { searchParams } = new URL(request.url);

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
        estimated_arrival_date,
        actual_arrival_date,
        load_date,
        status,
        created_by,
        received_by,
        approved_by,
        received_date,
        approved_date,
        notes,
        created_at,
        updated_at,
        supplier:suppliers(id, supplier_name, supplier_code),
        warehouse:warehouses(id, warehouse_name, warehouse_code),
        business_unit:business_units(id, name, code),
        created_by_user:users!load_lists_created_by_fkey(id, email, first_name, last_name),
        received_by_user:users!load_lists_received_by_fkey(id, email, first_name, last_name),
        approved_by_user:users!load_lists_approved_by_fkey(id, email, first_name, last_name)
      `,
        { count: "exact" }
      )
      .eq("company_id", companyId)
      .is("deleted_at", null);

    // Apply filters
    const status = searchParams.get("status");
    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const supplierId = searchParams.get("supplierId");
    if (supplierId) {
      query = query.eq("supplier_id", supplierId);
    }

    const warehouseId = searchParams.get("warehouseId");
    if (warehouseId) {
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
        : ll.business_unit ?? null;
      const supplier = Array.isArray(ll.supplier) ? ll.supplier[0] : ll.supplier ?? null;
      const warehouse = Array.isArray(ll.warehouse) ? ll.warehouse[0] : ll.warehouse ?? null;
      const createdByUser = Array.isArray(ll.created_by_user)
        ? ll.created_by_user[0]
        : ll.created_by_user ?? null;
      const receivedByUser = Array.isArray(ll.received_by_user)
        ? ll.received_by_user[0]
        : ll.received_by_user ?? null;
      const approvedByUser = Array.isArray(ll.approved_by_user)
        ? ll.approved_by_user[0]
        : ll.approved_by_user ?? null;

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
        containerNumber: ll.container_number,
        sealNumber: ll.seal_number,
        batchNumber: ll.batch_number,
        estimatedArrivalDate: ll.estimated_arrival_date,
        actualArrivalDate: ll.actual_arrival_date,
        loadDate: ll.load_date,
        status: ll.status,
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
export async function POST(request: NextRequest) {
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

    // Generate LL number
    const { data: lastLL } = await supabase
      .from("load_lists")
      .select("ll_number")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    let nextNum = 1;
    if (lastLL?.ll_number) {
      const match = lastLL.ll_number.match(/LL-(\d{4})-(\d+)/);
      if (match) {
        const year = new Date().getFullYear();
        const lastYear = parseInt(match[1]);
        const lastNum = parseInt(match[2]);

        if (year === lastYear) {
          nextNum = lastNum + 1;
        }
      }
    }

    const currentYear = new Date().getFullYear();
    const llNumber = `LL-${currentYear}-${String(nextNum).padStart(4, "0")}`;

    // Create load list
    const { data: ll, error: llError } = await supabase
      .from("load_lists")
      .insert({
        company_id: companyId,
        business_unit_id: currentBusinessUnitId,
        ll_number: llNumber,
        supplier_ll_number: body.supplierLlNumber,
        supplier_id: body.supplierId,
        warehouse_id: body.warehouseId,
        container_number: body.containerNumber,
        seal_number: body.sealNumber,
        batch_number: body.batchNumber,
        estimated_arrival_date: body.estimatedArrivalDate,
        load_date: body.loadDate,
        status: body.status || "draft",
        notes: body.notes,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (llError) {
      console.error("Error creating load list:", llError);
      return NextResponse.json(
        { error: llError.message || "Failed to create load list" },
        { status: 500 }
      );
    }

    // Create line items
    const itemsToInsert = body.items.map(
      (item: { itemId: string; loadListQty: number; unitPrice: number; notes?: string }) => ({
        load_list_id: ll.id,
        item_id: item.itemId,
        load_list_qty: item.loadListQty,
        unit_price: item.unitPrice,
        received_qty: 0,
        damaged_qty: 0,
        notes: item.notes,
      })
    );

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
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
