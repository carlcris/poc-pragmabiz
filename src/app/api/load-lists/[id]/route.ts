import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";
import {
  LoadListLineValidationError,
  resolveLoadListLineUnitOptions,
} from "../line-item-unit-options";
import { transformItemUnitOptionRow, type DbItemUnitOptionRow } from "@/lib/items/itemUnitOptions";
import { resolveLoadListCapabilities } from "@/lib/load-lists/permissions";

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

type LoadListItemRow = {
  id: string;
  item_id: string;
  item_unit_option_id?: string | null;
  uom_id?: string | null;
  load_list_qty: number | string;
  received_qty: number | string;
  damaged_qty: number | string;
  shortage_qty: number | string;
  unit_price: number | string;
  total_price: number | string;
  notes: string | null;
  item?:
    | {
        id: string;
        item_code: string;
        item_name: string;
      }
    | {
        id: string;
        item_code: string;
        item_name: string;
      }[]
    | null;
  units_of_measure?:
    | {
        id: string;
        code: string;
        symbol?: string | null;
      }
    | {
        id: string;
        code: string;
        symbol?: string | null;
      }[]
    | null;
  item_unit_options?:
    | (DbItemUnitOptionRow & {
        units_of_measure?:
          | {
              id: string;
              code: string;
              name: string;
              symbol: string | null;
            }
          | {
              id: string;
              code: string;
              name: string;
              symbol: string | null;
            }[]
          | null;
      })
    | (DbItemUnitOptionRow & {
        units_of_measure?:
          | {
              id: string;
              code: string;
              name: string;
              symbol: string | null;
            }
          | {
              id: string;
              code: string;
              name: string;
              symbol: string | null;
            }[]
          | null;
      })[]
    | null;
};

