import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

// GET /api/grns - List GRNs
export async function GET(request: NextRequest) {
  try {
    await requirePermission(RESOURCES.GOODS_RECEIPT_NOTES, "view");
    const { supabase } = await createServerClientWithBU();
    const { searchParams } = new URL(request.url);

    // Get user's company
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

    // Parse filters
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const warehouseId = searchParams.get("warehouse_id") || "";
    const loadListId = searchParams.get("load_list_id") || "";
    const fromDate = searchParams.get("from_date") || "";
    const toDate = searchParams.get("to_date") || "";
    const parsedPage = Number.parseInt(searchParams.get("page") || "1", 10);
    const parsedLimit = Number.parseInt(searchParams.get("limit") || `${DEFAULT_PAGE_SIZE}`, 10);
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const limit =
      Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(parsedLimit, MAX_PAGE_SIZE)
        : DEFAULT_PAGE_SIZE;
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from("grns")
      .select(
        `
        id,
        grn_number,
        load_list_id,
        company_id,
        business_unit_id,
        warehouse_id,
        container_number,
        seal_number,
        batch_number,
        receiving_date,
        delivery_date,
        status,
        notes,
        received_by,
        checked_by,
        created_by,
        created_at,
        updated_at,
        load_list:load_lists(id, ll_number, supplier_ll_number, supplier_id, supplier:suppliers(id, supplier_name, supplier_code)),
        warehouse:warehouses(id, warehouse_name, warehouse_code),
        business_unit:business_units(id, name, code),
        created_by_user:users!grns_created_by_fkey(id, email, first_name, last_name),
        received_by_user:users!grns_received_by_fkey(id, email, first_name, last_name),
        checked_by_user:users!grns_checked_by_fkey(id, email, first_name, last_name)
      `,
        { count: "exact" }
      )
      .eq("company_id", userData.company_id)
      .is("deleted_at", null);

    // Apply filters
    if (search) {
      query = query.or(
        `grn_number.ilike.%${search}%,container_number.ilike.%${search}%,seal_number.ilike.%${search}%`
      );
    }

    if (status) {
      query = query.eq("status", status);
    }

    if (warehouseId) {
      query = query.eq("warehouse_id", warehouseId);
    }
    if (loadListId) {
      query = query.eq("load_list_id", loadListId);
    }

    if (fromDate) {
      query = query.gte("receiving_date", fromDate);
    }

    if (toDate) {
      query = query.lte("receiving_date", toDate);
    }

    // Execute query with pagination
    const { data: grns, error, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching GRNs:", error);
      return NextResponse.json({ error: "Failed to fetch GRNs" }, { status: 500 });
    }

    // Format response
    const formattedGRNs = grns?.map((grn) => {
      const loadList = Array.isArray(grn.load_list)
        ? grn.load_list[0]
        : grn.load_list ?? null;
      const loadListSupplier = loadList
        ? Array.isArray(loadList.supplier)
          ? loadList.supplier[0]
          : loadList.supplier ?? null
        : null;
      const businessUnit = Array.isArray(grn.business_unit)
        ? grn.business_unit[0]
        : grn.business_unit ?? null;
      const warehouse = Array.isArray(grn.warehouse)
        ? grn.warehouse[0]
        : grn.warehouse ?? null;
      const receivedByUser = Array.isArray(grn.received_by_user)
        ? grn.received_by_user[0]
        : grn.received_by_user ?? null;
      const checkedByUser = Array.isArray(grn.checked_by_user)
        ? grn.checked_by_user[0]
        : grn.checked_by_user ?? null;
      const createdByUser = Array.isArray(grn.created_by_user)
        ? grn.created_by_user[0]
        : grn.created_by_user ?? null;

      return {
        id: grn.id,
        grnNumber: grn.grn_number,
        loadListId: grn.load_list_id,
        loadList: loadList
          ? {
              id: loadList.id,
              llNumber: loadList.ll_number,
              supplierLlNumber: loadList.supplier_ll_number,
              supplierId: loadList.supplier_id,
              supplier: loadListSupplier
                ? {
                    id: loadListSupplier.id,
                    name: loadListSupplier.supplier_name,
                    code: loadListSupplier.supplier_code,
                  }
                : null,
            }
          : null,
        companyId: grn.company_id,
        businessUnitId: grn.business_unit_id,
        businessUnit: businessUnit
          ? {
              id: businessUnit.id,
              name: businessUnit.name,
              code: businessUnit.code,
            }
          : null,
        warehouseId: grn.warehouse_id,
        warehouse: warehouse
          ? {
              id: warehouse.id,
              name: warehouse.warehouse_name,
              code: warehouse.warehouse_code,
            }
          : null,
        containerNumber: grn.container_number,
        sealNumber: grn.seal_number,
        batchNumber: grn.batch_number,
        receivingDate: grn.receiving_date,
        deliveryDate: grn.delivery_date,
        status: grn.status,
        notes: grn.notes,
        receivedBy: grn.received_by,
        receivedByUser: receivedByUser
          ? {
              id: receivedByUser.id,
              email: receivedByUser.email,
              firstName: receivedByUser.first_name,
              lastName: receivedByUser.last_name,
            }
          : null,
        checkedBy: grn.checked_by,
        checkedByUser: checkedByUser
          ? {
              id: checkedByUser.id,
              email: checkedByUser.email,
              firstName: checkedByUser.first_name,
              lastName: checkedByUser.last_name,
            }
          : null,
        createdBy: grn.created_by,
        createdByUser: createdByUser
          ? {
              id: createdByUser.id,
              email: createdByUser.email,
              firstName: createdByUser.first_name,
              lastName: createdByUser.last_name,
            }
          : null,
        createdAt: grn.created_at,
        updatedAt: grn.updated_at,
      };
    });

    return NextResponse.json({
      data: formattedGRNs,
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

// POST /api/grns - Create GRN (used internally by auto-creation)
export async function POST(request: NextRequest) {
  try {
    await requirePermission(RESOURCES.GOODS_RECEIPT_NOTES, "create");
    const { supabase } = await createServerClientWithBU();
    const body = await request.json();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from("users")
      .select("company_id, business_unit_id")
      .eq("id", user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: "User company not found" }, { status: 400 });
    }

    // Validate required fields
    if (!body.loadListId || !body.warehouseId || !body.deliveryDate) {
      return NextResponse.json(
        { error: "Load list ID, warehouse ID, and delivery date are required" },
        { status: 400 }
      );
    }

    // Generate GRN number
    const currentYear = new Date().getFullYear();
    const { data: lastGRN } = await supabase
      .from("grns")
      .select("grn_number")
      .eq("company_id", userData.company_id)
      .like("grn_number", `GRN-${currentYear}-%`)
      .order("grn_number", { ascending: false })
      .limit(1)
      .single();

    let nextNum = 1;
    if (lastGRN?.grn_number) {
      const match = lastGRN.grn_number.match(/GRN-\d{4}-(\d+)/);
      if (match) {
        nextNum = parseInt(match[1]) + 1;
      }
    }

    const grnNumber = `GRN-${currentYear}-${String(nextNum).padStart(4, "0")}`;

    // Create GRN
    const { data: grn, error: createError } = await supabase
      .from("grns")
      .insert({
        grn_number: grnNumber,
        load_list_id: body.loadListId,
        company_id: userData.company_id,
        business_unit_id: userData.business_unit_id,
        warehouse_id: body.warehouseId,
        container_number: body.containerNumber,
        seal_number: body.sealNumber,
        batch_number: body.batchNumber,
        receiving_date: body.receivingDate || new Date().toISOString().split("T")[0],
        delivery_date: body.deliveryDate,
        status: "draft",
        notes: body.notes,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating GRN:", createError);
      return NextResponse.json(
        { error: createError.message || "Failed to create GRN" },
        { status: 500 }
      );
    }

    // Create GRN items from load list items
    if (body.items && body.items.length > 0) {
      const itemsToInsert = body.items.map((item: { [key: string]: unknown }) => ({
        grn_id: grn.id,
        item_id: item.itemId as string,
        load_list_qty: item.loadListQty as number,
        received_qty: (item.receivedQty as number | undefined) || 0,
        damaged_qty: (item.damagedQty as number | undefined) || 0,
        num_boxes: (item.numBoxes as number | undefined) || 0,
        barcodes_printed: false,
        notes: item.notes as string | undefined,
      }));

      const { error: itemsError } = await supabase.from("grn_items").insert(itemsToInsert);

      if (itemsError) {
        console.error("Error creating GRN items:", itemsError);
        // Rollback GRN creation
        await supabase.from("grns").delete().eq("id", grn.id);
        return NextResponse.json({ error: "Failed to create GRN items" }, { status: 500 });
      }
    }

    return NextResponse.json({
      id: grn.id,
      grnNumber: grn.grn_number,
      status: grn.status,
    });
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
