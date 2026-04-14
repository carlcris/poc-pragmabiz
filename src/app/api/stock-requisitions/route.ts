import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";
import {
  resolveStockRequisitionLineUnitOptions,
  StockRequisitionLineValidationError,
} from "./line-item-unit-options";
import { transformItemUnitOptionRow, type DbItemUnitOptionRow } from "@/lib/items/itemUnitOptions";

// GET /api/stock-requisitions
export async function GET(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUISITIONS, "view");
    if (unauthorized) return unauthorized;
    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, companyId } = context;
    const { searchParams } = new URL(request.url);

    // Build query
    let query = supabase
      .from("stock_requisitions")
      .select(
        `
        *,
        supplier:suppliers(id, supplier_name, supplier_code),
        business_unit:business_units(id, name, code),
        requested_by_user:users!stock_requisitions_requested_by_fkey(id, email, first_name, last_name),
        created_by_user:users!stock_requisitions_created_by_fkey(id, email, first_name, last_name),
        items:stock_requisition_items(
          id,
          sr_id,
          item_id,
          item_unit_option_id,
          uom_id,
          requested_qty,
          unit_price,
          total_price,
          fulfilled_qty,
          outstanding_qty,
          notes,
          item:items(id, item_code, item_name),
          units_of_measure(id, code, symbol),
          item_unit_options(
            id,
            item_id,
            uom_id,
            option_label,
            qty_per_unit,
            barcode,
            is_base,
            is_default,
            is_active,
            sort_order,
            units_of_measure(id, code, name, symbol)
          )
        )
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

    type StockRequisitionListItemRow = {
      id: string;
      sr_id: string;
      item_id: string;
      item_unit_option_id?: string | null;
      uom_id: string;
      units_of_measure?: {
        id: string;
        code: string;
        symbol?: string | null;
      } | null;
      item_unit_options?: (DbItemUnitOptionRow & {
        units_of_measure?: {
          id: string;
          code: string;
          name: string;
          symbol: string | null;
        } | {
          id: string;
          code: string;
          name: string;
          symbol: string | null;
        }[] | null;
      }) | null;
      item?: {
        id: string;
        item_code: string;
        item_name: string;
      } | null;
      requested_qty: number | string;
      unit_price: number | string;
      total_price: number | string;
      fulfilled_qty: number | string;
      outstanding_qty: number | string;
      notes: string | null;
    };

    // Format response
    const formattedRequisitions = requisitions?.map((sr) => {
      const formattedItems = (sr.items as StockRequisitionListItemRow[] | null)?.map((item) => {
        const itemUnitOptionDetails = Array.isArray(item.item_unit_options)
          ? item.item_unit_options[0] ?? null
          : item.item_unit_options ?? null;
        const baseUomCode = item.units_of_measure?.code || "";
        const qtyPerUnit = Number(itemUnitOptionDetails?.qty_per_unit ?? 1) || 1;
        const requestedQty = Number(item.requested_qty ?? 0);
        const unitPrice = Number(item.unit_price ?? 0);

        return {
          id: item.id,
          srId: item.sr_id,
          itemId: item.item_id,
          itemUnitOptionId: item.item_unit_option_id,
          uomId: item.uom_id,
          uomCode: item.units_of_measure?.code || undefined,
          itemUnitOption: itemUnitOptionDetails
            ? transformItemUnitOptionRow(itemUnitOptionDetails as DbItemUnitOptionRow, baseUomCode)
            : null,
          item: item.item
            ? {
                id: item.item.id,
                code: item.item.item_code,
                name: item.item.item_name,
              }
            : null,
          requestedQty,
          unitPrice,
          totalPrice: requestedQty * qtyPerUnit * unitPrice,
          fulfilledQty: Number(item.fulfilled_qty ?? 0),
          outstandingQty: Number(item.outstanding_qty ?? 0),
          notes: item.notes,
        };
      }) || [];

      return {
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
        totalAmount: formattedItems.reduce((sum, item) => sum + item.totalPrice, 0),
        items: formattedItems,
        createdBy: sr.created_by,
        createdByUser: sr.created_by_user
          ? {
              id: sr.created_by_user.id,
              email: sr.created_by_user.email,
              firstName: sr.created_by_user.first_name,
              lastName: sr.created_by_user.last_name,
            }
          : null,
        createdAt: sr.created_at,
        updatedAt: sr.updated_at,
      };
    });

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
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUISITIONS, "create");
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

    if (!body.items || body.items.length === 0) {
      return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
    }

    let resolvedLineItems;
    try {
      resolvedLineItems = await resolveStockRequisitionLineUnitOptions(supabase, companyId, body.items);
    } catch (error) {
      if (error instanceof StockRequisitionLineValidationError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }

    // Generate SR number
    const { data: lastSR } = await supabase
      .from("stock_requisitions")
      .select("sr_number")
      .eq("company_id", companyId)
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
    const totalAmount = resolvedLineItems.reduce(
      (
        sum: number,
        item: { requestedQty: number; unitPrice: number; qty_per_unit: number }
      ) => sum + item.requestedQty * item.qty_per_unit * item.unitPrice,
      0
    );

    // Create stock requisition
    const { data: sr, error: srError } = await supabase
      .from("stock_requisitions")
      .insert({
        company_id: companyId,
        business_unit_id: currentBusinessUnitId,
        sr_number: srNumber,
        supplier_id: body.supplierId,
        requisition_date: body.requisitionDate || new Date().toISOString().split("T")[0],
        required_by_date: body.requiredByDate || null,
        requested_by: userId,
        status: body.status || "draft",
        notes: body.notes,
        total_amount: totalAmount,
        created_by: userId,
        updated_by: userId,
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
    const itemsToInsert = resolvedLineItems.map(
      (item: {
        itemId: string;
        item_unit_option_id: string;
        uom_id: string;
        requestedQty: number;
        unitPrice: number;
        notes?: string;
      }) => ({
        sr_id: sr.id,
        item_id: item.itemId,
        item_unit_option_id: item.item_unit_option_id,
        uom_id: item.uom_id,
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
