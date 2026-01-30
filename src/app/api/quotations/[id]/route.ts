import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import type { Quotation, QuotationLineItem, UpdateQuotationRequest } from "@/types/quotation";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { normalizeTransactionItems } from "@/services/inventory/normalizationService";
import type { StockTransactionItemInput } from "@/types/inventory-normalization";

type DbQuotation = {
  id: string;
  company_id: string;
  quotation_code: string;
  customer_id: string;
  quotation_date: string;
  valid_until: string | null;
  status: string;
  sales_order_id: string | null;
  subtotal: number | string | null;
  discount_amount: number | string | null;
  tax_amount: number | string | null;
  total_amount: number | string | null;
  terms_conditions: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
type DbQuotationItem = {
  id: string;
  quotation_id: string;
  item_id: string;
  item_description: string | null;
  quantity: number | string;
  packaging_id: string | null;
  uom_id: string | null;
  rate: number | string;
  discount_percent: number | string | null;
  discount_amount: number | string | null;
  tax_percent: number | string | null;
  tax_amount: number | string | null;
  line_total: number | string;
  sort_order: number | null;
};
type DbCustomer = { id: string; customer_name: string | null; email: string | null };
type DbItem = { id: string; item_code: string | null; item_name: string | null };
type DbUser = { id: string; first_name: string | null; last_name: string | null };
type DbUoM = { id: string; code: string | null; name: string | null };
type DbPackaging = { id: string; pack_name: string | null; qty_per_pack: number | string | null };

type DbQuotationWithJoins = DbQuotation & {
  customers?: DbCustomer | DbCustomer[] | null;
  users?: DbUser | DbUser[] | null;
};

type DbQuotationItemWithJoins = DbQuotationItem & {
  items?: DbItem | DbItem[] | null;
  units_of_measure?: DbUoM | DbUoM[] | null;
  item_packaging?: DbPackaging | DbPackaging[] | null;
};

type QuotationItemInput = NonNullable<UpdateQuotationRequest["items"]>[number];

type QuotationHeaderUpdate = Partial<DbQuotation> & {
  updated_by: string;
};

// Transform database quotation to frontend type
function transformDbQuotation(
  dbQuotation: DbQuotationWithJoins,
  items?: QuotationLineItem[]
): Quotation {
  const customer = Array.isArray(dbQuotation.customers)
    ? dbQuotation.customers[0]
    : dbQuotation.customers;
  const user = Array.isArray(dbQuotation.users) ? dbQuotation.users[0] : dbQuotation.users;
  return {
    id: dbQuotation.id,
    companyId: dbQuotation.company_id,
    quotationNumber: dbQuotation.quotation_code,
    customerId: dbQuotation.customer_id,
    customerName: customer?.customer_name || undefined,
    customerEmail: customer?.email || undefined,
    quotationDate: dbQuotation.quotation_date,
    validUntil: dbQuotation.valid_until || "",
    status: dbQuotation.status as Quotation["status"],
    salesOrderId: dbQuotation.sales_order_id || undefined,
    lineItems: items || [],
    subtotal: Number(dbQuotation.subtotal) || 0,
    totalDiscount: Number(dbQuotation.discount_amount) || 0,
    totalTax: Number(dbQuotation.tax_amount) || 0,
    totalAmount: Number(dbQuotation.total_amount) || 0,
    terms: dbQuotation.terms_conditions || "",
    notes: dbQuotation.notes || "",
    createdBy: dbQuotation.created_by || "",
    createdByName: user
      ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
      : undefined,
    createdAt: dbQuotation.created_at,
    updatedAt: dbQuotation.updated_at,
  };
}

// Transform database quotation item to frontend type
function transformDbQuotationItem(dbItem: DbQuotationItemWithJoins): QuotationLineItem {
  const item = Array.isArray(dbItem.items) ? dbItem.items[0] : dbItem.items;
  const packaging = Array.isArray(dbItem.item_packaging)
    ? dbItem.item_packaging[0]
    : dbItem.item_packaging;
  return {
    id: dbItem.id,
    itemId: dbItem.item_id,
    itemCode: item?.item_code || undefined,
    itemName: item?.item_name || undefined,
    description: dbItem.item_description || "",
    quantity: Number(dbItem.quantity),
    packagingId: dbItem.packaging_id,
    packagingName: packaging?.pack_name || undefined,
    uomId: dbItem.uom_id || "",
    unitPrice: Number(dbItem.rate),
    discount: Number(dbItem.discount_percent) || 0,
    discountAmount: Number(dbItem.discount_amount) || 0,
    taxRate: Number(dbItem.tax_percent) || 0,
    taxAmount: Number(dbItem.tax_amount) || 0,
    lineTotal: Number(dbItem.line_total),
    sortOrder: dbItem.sort_order || 0,
  };
}

// GET /api/quotations/[id] - Get single quotation
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(RESOURCES.SALES_QUOTATIONS, "view");

    const { id } = await params;
    const { supabase } = await createServerClientWithBU();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch quotation with joins
    const { data: quotation, error } = await supabase
      .from("sales_quotations")
      .select(
        `
        *,
        customers:customer_id (
          id,
          customer_name,
          email
        ),
        users:created_by (
          id,
          first_name,
          last_name
        )
      `
      )
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!quotation) {
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    }

    // Fetch quotation items
    const { data: items, error: itemsError } = await supabase
      .from("sales_quotation_items")
      .select(
        `
        *,
        items (
          id,
          item_code,
          item_name
        ),
        item_packaging:packaging_id (
          id,
          pack_name,
          qty_per_pack
        ),
        units_of_measure (
          id,
          code,
          name
        )
      `
      )
      .eq("quotation_id", id)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true });

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    const transformedItems =
      (items as DbQuotationItemWithJoins[] | null)?.map((item) => transformDbQuotationItem(item)) ||
      [];
    const result = transformDbQuotation(quotation as DbQuotationWithJoins, transformedItems);

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/quotations/[id] - Update quotation
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(RESOURCES.SALES_QUOTATIONS, "edit");

    const { id } = await params;
    const { supabase } = await createServerClientWithBU();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's company_id from users table
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body: UpdateQuotationRequest = await request.json();

    // Fetch existing quotation to check status
    const { data: existingQuotation, error: fetchError } = await supabase
      .from("sales_quotations")
      .select("status, company_id")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (fetchError || !existingQuotation) {
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    }

    // Business rule: Only drafts can be edited
    if (existingQuotation.status !== "draft") {
      return NextResponse.json({ error: "Only draft quotations can be edited" }, { status: 400 });
    }

    // Build update object for header
    const headerUpdate: QuotationHeaderUpdate = {
      updated_by: user.id,
    };

    if (body.quotationDate) headerUpdate.quotation_date = body.quotationDate;
    if (body.validUntil !== undefined) headerUpdate.valid_until = body.validUntil;
    if (body.status) headerUpdate.status = body.status;
    if (body.notes !== undefined) headerUpdate.notes = body.notes;
    if (body.termsConditions !== undefined) headerUpdate.terms_conditions = body.termsConditions;

    // If items are being updated, recalculate totals
    if (body.items && body.items.length > 0) {
      let subtotal = 0;
      let totalDiscount = 0;
      let totalTax = 0;

      const itemInputs: StockTransactionItemInput[] = body.items.map(
        (item: QuotationItemInput) => ({
          itemId: item.itemId,
          packagingId: item.packagingId ?? null,
          inputQty: Number(item.quantity),
          unitCost: Number(item.rate),
        })
      );

      const normalizedItems = await normalizeTransactionItems(
        existingQuotation.company_id,
        itemInputs
      );

      const itemsWithCalculations = body.items.map((item, index) => {
        const normalizedQty = normalizedItems[index]?.normalizedQty ?? item.quantity;
        const itemSubtotal = normalizedQty * item.rate;
        const discountAmount =
          item.discountAmount || (itemSubtotal * (item.discountPercent || 0)) / 100;
        const taxableAmount = itemSubtotal - discountAmount;
        const taxAmount = item.taxAmount || (taxableAmount * (item.taxPercent || 0)) / 100;
        const lineTotal = taxableAmount + taxAmount;

        subtotal += itemSubtotal;
        totalDiscount += discountAmount;
        totalTax += taxAmount;

        return {
          ...item,
          discountAmount,
          taxAmount,
          lineTotal,
        };
      });

      const totalAmount = subtotal - totalDiscount + totalTax;

      headerUpdate.subtotal = subtotal.toFixed(4);
      headerUpdate.discount_amount = totalDiscount.toFixed(4);
      headerUpdate.tax_amount = totalTax.toFixed(4);
      headerUpdate.total_amount = totalAmount.toFixed(4);

      // Update header
      const { error: updateError } = await supabase
        .from("sales_quotations")
        .update(headerUpdate)
        .eq("id", id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      // Delete existing items (soft delete)
      const { error: deleteError } = await supabase
        .from("sales_quotation_items")
        .update({ deleted_at: new Date().toISOString() })
        .eq("quotation_id", id);

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }

      // Insert new items
      const itemsToInsert = itemsWithCalculations.map((item, index) => ({
        company_id: userData.company_id,
        quotation_id: id,
        item_id: item.itemId,
        item_description: item.description,
        quantity: item.quantity,
        uom_id: item.uomId,
        packaging_id: item.packagingId ?? null,
        rate: item.rate,
        discount_percent: item.discountPercent || 0,
        discount_amount: item.discountAmount,
        tax_percent: item.taxPercent || 0,
        tax_amount: item.taxAmount,
        line_total: item.lineTotal,
        sort_order: item.sortOrder || index,
        notes: item.notes,
        created_by: user.id,
        updated_by: user.id,
      }));

      const { error: insertError } = await supabase
        .from("sales_quotation_items")
        .insert(itemsToInsert);

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    } else {
      // Update header only (no items changed)
      const { error: updateError } = await supabase
        .from("sales_quotations")
        .update(headerUpdate)
        .eq("id", id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    // Fetch the updated quotation with joins
    const { data: updatedQuotation } = await supabase
      .from("sales_quotations")
      .select(
        `
        *,
        customers:customer_id (
          id,
          customer_name,
          email
        ),
        users:created_by (
          id,
          first_name,
          last_name
        )
      `
      )
      .eq("id", id)
      .single();

    const { data: quotationItems } = await supabase
      .from("sales_quotation_items")
      .select(
        `
        *,
        items (
          id,
          item_code,
          item_name
        ),
        item_packaging:packaging_id (
          id,
          pack_name,
          qty_per_pack
        ),
        units_of_measure (
          id,
          code,
          name
        )
      `
      )
      .eq("quotation_id", id)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true });

    const items =
      (quotationItems as DbQuotationItemWithJoins[] | null)?.map((item) =>
        transformDbQuotationItem(item)
      ) || [];
    const result = transformDbQuotation(updatedQuotation as DbQuotationWithJoins, items);

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/quotations/[id] - Soft delete quotation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(RESOURCES.SALES_QUOTATIONS, "delete");

    const { id } = await params;
    const { supabase } = await createServerClientWithBU();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch existing quotation to check status
    const { data: existingQuotation, error: fetchError } = await supabase
      .from("sales_quotations")
      .select("status")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (fetchError || !existingQuotation) {
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    }

    // Business rule: Only drafts can be deleted
    if (existingQuotation.status !== "draft") {
      return NextResponse.json({ error: "Only draft quotations can be deleted" }, { status: 400 });
    }

    // Soft delete the quotation
    const { error: deleteError } = await supabase
      .from("sales_quotations")
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq("id", id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Soft delete associated items
    const { error: itemsDeleteError } = await supabase
      .from("sales_quotation_items")
      .update({ deleted_at: new Date().toISOString() })
      .eq("quotation_id", id);

    if (itemsDeleteError) {
      return NextResponse.json({ error: itemsDeleteError.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Quotation deleted successfully" });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
