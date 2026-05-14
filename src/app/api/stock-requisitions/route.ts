import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";
import {
  resolveStockRequisitionLineUnitOptions,
  StockRequisitionLineValidationError,
} from "./line-item-unit-options";
import { transformItemUnitOptionRow, type DbItemUnitOptionRow } from "@/lib/items/itemUnitOptions";
import { resolveStockRequisitionCapabilities } from "@/lib/stock-requisitions/permissions";
import {
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

// GET /api/stock-requisitions
export async function GET(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUISITIONS, "view");
    if (unauthorized) return unauthorized;
    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, userId, companyId, currentBusinessUnitId } = context;
    const { searchParams } = new URL(request.url);

    if (!currentBusinessUnitId) {
      return NextResponse.json({ error: "Business unit context required" }, { status: 400 });
    }

    const capabilities = await resolveStockRequisitionCapabilities(userId, currentBusinessUnitId);
    const documentSettings = await resolveStockRequisitionDocumentSettings(
      supabase,
      companyId,
      currentBusinessUnitId
    );

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
      .eq("business_unit_id", currentBusinessUnitId)
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
      return NextResponse.json({ error: "Failed to fetch stock requisitions" }, { status: 500 });
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
      const formattedItems =
        (sr.items as StockRequisitionListItemRow[] | null)?.map((item) => {
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
              ? transformItemUnitOptionRow(
                  itemUnitOptionDetails as DbItemUnitOptionRow,
                  baseUomCode
                )
              : null,
            item: item.item
              ? {
                  id: item.item.id,
                  code: item.item.item_code,
                  name: item.item.item_name,
                }
              : null,
            requestedQty,
            unitPrice: capabilities.canViewUnitCost ? unitPrice : null,
            totalPrice: capabilities.canViewTotalAmount ? totalPrice : null,
            documentUnitPrice: documentSettings.showUnitPrice ? unitPrice : null,
            documentTotalPrice:
              documentSettings.showLineTotal || documentSettings.showTotalAmount
                ? totalPrice
                : null,
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
        currency:
          capabilities.canViewTotalAmount || capabilities.canViewUnitCost
            ? (normalizeCurrency(sr.currency) ?? "PHP")
            : null,
        totalAmount: capabilities.canViewTotalAmount
          ? formattedItems.reduce((sum, item) => sum + (item.totalPrice ?? 0), 0)
          : null,
        documentCurrency:
          documentSettings.showUnitPrice ||
          documentSettings.showLineTotal ||
          documentSettings.showTotalAmount
            ? (normalizeCurrency(sr.currency) ?? "PHP")
            : null,
        documentTotalAmount: documentSettings.showTotalAmount
          ? formattedItems.reduce((sum, item) => sum + (item.documentTotalPrice ?? 0), 0)
          : null,
        items: formattedItems,
        capabilities,
        documentSettings,
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
      capabilities,
      documentSettings,
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

    const capabilities = await resolveStockRequisitionCapabilities(userId, currentBusinessUnitId);

    // Validate required fields
    if (!body.supplierId) {
      return NextResponse.json({ error: "Supplier is required" }, { status: 400 });
    }

    if (!body.items || body.items.length === 0) {
      return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
    }

    if (
      !capabilities.canViewUnitCost &&
      (body.currency != null ||
        body.items.some((item: { unitPrice?: unknown }) => item.unitPrice !== undefined))
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

    let resolvedCostLines: ResolvedCostLineItem[];
    let currency: string;
    try {
      const resolvedLineItems = await resolveStockRequisitionLineUnitOptions(
        supabase,
        companyId,
        body.items
      );
      const resolvedCosts = await resolveStockRequisitionLineCosts(
        supabase,
        companyId,
        resolvedLineItems,
        {
          canUseSubmittedCost: capabilities.canViewUnitCost,
          submittedCurrency,
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

    const resolvedCurrencyValidationError = validateCurrency(currency);
    if (resolvedCurrencyValidationError) {
      return NextResponse.json({ error: resolvedCurrencyValidationError }, { status: 400 });
    }

    // Calculate total amount
    const totalAmount = resolvedCostLines.reduce(
      (sum: number, item) => sum + item.requestedQty * item.qty_per_unit * item.unitPrice,
      0
    );

    // Create stock requisition
    const { data: sr, error: srError } = await supabase
      .from("stock_requisitions")
      .insert({
        company_id: companyId,
        business_unit_id: currentBusinessUnitId,
        supplier_id: body.supplierId,
        requisition_date: body.requisitionDate || new Date().toISOString().split("T")[0],
        required_by_date: body.requiredByDate || null,
        requested_by: userId,
        status: body.status || "draft",
        notes: body.notes,
        total_amount: totalAmount,
        currency,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (srError) {
      console.error("Error creating stock requisition:", srError);
      return NextResponse.json({ error: "Failed to create stock requisition" }, { status: 500 });
    }

    // Create line items
    const itemsToInsert = resolvedCostLines.map((item) => ({
      sr_id: sr.id,
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
