import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import type { UpdateInvoiceRequest, CreateInvoiceRequest } from "@/types/invoice";
import { syncSalesOrderInvoiceStatus } from "@/app/api/invoices/_shared";
import {
  loadSalesOrderFrameDetails,
  transformSalesOrderFrameDetails,
} from "@/app/api/sales-orders/frame-details";

const INVOICE_DETAIL_SELECT = `
  id,
  company_id,
  business_unit_id,
  invoice_code,
  customer_id,
  warehouse_id,
  custom_fields,
  sales_order_id,
  invoice_date,
  due_date,
  status,
  subtotal,
  discount_amount,
  tax_amount,
  total_amount,
  amount_paid,
  amount_due,
  billing_address_line1,
  billing_city,
  billing_state,
  billing_postal_code,
  billing_country,
  payment_terms,
  notes,
  primary_employee_id,
  commission_total,
  commission_split_count,
  created_by,
  created_at,
  updated_at,
  customers:customer_id (
    id,
    customer_name,
    email
  ),
  sales_orders:sales_order_id (
    id,
    order_code
  ),
  primary_employee:primary_employee_id (
    id,
    first_name,
    last_name
  )
` as const;

const INVOICE_ITEM_DETAIL_SELECT = `
  id,
  invoice_id,
  item_id,
  item_description,
  quantity,
  uom_id,
  pricing_tier,
  pricing_tier_name,
  rate,
  discount_percent,
  tax_percent,
  line_total,
  sort_order,
  items:item_id (
    item_code,
    item_name
  ),
  units_of_measure:uom_id (
    code,
    name
  )
` as const;

const INVOICE_UPDATE_SOURCE_SELECT = `
  company_id,
  status,
  subtotal,
  discount_amount,
  tax_amount,
  total_amount,
  custom_fields,
  customer_id,
  warehouse_id,
  invoice_date,
  due_date,
  amount_paid,
  billing_address_line1,
  billing_city,
  billing_state,
  billing_postal_code,
  billing_country,
  payment_terms,
  notes
` as const;

const MAX_DOCUMENT_LINES = 200;

const firstJoined = <T>(value: T | T[] | null | undefined): T | null =>
  (Array.isArray(value) ? value[0] : value) || null;

const sameMoney = (left: number | null, right: number | null): boolean =>
  Math.abs(Number(left || 0) - Number(right || 0)) < 0.005;