// GET /api/load-lists/[id]
async function GETHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const unauthorized = await requirePermission(RESOURCES.LOAD_LISTS, "view");
    if (unauthorized) return unauthorized;
    const { id } = await params;
    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, userId, companyId, currentBusinessUnitId } = context;
    const capabilities = await resolveLoadListCapabilities(userId, currentBusinessUnitId);

    // Fetch load list with related data
    const { data: ll, error } = await supabase
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
        updated_by,
        supplier:suppliers(id, supplier_name, supplier_code, contact_person, email, phone),
        warehouse:warehouses(id, warehouse_name, warehouse_code),
        business_unit:business_units(id, name, code),
        created_by_user:users!load_lists_created_by_fkey(id, email, first_name, last_name),
        received_by_user:users!load_lists_received_by_fkey(id, email, first_name, last_name),
        approved_by_user:users!load_lists_approved_by_fkey(id, email, first_name, last_name),
        items:load_list_items(
          id,
          item_id,
          item_unit_option_id,
          uom_id,
          load_list_qty,
          received_qty,
          damaged_qty,
          shortage_qty,
          unit_price,
          total_price,
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
      `
      )
      .eq("id", id)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .single();

    if (error) {
      console.error("Error fetching load list:", error);
      return NextResponse.json({ error: "Load list not found" }, { status: 404 });
    }

    // Format response
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
    const formattedLL = {
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
            contactPerson: supplier.contact_person,
            email: supplier.email,
            phone: supplier.phone,
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
      linerName: ll.liner_name,
      estimatedArrivalDate: ll.estimated_arrival_date,
      actualArrivalDate: ll.actual_arrival_date,
      loadDate: ll.load_date,
      status: ll.status,
      currency: normalizeCurrency(ll.currency) ?? "PHP",
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
      totalAmount: (ll.items as LoadListItemRow[] | null)?.reduce((sum, item) => {
        const unitDetails = Array.isArray(item.item_unit_options)
          ? (item.item_unit_options[0] ?? null)
          : (item.item_unit_options ?? null);
        const qtyPerUnit = Number(unitDetails?.qty_per_unit ?? 1) || 1;
        return (
          sum +
          parseFloat(String(item.load_list_qty)) * qtyPerUnit * parseFloat(String(item.unit_price))
        );
      }, 0),
      capabilities,
      items: (ll.items as LoadListItemRow[] | null)?.map((item) => {
        const itemDetails = Array.isArray(item.item) ? (item.item[0] ?? null) : (item.item ?? null);
        const unitDetails = Array.isArray(item.item_unit_options)
          ? (item.item_unit_options[0] ?? null)
          : (item.item_unit_options ?? null);
        const uomDetails = Array.isArray(item.units_of_measure)
          ? (item.units_of_measure[0] ?? null)
          : (item.units_of_measure ?? null);
        const baseUomCode = uomDetails?.code || "";
        const qtyPerUnit = Number(unitDetails?.qty_per_unit ?? 1) || 1;
        const loadListQty = parseFloat(String(item.load_list_qty));
        const unitPrice = parseFloat(String(item.unit_price));
        return {
          id: item.id,
          itemId: item.item_id,
          itemUnitOptionId: item.item_unit_option_id,
          uomId: item.uom_id || undefined,
          uomCode: uomDetails?.code || undefined,
          itemUnitOption: unitDetails
            ? transformItemUnitOptionRow(unitDetails as DbItemUnitOptionRow, baseUomCode)
            : null,
          item: itemDetails
            ? {
                id: itemDetails.id,
                code: itemDetails.item_code,
                name: itemDetails.item_name,
              }
            : null,
          loadListQty,
          receivedQty: parseFloat(String(item.received_qty)),
          damagedQty: parseFloat(String(item.damaged_qty)),
          shortageQty: parseFloat(String(item.shortage_qty)),
          unitPrice,
          totalPrice: loadListQty * qtyPerUnit * unitPrice,
          notes: item.notes,
        };
      }),
      createdAt: ll.created_at,
      updatedAt: ll.updated_at,
      updatedBy: ll.updated_by,
    };

    return NextResponse.json(formattedLL);
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/load-lists/[id]
async function PUTHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const unauthorized = await requirePermission(RESOURCES.LOAD_LISTS, "edit");
    if (unauthorized) return unauthorized;
    const { id } = await params;
    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, userId, companyId } = context;
    const body = await request.json();

    // Check if load list exists
    const { data: existingLL, error: fetchError } = await supabase
      .from("load_lists")
      .select("id, status, currency")
      .eq("id", id)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .single();

    if (fetchError || !existingLL) {
      return NextResponse.json({ error: "Load list not found" }, { status: 404 });
    }

    // Only allow editing draft and confirmed load lists
    if (!["draft", "confirmed"].includes(existingLL.status)) {
      return NextResponse.json(
        { error: "Only draft or confirmed load lists can be edited" },
        { status: 400 }
      );
    }

    if (body.items && body.items.length === 0) {
      return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
    }

    if (body.items?.some((item: { unitPrice?: unknown }) => item.unitPrice == null)) {
      return NextResponse.json(
        { error: "Unit price is required for each load list line" },
        { status: 400 }
      );
    }

    const currency =
      body.currency === undefined ? existingLL.currency : resolveRequestCurrency(body.currency);

    if (!currency) {
      return NextResponse.json(
        { error: "Currency must be a 3-letter currency code" },
        { status: 400 }
      );
    }

    let resolvedLineItems;
    if (body.items && body.items.length > 0 && existingLL.status === "draft") {
      try {
        resolvedLineItems = await resolveLoadListLineUnitOptions(supabase, companyId, body.items);
      } catch (error) {
        if (error instanceof LoadListLineValidationError) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        throw error;
      }
    }

    const estimatedArrivalDate = normalizeOptionalDate(body.estimatedArrivalDate);
    const loadDate = normalizeOptionalDate(body.loadDate);

    // Update load list
    const { data: ll, error: updateError } = await supabase
      .from("load_lists")
      .update({
        supplier_ll_number: body.supplierLlNumber,
        supplier_id: body.supplierId,
        warehouse_id: body.warehouseId,
        container_number: body.containerNumber,
        seal_number: body.sealNumber,
        batch_number: body.batchNumber,
        liner_name: body.linerName,
        estimated_arrival_date: estimatedArrivalDate,
        load_date: loadDate,
        currency,
        notes: body.notes,
        updated_by: userId,
      })
      .eq("id", id)
      .select("id, ll_number, status, currency")
      .single();

    if (updateError) {
      console.error("Error updating load list:", updateError);
      return NextResponse.json({ error: "Failed to update load list" }, { status: 500 });
    }

    // Update line items if provided and status is draft
    if (resolvedLineItems && resolvedLineItems.length > 0) {
      // Delete existing items
      await supabase.from("load_list_items").delete().eq("load_list_id", id);

      // Insert new items
      const itemsToInsert = resolvedLineItems.map((item) => ({
        load_list_id: id,
        item_id: item.itemId,
        item_unit_option_id: item.item_unit_option_id,
        uom_id: item.uom_id,
        load_list_qty: item.loadListQty,
        unit_price: Number(item.unitPrice),
        received_qty: 0,
        damaged_qty: 0,
        notes: item.notes,
      }));

      const { error: itemsError } = await supabase.from("load_list_items").insert(itemsToInsert);

      if (itemsError) {
        console.error("Error updating load list items:", itemsError);
        return NextResponse.json({ error: "Failed to update load list items" }, { status: 500 });
      }
    }

    return NextResponse.json({
      id: ll.id,
      llNumber: ll.ll_number,
      status: ll.status,
      currency: ll.currency,
    });
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/load-lists/[id] (soft delete)
async function DELETEHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const unauthorized = await requirePermission(RESOURCES.LOAD_LISTS, "delete");
    if (unauthorized) return unauthorized;
    const { id } = await params;
    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, userId, companyId } = context;

    // Check if load list exists
    const { data: existingLL, error: fetchError } = await supabase
      .from("load_lists")
      .select("id, status")
      .eq("id", id)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .single();

    if (fetchError || !existingLL) {
      return NextResponse.json({ error: "Load list not found" }, { status: 404 });
    }

    // Only allow deleting draft and confirmed load lists
    if (!["draft", "confirmed"].includes(existingLL.status)) {
      return NextResponse.json(
        { error: "Only draft or confirmed load lists can be deleted" },
        { status: 400 }
      );
    }

    // Soft delete
    const { error: deleteError } = await supabase
      .from("load_lists")
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting load list:", deleteError);
      return NextResponse.json({ error: "Failed to delete load list" }, { status: 500 });
    }

    return NextResponse.json({ message: "Load list deleted successfully" });
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "view",
  resourceType: "load_lists",
  route: "/api/load-lists/[id]",
});
export const PUT = withActivityLogging(PUTHandler, {
  action: "update",
  resourceType: "load_lists",
  route: "/api/load-lists/[id]",
});
export const DELETE = withActivityLogging(DELETEHandler, {
  action: "delete",
  resourceType: "load_lists",
  route: "/api/load-lists/[id]",
});
