import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";
import {
  resolveStockRequisitionLineUnitOptions,
  StockRequisitionLineValidationError,
} from "../line-item-unit-options";
import { transformItemUnitOptionRow, type DbItemUnitOptionRow } from "@/lib/items/itemUnitOptions";
import { resolveStockRequisitionCapabilities } from "@/lib/stock-requisitions/permissions";
import {
  buildLineCostKey,
  resolveStockRequisitionLineCosts,
  type ResolvedCostLineItem,
} from "@/lib/stock-requisitions/costs";
import { resolveStockRequisitionDocumentSettings } from "@/lib/stock-requisitions/document-settings";

const normalizeCurrency = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
};

const resolveRequestCurrency = (value: unknown) => normalizeCurrency(value) ?? "PHP";

const validateCurrency = (currency: string) =>
  /^[A-Z]{3}$/.test(currency) ? null : "Currency must be a 3-letter currency code";

// GET /api/stock-requisitions/[id]
async function GETHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUISITIONS, "view");
    if (unauthorized) return unauthorized;
    const { id } = await params;
    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, userId, companyId, currentBusinessUnitId } = context;

    if (!currentBusinessUnitId) {
      return NextResponse.json({ error: "Business unit context required" }, { status: 400 });
    }

    const capabilities = await resolveStockRequisitionCapabilities(userId, currentBusinessUnitId);
    const documentSettings = await resolveStockRequisitionDocumentSettings(
      supabase,
      companyId,
      currentBusinessUnitId
    );

    // Fetch stock requisition with related data
    const { data: sr, error } = await supabase
      .from("stock_requisitions")
      .select(
        `
        *,
        supplier:suppliers(id, supplier_name, supplier_code, contact_person, email, phone, lang),
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
          item:items(id, item_code, item_name, item_name_cn),
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
      .eq("business_unit_id", currentBusinessUnitId)
      .is("deleted_at", null)
      .single();

    if (error) {
      console.error("Error fetching stock requisition:", error);
      return NextResponse.json({ error: "Stock requisition not found" }, { status: 404 });
    }

    // Format response
    type StockRequisitionItemRow = {
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
        | null;
      item?: {
        id: string;
        item_code: string;
        item_name: string;
        item_name_cn?: string | null;
      } | null;
      requested_qty: number | string;
      unit_price: number | string;
      total_price: number | string;
      fulfilled_qty: number | string;
      outstanding_qty: number | string;
      notes: string | null;
    };

    const canShowDocumentUnitPrice =
      documentSettings.showUnitPrice && capabilities.canViewUnitCost;
    const canShowDocumentLineTotal =
      documentSettings.showLineTotal && capabilities.canViewTotalAmount;
    const canShowDocumentTotalAmount =
      documentSettings.showTotalAmount && capabilities.canViewTotalAmount;

    const formattedItems =
      (sr.items as StockRequisitionItemRow[] | null)?.map((item) => {
        const itemUnitOptionDetails = Array.isArray(item.item_unit_options)
          ? (item.item_unit_options[0] ?? null)
          : (item.item_unit_options ?? null);
        const baseUomCode = item.units_of_measure?.code || "";
        const qtyPerUnit = Number(itemUnitOptionDetails?.qty_per_unit ?? 1) || 1;
        const requestedQty = Number(item.requested_qty ?? 0);
        const unitPrice = Number(item.unit_price ?? 0);
        const totalPrice = requestedQty * qtyPerUnit * unitPrice;

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
                chineseName: item.item.item_name_cn || undefined,
              }
            : null,
          requestedQty,
          unitPrice: capabilities.canViewUnitCost ? unitPrice : null,
          totalPrice: capabilities.canViewTotalAmount ? totalPrice : null,
          documentUnitPrice: canShowDocumentUnitPrice ? unitPrice : null,
          documentTotalPrice:
            canShowDocumentLineTotal || canShowDocumentTotalAmount ? totalPrice : null,
          fulfilledQty: Number(item.fulfilled_qty ?? 0),
          outstandingQty: Number(item.outstanding_qty ?? 0),
          notes: item.notes,
        };
      }) || [];

    const formattedSR = {
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
            lang: ((sr.supplier as { lang?: string | null }).lang ?? "english") as
              | "english"
              | "chinese",
            contactPerson: sr.supplier.contact_person,
            email: sr.supplier.email,
            phone: sr.supplier.phone,
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
      currency:
        capabilities.canViewTotalAmount || capabilities.canViewUnitCost
          ? (normalizeCurrency(sr.currency) ?? "PHP")
          : null,
      totalAmount: capabilities.canViewTotalAmount
        ? formattedItems.reduce((sum, item) => sum + (item.totalPrice ?? 0), 0)
        : null,
      documentCurrency:
        canShowDocumentUnitPrice || canShowDocumentLineTotal || canShowDocumentTotalAmount
          ? (normalizeCurrency(sr.currency) ?? "PHP")
          : null,
      documentTotalAmount: canShowDocumentTotalAmount
        ? formattedItems.reduce((sum, item) => sum + (item.documentTotalPrice ?? 0), 0)
        : null,
      items: formattedItems,
      capabilities,
      documentSettings,
      createdAt: sr.created_at,
      createdBy: sr.created_by,
      createdByUser: sr.created_by_user
        ? {
            id: sr.created_by_user.id,
            email: sr.created_by_user.email,
            firstName: sr.created_by_user.first_name,
            lastName: sr.created_by_user.last_name,
          }
        : null,
      updatedAt: sr.updated_at,
      updatedBy: sr.updated_by,
    };

    return NextResponse.json(formattedSR);
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/stock-requisitions/[id]
async function PUTHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUISITIONS, "edit");
    if (unauthorized) return unauthorized;
    const { id } = await params;
    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, userId, companyId, currentBusinessUnitId } = context;
    const body = await request.json();

    if (!currentBusinessUnitId) {
      return NextResponse.json({ error: "Business unit context required" }, { status: 400 });
    }

    const capabilities = await resolveStockRequisitionCapabilities(userId, currentBusinessUnitId);

    // Check if stock requisition exists and is in draft status
    const { data: existingSR, error: fetchError } = await supabase
      .from("stock_requisitions")
      .select("id, status, currency")
      .eq("id", id)
      .eq("company_id", companyId)
      .eq("business_unit_id", currentBusinessUnitId)
      .is("deleted_at", null)
      .single();

    if (fetchError || !existingSR) {
      return NextResponse.json({ error: "Stock requisition not found" }, { status: 404 });
    }

    // Only allow editing draft requisitions
    if (existingSR.status !== "draft") {
      return NextResponse.json({ error: "Only draft requisitions can be edited" }, { status: 400 });
    }

    if (body.items && body.items.length === 0) {
      return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
    }

    if (
      !capabilities.canViewUnitCost &&
      (body.currency != null ||
        body.items?.some((item: { unitPrice?: unknown }) => item.unitPrice !== undefined))
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const submittedCurrency = resolveRequestCurrency(body.currency);
    const currencyValidationError = capabilities.canViewUnitCost
      ? validateCurrency(submittedCurrency)
      : null;
    if (currencyValidationError) {
      return NextResponse.json({ error: currencyValidationError }, { status: 400 });
    }

    let resolvedCostLines: ResolvedCostLineItem[] | null = null;
    let currency = normalizeCurrency(existingSR.currency) ?? "PHP";
    if (body.items) {
      try {
        const resolvedLineItems = await resolveStockRequisitionLineUnitOptions(
          supabase,
          companyId,
          body.items
        );
        const preservedCosts = new Map<string, { unitPrice: number; currency: string }>();

        if (!capabilities.canViewUnitCost) {
          const { data: existingItems, error: existingItemsError } = await supabase
            .from("stock_requisition_items")
            .select("item_id, item_unit_option_id, unit_price")
            .eq("sr_id", id);

          if (existingItemsError) {
            console.error("Error fetching existing stock requisition items:", existingItemsError);
            return NextResponse.json(
              { error: "Failed to update stock requisition" },
              { status: 500 }
            );
          }

          for (const item of existingItems || []) {
            if (!item.item_unit_option_id) continue;
            preservedCosts.set(
              buildLineCostKey({
                itemId: item.item_id,
                item_unit_option_id: item.item_unit_option_id,
              }),
              {
                unitPrice: Number(item.unit_price ?? 0),
                currency,
              }
            );
          }
        }

        const resolvedCosts = await resolveStockRequisitionLineCosts(
          supabase,
          companyId,
          resolvedLineItems,
          {
            canUseSubmittedCost: capabilities.canViewUnitCost,
            submittedCurrency,
            preservedCosts,
          }
        );
        resolvedCostLines = resolvedCosts.items;
        currency = resolvedCosts.currency;
      } catch (error) {
        if (error instanceof StockRequisitionLineValidationError) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        throw error;
      }
    }

    const resolvedCurrencyValidationError = validateCurrency(currency);
    if (resolvedCurrencyValidationError) {
      return NextResponse.json({ error: resolvedCurrencyValidationError }, { status: 400 });
    }

    const totalAmount = resolvedCostLines?.reduce(
      (sum, item) => sum + item.requestedQty * item.qty_per_unit * item.unitPrice,
      0
    );

    // Update stock requisition
    const { data: sr, error: updateError } = await supabase
      .from("stock_requisitions")
      .update({
        supplier_id: body.supplierId,
        requisition_date: body.requisitionDate,
        required_by_date: body.requiredByDate || null,
        notes: body.notes,
        ...(resolvedCostLines
          ? {
              total_amount: totalAmount,
              currency,
            }
          : {}),
        updated_by: userId,
      })
      .eq("id", id)
      .eq("company_id", companyId)
      .eq("business_unit_id", currentBusinessUnitId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating stock requisition:", updateError);
      return NextResponse.json({ error: "Failed to update stock requisition" }, { status: 500 });
    }

    // Update line items if provided
    if (resolvedCostLines && resolvedCostLines.length > 0) {
      // Delete existing items
      await supabase.from("stock_requisition_items").delete().eq("sr_id", id);

      // Insert new items
      const itemsToInsert = resolvedCostLines.map((item) => ({
        sr_id: id,
        item_id: item.itemId,
        item_unit_option_id: item.item_unit_option_id,
        uom_id: item.uom_id,
        requested_qty: item.requestedQty,
        unit_price: item.unitPrice,
        fulfilled_qty: 0,
        notes: item.notes,
      }));

      const { error: itemsError } = await supabase
        .from("stock_requisition_items")
        .insert(itemsToInsert);

      if (itemsError) {
        console.error("Error updating stock requisition items:", itemsError);
        return NextResponse.json(
          { error: "Failed to update stock requisition items" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      id: sr.id,
      srNumber: sr.sr_number,
      status: sr.status,
    });
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/stock-requisitions/[id] (soft delete)
async function DELETEHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUISITIONS, "delete");
    if (unauthorized) return unauthorized;
    const { id } = await params;
    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, userId, companyId, currentBusinessUnitId } = context;

    if (!currentBusinessUnitId) {
      return NextResponse.json({ error: "Business unit context required" }, { status: 400 });
    }

    // Check if stock requisition exists
    const { data: existingSR, error: fetchError } = await supabase
      .from("stock_requisitions")
      .select("id, status")
      .eq("id", id)
      .eq("company_id", companyId)
      .eq("business_unit_id", currentBusinessUnitId)
      .is("deleted_at", null)
      .single();

    if (fetchError || !existingSR) {
      return NextResponse.json({ error: "Stock requisition not found" }, { status: 404 });
    }

    // Only allow deleting draft requisitions
    if (existingSR.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft requisitions can be deleted" },
        { status: 400 }
      );
    }

    // Soft delete
    const { error: deleteError } = await supabase
      .from("stock_requisitions")
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("id", id)
      .eq("company_id", companyId)
      .eq("business_unit_id", currentBusinessUnitId);

    if (deleteError) {
      console.error("Error deleting stock requisition:", deleteError);
      return NextResponse.json({ error: "Failed to delete stock requisition" }, { status: 500 });
    }

    return NextResponse.json({ message: "Stock requisition deleted successfully" });
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "view",
  resourceType: "stock_requisitions",
  route: "/api/stock-requisitions/[id]",
});
export const PUT = withActivityLogging(PUTHandler, {
  action: "update",
  resourceType: "stock_requisitions",
  route: "/api/stock-requisitions/[id]",
});
export const DELETE = withActivityLogging(DELETEHandler, {
  action: "delete",
  resourceType: "stock_requisitions",
  route: "/api/stock-requisitions/[id]",
});