// GET /api/invoices/[id]
async function GETHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const unauthorized = await requirePermission(RESOURCES.SALES_INVOICES, "view");
    if (unauthorized) return unauthorized;

    const { id } = await params;
    const { supabase, currentBusinessUnitId } = await createServerClientWithBU();

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

    // Fetch invoice
    const { data: invoice, error } = await supabase
      .from("sales_invoices")
      .select(INVOICE_DETAIL_SELECT)
      .eq("id", id)
      .eq("business_unit_id", currentBusinessUnitId)
      .is("deleted_at", null)
      .single();

    if (error || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const locationId = invoice.custom_fields?.locationId;
    const [location, warehouse] = await Promise.all([
      locationId
        ? supabase.from("warehouse_locations").select("code, name").eq("id", locationId).single()
        : Promise.resolve(null),
      invoice.warehouse_id
        ? supabase
            .from("warehouses")
            .select("warehouse_name")
            .eq("id", invoice.warehouse_id)
            .single()
        : Promise.resolve(null),
    ]);

    // Fetch line items
    const { data: items, error: itemsError } = await supabase
      .from("sales_invoice_items")
      .select(INVOICE_ITEM_DETAIL_SELECT)
      .eq("invoice_id", id)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true })
      .limit(MAX_DOCUMENT_LINES + 1);

    if (itemsError) {
      console.error("Failed to load invoice items", {
        invoiceId: id,
        code: itemsError.code,
        message: itemsError.message,
      });
      return NextResponse.json({ error: "Failed to load invoice items" }, { status: 500 });
    }
    if ((items?.length || 0) > MAX_DOCUMENT_LINES) {
      return NextResponse.json(
        { error: "Invoice has too many line items to display" },
        { status: 422 }
      );
    }

    const sourceLineByInvoiceKey = new Map<string, string>();
    if (invoice.sales_order_id && items && items.length > 0) {
      const invoiceItemByKey = new Map(
        items.map((item) => [`${item.item_id}:${item.sort_order}`, item])
      );
      const { data: sourceLines, error: sourceLinesError } = await supabase
        .from("sales_order_items")
        .select(
          "id, item_id, sort_order, quantity, uom_id, rate, discount_percent, tax_percent, line_total"
        )
        .eq("order_id", invoice.sales_order_id)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true })
        .limit(MAX_DOCUMENT_LINES + 1);

      if (sourceLinesError) {
        console.error("Failed to resolve invoice source lines", {
          invoiceId: id,
          salesOrderId: invoice.sales_order_id,
          code: sourceLinesError.code,
          message: sourceLinesError.message,
        });
        return NextResponse.json({ error: "Failed to load invoice line details" }, { status: 500 });
      }
      if ((sourceLines?.length || 0) > MAX_DOCUMENT_LINES) {
        return NextResponse.json(
          { error: "Sales order has too many line items to display" },
          { status: 422 }
        );
      }

      for (const sourceLine of sourceLines || []) {
        const key = `${sourceLine.item_id}:${sourceLine.sort_order}`;
        const invoiceItem = invoiceItemByKey.get(key);
        if (
          invoiceItem &&
          invoiceItem.uom_id === sourceLine.uom_id &&
          sameMoney(invoiceItem.quantity, sourceLine.quantity) &&
          sameMoney(invoiceItem.rate, sourceLine.rate) &&
          sameMoney(invoiceItem.discount_percent, sourceLine.discount_percent) &&
          sameMoney(invoiceItem.tax_percent, sourceLine.tax_percent) &&
          sameMoney(invoiceItem.line_total, sourceLine.line_total)
        ) {
          sourceLineByInvoiceKey.set(key, sourceLine.id);
        }
      }
    }

    const sourceLineIds = Array.from(new Set(sourceLineByInvoiceKey.values()));
    const frameDetails = await loadSalesOrderFrameDetails(supabase, sourceLineIds);
    if (frameDetails.error) {
      console.error("Failed to load invoice frame details", {
        invoiceId: id,
        salesOrderId: invoice.sales_order_id,
        error: frameDetails.error,
      });
      return NextResponse.json({ error: "Failed to load invoice line details" }, { status: 500 });
    }

    const customer = firstJoined(invoice.customers);
    const salesOrder = firstJoined(invoice.sales_orders);
    const primaryEmployee = firstJoined(invoice.primary_employee);

    // Format response
    const formattedInvoice = {
      id: invoice.id,
      companyId: invoice.company_id,
      invoiceNumber: invoice.invoice_code,
      customerId: invoice.customer_id,
      customerName: customer?.customer_name || "",
      customerEmail: customer?.email || "",
      warehouseId: invoice.warehouse_id || null,
      warehouseName: warehouse?.data?.warehouse_name || "",
      locationId: invoice.custom_fields?.locationId || null,
      locationCode: location?.data?.code || null,
      locationName: location?.data?.name || null,
      salesOrderId: invoice.sales_order_id,
      salesOrderNumber: salesOrder?.order_code,
      invoiceDate: invoice.invoice_date,
      dueDate: invoice.due_date,
      status: invoice.status,
      lineItems:
        items?.map((item) => {
          const catalogItem = firstJoined(item.items);
          const unit = firstJoined(item.units_of_measure);
          const sourceLineId = sourceLineByInvoiceKey.get(`${item.item_id}:${item.sort_order}`);
          const sourceFrameDetails = sourceLineId
            ? transformSalesOrderFrameDetails(
                frameDetails.configurationsByItemId.get(sourceLineId) || [],
                frameDetails.componentsByItemId.get(sourceLineId) || [],
                frameDetails.matLayersByConfigurationId
              )
            : undefined;

          return {
            id: item.id,
            itemId: item.item_id,
            itemCode: catalogItem?.item_code || "",
            itemName: catalogItem?.item_name || "",
            description: item.item_description || "",
            quantity: Number(item.quantity),
            uomId: item.uom_id || "",
            uomCode: unit?.code || "",
            pricingTier: item.pricing_tier || undefined,
            pricingTierName: item.pricing_tier_name || undefined,
            unitPrice: Number(item.rate),
            discount: Number(item.discount_percent),
            taxRate: Number(item.tax_percent),
            lineTotal: Number(item.line_total),
            ...sourceFrameDetails,
          };
        }) || [],
      subtotal: parseFloat(invoice.subtotal),
      totalDiscount: parseFloat(invoice.discount_amount),
      totalTax: parseFloat(invoice.tax_amount),
      totalAmount: parseFloat(invoice.total_amount),
      amountPaid: parseFloat(invoice.amount_paid),
      amountDue: parseFloat(invoice.amount_due),
      billingAddress: invoice.billing_address_line1 || "",
      billingCity: invoice.billing_city || "",
      billingState: invoice.billing_state || "",
      billingPostalCode: invoice.billing_postal_code || "",
      billingCountry: invoice.billing_country || "",
      paymentTerms: invoice.payment_terms || "",
      notes: invoice.notes || "",
      primaryEmployeeId: invoice.primary_employee_id,
      primaryEmployeeName: primaryEmployee
        ? `${primaryEmployee.first_name} ${primaryEmployee.last_name}`
        : "",
      commissionTotal: parseFloat(invoice.commission_total),
      commissionSplitCount: invoice.commission_split_count,
      createdBy: invoice.created_by,
      createdAt: invoice.created_at,
      updatedAt: invoice.updated_at,
    };

    return NextResponse.json(formattedInvoice);
  } catch (error) {
    console.error("Failed to load invoice details", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/invoices/[id]
async function PUTHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const unauthorized = await requirePermission(RESOURCES.SALES_INVOICES, "edit");
    if (unauthorized) return unauthorized;

    const { id } = await params;
    const body = (await request.json()) as UpdateInvoiceRequest;
    const { supabase, currentBusinessUnitId } = await createServerClientWithBU();

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

    // Fetch existing invoice
    const { data: existingInvoice, error: fetchError } = await supabase
      .from("sales_invoices")
      .select(INVOICE_UPDATE_SOURCE_SELECT)
      .eq("id", id)
      .eq("business_unit_id", currentBusinessUnitId)
      .is("deleted_at", null)
      .single();

    if (fetchError || !existingInvoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Only draft invoices can be edited
    if (existingInvoice.status !== "draft") {
      return NextResponse.json({ error: "Only draft invoices can be edited" }, { status: 400 });
    }

    // Calculate totals if line items provided
    let subtotal = existingInvoice.subtotal;
    let totalDiscount = existingInvoice.discount_amount;
    let totalTax = existingInvoice.tax_amount;
    let totalAmount = existingInvoice.total_amount;

    if (body.lineItems) {
      subtotal = 0;
      totalDiscount = 0;
      totalTax = 0;

      const lineItems = (body.lineItems || []) as CreateInvoiceRequest["lineItems"];

      const processedItems = lineItems.map((item, index) => {
        const quantity = Number(item.quantity);
        const rate = Number(item.unitPrice);
        const discountPercent = Number(item.discount || 0);
        const taxPercent = Number(item.taxRate || 0);

        const itemTotal = quantity * rate;
        const discountAmount = (itemTotal * discountPercent) / 100;
        const taxableAmount = itemTotal - discountAmount;
        const taxAmount = (taxableAmount * taxPercent) / 100;
        const lineTotal = taxableAmount + taxAmount;

        subtotal += itemTotal;
        totalDiscount += discountAmount;
        totalTax += taxAmount;

        return {
          company_id: existingInvoice.company_id,
          invoice_id: id,
          item_id: item.itemId,
          item_description: item.description || "",
          quantity,
          uom_id: item.uomId,
          pricing_tier: item.pricingTier || null,
          pricing_tier_name: item.pricingTierName || null,
          rate,
          discount_percent: discountPercent,
          discount_amount: discountAmount,
          tax_percent: taxPercent,
          tax_amount: taxAmount,
          line_total: lineTotal,
          sort_order: index,
          created_by: user.id,
          updated_by: user.id,
        };
      });

      totalAmount = subtotal - totalDiscount + totalTax;

      // Delete existing items
      await supabase.from("sales_invoice_items").delete().eq("invoice_id", id);

      // Insert new items
      const { error: itemsError } = await supabase
        .from("sales_invoice_items")
        .insert(processedItems);

      if (itemsError) {
        return NextResponse.json({ error: "Failed to update invoice items" }, { status: 500 });
      }
    }

    // Update invoice
    const nextCustomFields =
      "locationId" in body
        ? {
            ...(existingInvoice.custom_fields || {}),
            locationId: body.locationId || null,
          }
        : existingInvoice.custom_fields;

    const { error: updateError } = await supabase
      .from("sales_invoices")
      .update({
        customer_id: body.customerId ?? existingInvoice.customer_id,
        warehouse_id: body.warehouseId ?? existingInvoice.warehouse_id,
        custom_fields: nextCustomFields,
        invoice_date: body.invoiceDate ?? existingInvoice.invoice_date,
        due_date: body.dueDate ?? existingInvoice.due_date,
        subtotal,
        discount_amount: totalDiscount,
        tax_amount: totalTax,
        total_amount: totalAmount,
        amount_due: totalAmount - existingInvoice.amount_paid,
        billing_address_line1: body.billingAddress ?? existingInvoice.billing_address_line1,
        billing_city: body.billingCity ?? existingInvoice.billing_city,
        billing_state: body.billingState ?? existingInvoice.billing_state,
        billing_postal_code: body.billingPostalCode ?? existingInvoice.billing_postal_code,
        billing_country: body.billingCountry ?? existingInvoice.billing_country,
        payment_terms: body.paymentTerms ?? existingInvoice.payment_terms,
        notes: body.notes ?? existingInvoice.notes,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: "Failed to update invoice" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/invoices/[id]
async function DELETEHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const unauthorized = await requirePermission(RESOURCES.SALES_INVOICES, "delete");
    if (unauthorized) return unauthorized;

    const { id } = await params;
    const { supabase, currentBusinessUnitId } = await createServerClientWithBU();

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

    // Fetch the invoice to check status and sales order relationship
    const { data: invoice, error: fetchError } = await supabase
      .from("sales_invoices")
      .select("id, status, sales_order_id")
      .eq("id", id)
      .eq("business_unit_id", currentBusinessUnitId)
      .is("deleted_at", null)
      .single();

    if (fetchError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Only allow deleting draft invoices
    if (invoice.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft invoices can be deleted. Sent or paid invoices cannot be deleted." },
        { status: 400 }
      );
    }

    // Soft delete invoice items
    const { error: itemsDeleteError } = await supabase
      .from("sales_invoice_items")
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq("invoice_id", id);

    if (itemsDeleteError) {
      return NextResponse.json({ error: "Failed to delete invoice items" }, { status: 500 });
    }

    // Soft delete invoice payments (if any)
    const { error: paymentsDeleteError } = await supabase
      .from("invoice_payments")
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq("invoice_id", id);

    if (paymentsDeleteError) {
      // Don't fail the request if there are no payments
    }

    // Soft delete commission records (if any)
    const { error: commissionsDeleteError } = await supabase
      .from("invoice_employee_commissions")
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq("invoice_id", id);

    if (commissionsDeleteError) {
      // Don't fail the request if there are no commissions
    }

    // Soft delete the invoice
    const { error } = await supabase
      .from("sales_invoices")
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: "Failed to delete invoice" }, { status: 500 });
    }

    if (invoice.sales_order_id) {
      const salesOrderSync = await syncSalesOrderInvoiceStatus({
        supabase,
        salesOrderId: invoice.sales_order_id,
        userId: user.id,
      });

      if (!salesOrderSync.ok) {
        return NextResponse.json({ error: salesOrderSync.error }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "view",
  resourceType: "invoices",
  route: "/api/invoices/[id]",
});
export const PUT = withActivityLogging(PUTHandler, {
  action: "update",
  resourceType: "invoices",
  route: "/api/invoices/[id]",
});
export const DELETE = withActivityLogging(DELETEHandler, {
  action: "delete",
  resourceType: "invoices",
  route: "/api/invoices/[id]",
});
