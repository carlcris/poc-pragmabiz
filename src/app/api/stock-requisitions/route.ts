import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

// GET /api/stock-requisitions
export async function GET(request: NextRequest) {
  try {
    await requirePermission(RESOURCES.STOCK_REQUISITIONS, "view");
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

    // Build query
    let query = supabase
      .from("stock_requisitions")
      .select(
        `
        *,
        supplier:suppliers(id, supplier_name, supplier_code),
        business_unit:business_units(id, name, code),
        requested_by_user:users!stock_requisitions_requested_by_fkey(id, email, first_name, last_name),
        items:stock_requisition_items(
          id,
          sr_id,
          item_id,
          requested_qty,
          unit_price,
          total_price,
          fulfilled_qty,
          outstanding_qty,
          notes,
          item:items(id, item_code, item_name)
        )
      `,
        { count: "exact" }
      )
      .eq("company_id", userData.company_id)
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

    const businessUnitId = searchParams.get("businessUnitId");
    if (businessUnitId) {
      query = query.eq("business_unit_id", businessUnitId);
    }

    const search = searchParams.get("search");
    if (search) {
      query = query.or(`sr_number.ilike.%${search}%,notes.ilike.%${search}%`);
    }

    // Date range filters
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    if (startDate) {
      query = query.gte("requisition_date", startDate);
    }
    if (endDate) {
      query = query.lte("requisition_date", endDate);
    }

    // Pagination
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    query = query.range(from, to).order("created_at", { ascending: false });

    const { data: requisitions, error, count } = await query;

    if (error) {
      console.error("Error fetching stock requisitions:", error);
      return NextResponse.json(
        { error: "Failed to fetch stock requisitions" },
        { status: 500 }
      );
    }

    // Format response
    const formattedRequisitions = requisitions?.map((sr) => ({
      id: sr.id,
      srNumber: sr.sr_number,
      companyId: sr.company_id,
      businessUnitId: sr.business_unit_id,
      businessUnit: sr.business_unit
        ? {
            id: sr.business_unit.id,
            name: sr.business_unit.name,
            code: sr.business_unit.code,
          }
        : null,
      supplierId: sr.supplier_id,
      supplier: sr.supplier
        ? {
            id: sr.supplier.id,
            name: sr.supplier.supplier_name,
            code: sr.supplier.supplier_code,
          }
        : null,
      requisitionDate: sr.requisition_date,
      requiredByDate: sr.required_by_date,
      requestedBy: sr.requested_by,
      requestedByUser: sr.requested_by_user
        ? {
            id: sr.requested_by_user.id,
            email: sr.requested_by_user.email,
            firstName: sr.requested_by_user.first_name,
            lastName: sr.requested_by_user.last_name,
          }
        : null,
      status: sr.status,
      notes: sr.notes,
      totalAmount: sr.total_amount ? parseFloat(sr.total_amount) : 0,
      items: sr.items?.map((item: any) => ({
        id: item.id,
        srId: item.sr_id,
        itemId: item.item_id,
        item: item.item
          ? {
              id: item.item.id,
              code: item.item.item_code,
              name: item.item.item_name,
            }
          : null,
        requestedQty: parseFloat(item.requested_qty),
        unitPrice: parseFloat(item.unit_price),
        totalPrice: parseFloat(item.total_price),
        fulfilledQty: parseFloat(item.fulfilled_qty),
        outstandingQty: parseFloat(item.outstanding_qty),
        notes: item.notes,
      })),
      createdAt: sr.created_at,
      updatedAt: sr.updated_at,
    }));

    return NextResponse.json({
      data: formattedRequisitions,
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

// POST /api/stock-requisitions
export async function POST(request: NextRequest) {
  try {
    await requirePermission(RESOURCES.STOCK_REQUISITIONS, "create");
    const { supabase, currentBusinessUnitId } = await createServerClientWithBU();
    const body = await request.json();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!currentBusinessUnitId) {
      return NextResponse.json({ error: "Business unit context required" }, { status: 400 });
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

    // Validate required fields
    if (!body.supplierId) {
      return NextResponse.json({ error: "Supplier is required" }, { status: 400 });
    }

    if (!body.items || body.items.length === 0) {
      return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
    }

    // Generate SR number
    const { data: lastSR } = await supabase
      .from("stock_requisitions")
      .select("sr_number")
      .eq("company_id", userData.company_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    let nextNum = 1;
    if (lastSR?.sr_number) {
      const match = lastSR.sr_number.match(/SR-(\d{4})-(\d+)/);
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
    const srNumber = `SR-${currentYear}-${String(nextNum).padStart(4, "0")}`;

    // Calculate total amount
    const totalAmount = body.items.reduce(
      (sum: number, item: { requestedQty: number; unitPrice: number }) =>
        sum + item.requestedQty * item.unitPrice,
      0
    );

    // Create stock requisition
    const { data: sr, error: srError } = await supabase
      .from("stock_requisitions")
      .insert({
        company_id: userData.company_id,
        business_unit_id: currentBusinessUnitId,
        sr_number: srNumber,
        supplier_id: body.supplierId,
        requisition_date: body.requisitionDate || new Date().toISOString().split("T")[0],
        required_by_date: body.requiredByDate || null,
        requested_by: user.id,
        status: body.status || "draft",
        notes: body.notes,
        total_amount: totalAmount,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (srError) {
      console.error("Error creating stock requisition:", srError);
      return NextResponse.json(
        { error: srError.message || "Failed to create stock requisition" },
        { status: 500 }
      );
    }

    // Create line items
    const itemsToInsert = body.items.map(
      (item: { itemId: string; requestedQty: number; unitPrice: number; notes?: string }) => ({
        sr_id: sr.id,
        item_id: item.itemId,
        requested_qty: item.requestedQty,
        unit_price: item.unitPrice,
        fulfilled_qty: 0,
        notes: item.notes,
      })
    );

    const { error: itemsError } = await supabase
      .from("stock_requisition_items")
      .insert(itemsToInsert);

    if (itemsError) {
      console.error("Error creating stock requisition items:", itemsError);
      // Rollback: delete the created SR
      await supabase.from("stock_requisitions").delete().eq("id", sr.id);
      return NextResponse.json(
        { error: "Failed to create stock requisition items" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        id: sr.id,
        srNumber: sr.sr_number,
        status: sr.status,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
