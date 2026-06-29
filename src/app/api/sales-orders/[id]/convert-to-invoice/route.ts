import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { postARInvoice } from "@/services/accounting/arPosting";
import { calculateCOGS, postCOGS, type COGSItem } from "@/services/accounting/cogsPosting";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import {
  adjustItemLocation,
  ensureWarehouseDefaultLocation,
  getItemLocationOnHand,
} from "@/services/inventory/locationService";

type StockSnapshot = {
  currentStock: number;
  defaultLocationId: string | null;
  locationId: string;
  locationOnHand: number;
};

const parseNumber = (value: unknown) => {
  if (value == null) return 0;
  const parsed = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

const logConvertToInvoiceError = (message: string, error: unknown) => {
  console.error(message, error);
};

const shouldSkipInventory = (item: { skip_inventory?: boolean | null }) =>
  item.skip_inventory === true;

// POST /api/sales-orders/[id]/convert-to-invoice
async function POSTHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Check permission first
    const unauthorized = await requirePermission(RESOURCES.SALES_ORDERS, "edit");
    if (unauthorized) return unauthorized;

    const { id: salesOrderId } = await params;
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

    // Validate warehouse_id from request body
    if (!body.warehouseId) {
      return NextResponse.json(
        { error: "Warehouse is required to create invoice and stock transactions" },
        { status: 400 }
      );
    }

    // Step 1: Fetch sales order details with items
    const { data: salesOrder, error: salesOrderError } = await supabase
      .from("sales_orders")
      .select(
        `
        *,
        customers:customer_id (
          id,
          customer_name,
          email,
          billing_address_line1,
          billing_address_line2,
          billing_city,
          billing_state,
          billing_country,
          billing_postal_code
        )
      `
      )
      .eq("id", salesOrderId)
      .is("deleted_at", null)
      .single();

    if (salesOrderError || !salesOrder) {
      return NextResponse.json({ error: "Sales order not found" }, { status: 404 });
    }

    // Step 2: Validate sales order status
    if (salesOrder.status !== "confirmed" && salesOrder.status !== "in_progress") {
      return NextResponse.json(
        { error: "Only confirmed or in-progress sales orders can be converted to invoices" },
        { status: 400 }
      );
    }

    // Check if already converted
    const { data: existingInvoice, error: existingInvoiceError } = await supabase
      .from("sales_invoices")
      .select("id, invoice_code, status")
      .eq("sales_order_id", salesOrderId)
      .neq("status", "cancelled")
      .is("deleted_at", null)
      .maybeSingle();

    if (existingInvoiceError) {
      logConvertToInvoiceError("Error checking existing invoice:", existingInvoiceError);
      return NextResponse.json({ error: "Failed to check invoice status" }, { status: 500 });
    }

    if (existingInvoice) {
      return NextResponse.json(
        {
          error: "This sales order has already been converted to an invoice",
          invoice: {
            id: existingInvoice.id,
            invoiceNumber: existingInvoice.invoice_code,
          },
        },
        { status: 400 }
      );
    }

    // Fetch sales order items
    const { data: salesOrderItems, error: itemsError } = await supabase
      .from("sales_order_items")
      .select("*")
      .eq("order_id", salesOrderId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true });

    if (itemsError) {
      return NextResponse.json({ error: "Failed to fetch sales order items" }, { status: 500 });
    }

    if (!salesOrderItems || salesOrderItems.length === 0) {
      return NextResponse.json(
        { error: "Sales order must have at least one item" },
        { status: 400 }
      );
    }

    const stockManagedItems = salesOrderItems.filter((item) => !shouldSkipInventory(item));

    const salesItemIds = salesOrderItems.map((item) => item.item_id);
    const { data: salesItemUoms } = await supabase
      .from("items")
      .select("id, uom_id")
      .in("id", salesItemIds);
    const salesUomMap = new Map(
      (salesItemUoms as Array<{ id: string; uom_id: string | null }> | null)?.map((row) => [
        row.id,
        row.uom_id,
      ]) || []
    );

    const missingUomItem = salesOrderItems.find(
      (item) => !(item.uom_id ?? salesUomMap.get(item.item_id))
    );
    if (missingUomItem) {
      return NextResponse.json({ error: "Item UOM not found for invoice" }, { status: 400 });
    }

    const defaultLocationId = await ensureWarehouseDefaultLocation({
      supabase,
      companyId: salesOrder.company_id,
      warehouseId: body.warehouseId,
      userId: user.id,
    });
    const selectedLocationId = body.locationId || defaultLocationId;
    const stockByItemId = new Map<string, StockSnapshot>();

    for (const item of stockManagedItems) {
      const quantity = parseNumber(item.quantity);
      let snapshot = stockByItemId.get(item.item_id);

      if (!snapshot) {
        const { data: warehouseStock, error: warehouseStockError } = await supabase
          .from("item_warehouse")
          .select("current_stock, default_location_id")
          .eq("company_id", salesOrder.company_id)
          .eq("item_id", item.item_id)
          .eq("warehouse_id", body.warehouseId)
          .is("deleted_at", null)
          .maybeSingle();

        if (warehouseStockError) {
          logConvertToInvoiceError("Error fetching warehouse stock:", warehouseStockError);
          return NextResponse.json({ error: "Failed to validate stock" }, { status: 500 });
        }

        const locationId = selectedLocationId || warehouseStock?.default_location_id || null;
        if (!locationId) {
          return NextResponse.json(
            { error: "Warehouse location is required to create invoice stock transactions" },
            { status: 400 }
          );
        }

        let locationOnHand = 0;
        try {
          locationOnHand = await getItemLocationOnHand({
            supabase,
            companyId: salesOrder.company_id,
            itemId: item.item_id,
            warehouseId: body.warehouseId,
            locationId,
          });
        } catch (locationStockError) {
          logConvertToInvoiceError("Error fetching location stock:", locationStockError);
          return NextResponse.json({ error: "Failed to validate location stock" }, { status: 500 });
        }

        snapshot = {
          currentStock: parseNumber(warehouseStock?.current_stock),
          defaultLocationId: warehouseStock?.default_location_id ?? null,
          locationId,
          locationOnHand,
        };
        stockByItemId.set(item.item_id, snapshot);
      }

      if (snapshot.currentStock < quantity) {
        return NextResponse.json(
          {
            error: `Insufficient stock for item. Available: ${snapshot.currentStock}, Requested: ${quantity}`,
          },
          { status: 400 }
        );
      }

      if (snapshot.locationOnHand < quantity) {
        return NextResponse.json(
          {
            error: `Insufficient stock at selected location. Available: ${snapshot.locationOnHand}, Requested: ${quantity}`,
          },
          { status: 400 }
        );
      }

      snapshot.currentStock -= quantity;
      snapshot.locationOnHand -= quantity;
    }

    // Step 3: Calculate due date (default: 30 days from now)
    const today = new Date();
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + 30);

    // Step 4: Create invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from("sales_invoices")
      .insert({
        company_id: salesOrder.company_id,
        business_unit_id: currentBusinessUnitId,
        customer_id: salesOrder.customer_id,
        warehouse_id: body.warehouseId,
        custom_fields: body.locationId ? { locationId: body.locationId } : null,
        sales_order_id: salesOrderId,
        invoice_date: today.toISOString().split("T")[0],
        due_date: dueDate.toISOString().split("T")[0],
        status: "sent",
        subtotal: salesOrder.subtotal,
        discount_amount: salesOrder.discount_amount,
        tax_amount: salesOrder.tax_amount,
        total_amount: salesOrder.total_amount,
        amount_paid: 0,
        amount_due: salesOrder.total_amount,
        billing_address_line1: salesOrder.customers?.billing_address_line1 || "",
        billing_address_line2: salesOrder.customers?.billing_address_line2 || "",
        billing_city: salesOrder.customers?.billing_city || "",
        billing_state: salesOrder.customers?.billing_state || "",
        billing_country: salesOrder.customers?.billing_country || "",
        billing_postal_code: salesOrder.customers?.billing_postal_code || "",
        payment_terms: salesOrder.payment_terms || "Payment due within 30 days",
        notes: salesOrder.notes || "",
        commission_total: 0,
        commission_split_count: 0,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (invoiceError) {
      logConvertToInvoiceError("Error creating invoice:", invoiceError);
      return NextResponse.json({ error: "Failed to create invoice" }, { status: 500 });
    }

    // Step 6: Copy sales order items to invoice items
    const invoiceItemsToInsert = salesOrderItems.map((item, index) => {
      return {
        company_id: salesOrder.company_id,
        invoice_id: invoice.id,
        item_id: item.item_id,
        skip_inventory: shouldSkipInventory(item),
        item_description: item.item_description,
        quantity: parseFloat(item.quantity),
        uom_id: item.uom_id,
        pricing_tier: item.pricing_tier || null,
        pricing_tier_name: item.pricing_tier_name || null,
        rate: item.rate,
        discount_percent: item.discount_percent || 0,
        discount_amount: item.discount_amount || 0,
        tax_percent: item.tax_percent || 0,
        tax_amount: item.tax_amount || 0,
        line_total: item.line_total,
        sort_order: item.sort_order || index,
        created_by: user.id,
        updated_by: user.id,
      };
    });

    const { error: invoiceItemsError } = await supabase
      .from("sales_invoice_items")
      .insert(invoiceItemsToInsert);

    if (invoiceItemsError) {
      // Rollback: delete the invoice
      await supabase.from("sales_invoices").delete().eq("id", invoice.id);
      logConvertToInvoiceError("Error creating invoice items:", invoiceItemsError);
      return NextResponse.json({ error: "Failed to create invoice items" }, { status: 500 });
    }

    // Step 7: Create stock transactions and ledger entries for stock-managed lines only
    const now = new Date();
    const postingDate = now.toISOString().split("T")[0];
    const postingTime = now.toTimeString().split(" ")[0];
    const adjustedLocations: Array<{ itemId: string; locationId: string; quantity: number }> = [];

    if (stockManagedItems.length > 0) {
      const { data: createdStockTransaction, error: transactionError } = await supabase
        .from("stock_transactions")
        .insert({
          company_id: salesOrder.company_id,
          business_unit_id: currentBusinessUnitId,
          transaction_type: "out",
          transaction_date: today.toISOString().split("T")[0],
          warehouse_id: body.warehouseId,
          from_location_id: selectedLocationId,
          reference_type: "sales_invoice",
          reference_id: invoice.id,
          reference_code: invoice.invoice_code,
          notes: `Stock deduction for invoice ${invoice.invoice_code} (from SO ${salesOrder.order_code})`,
          created_by: user.id,
          updated_by: user.id,
        })
        .select()
        .single();

      if (transactionError || !createdStockTransaction) {
        await supabase.from("sales_invoice_items").delete().eq("invoice_id", invoice.id);
        await supabase.from("sales_invoices").delete().eq("id", invoice.id);
        logConvertToInvoiceError("Error creating stock transaction:", transactionError);
        return NextResponse.json({ error: "Failed to create stock transaction" }, { status: 500 });
      }

      const stockTransactionId = createdStockTransaction.id;

      const transactionItemsToInsert = stockManagedItems.map((item) => {
        const quantity = parseNumber(item.quantity);
        const uomId = item.uom_id ?? salesUomMap.get(item.item_id) ?? null;

        return {
          company_id: salesOrder.company_id,
          transaction_id: stockTransactionId,
          item_id: item.item_id,
          quantity,
          uom_id: uomId,
          unit_cost: parseNumber(item.rate),
          total_cost: quantity * parseNumber(item.rate),
          created_by: user.id,
          updated_by: user.id,
        };
      });

      const { data: transactionItems, error: transactionItemsError } = await supabase
        .from("stock_transaction_items")
        .insert(transactionItemsToInsert)
        .select();

      if (transactionItemsError || !transactionItems) {
        await supabase.from("stock_transactions").delete().eq("id", stockTransactionId);
        await supabase.from("sales_invoice_items").delete().eq("invoice_id", invoice.id);
        await supabase.from("sales_invoices").delete().eq("id", invoice.id);
        logConvertToInvoiceError("Error creating stock transaction items:", transactionItemsError);
        return NextResponse.json(
          { error: "Failed to create stock transaction items" },
          { status: 500 }
        );
      }

      for (let i = 0; i < stockManagedItems.length; i++) {
        const item = stockManagedItems[i];
        const transactionItem = transactionItems[i];
        const quantity = parseNumber(item.quantity);
        const rate = parseNumber(item.rate);

        const { data: warehouseStock, error: warehouseStockError } = await supabase
          .from("item_warehouse")
          .select("current_stock, default_location_id")
          .eq("company_id", salesOrder.company_id)
          .eq("item_id", item.item_id)
          .eq("warehouse_id", body.warehouseId)
          .is("deleted_at", null)
          .maybeSingle();

        if (warehouseStockError) {
          await supabase
            .from("stock_transaction_items")
            .delete()
            .eq("transaction_id", stockTransactionId);
          await supabase.from("stock_transactions").delete().eq("id", stockTransactionId);
          await supabase.from("sales_invoice_items").delete().eq("invoice_id", invoice.id);
          await supabase.from("sales_invoices").delete().eq("id", invoice.id);
          logConvertToInvoiceError("Error fetching warehouse stock:", warehouseStockError);
          return NextResponse.json({ error: "Failed to validate stock" }, { status: 500 });
        }

        const currentBalance = parseNumber(warehouseStock?.current_stock);
        const newBalance = currentBalance - quantity;

        if (newBalance < 0) {
          await supabase
            .from("stock_transaction_items")
            .delete()
            .eq("transaction_id", stockTransactionId);
          await supabase.from("stock_transactions").delete().eq("id", stockTransactionId);
          await supabase.from("sales_invoice_items").delete().eq("invoice_id", invoice.id);
          await supabase.from("sales_invoices").delete().eq("id", invoice.id);
          return NextResponse.json(
            {
              error: `Insufficient stock for item. Available: ${currentBalance}, Requested: ${quantity}`,
            },
            { status: 400 }
          );
        }

        const { error: updateTxItemError } = await supabase
          .from("stock_transaction_items")
          .update({
            qty_before: currentBalance,
            qty_after: newBalance,
            valuation_rate: rate,
            stock_value_before: currentBalance * rate,
            stock_value_after: newBalance * rate,
            posting_date: postingDate,
            posting_time: postingTime,
          })
          .eq("id", transactionItem.id);

        if (updateTxItemError) {
          await supabase
            .from("stock_transaction_items")
            .delete()
            .eq("transaction_id", stockTransactionId);
          await supabase.from("stock_transactions").delete().eq("id", stockTransactionId);
          await supabase.from("sales_invoice_items").delete().eq("invoice_id", invoice.id);
          await supabase.from("sales_invoices").delete().eq("id", invoice.id);
          logConvertToInvoiceError("Error updating stock transaction item:", updateTxItemError);
          return NextResponse.json(
            { error: "Failed to update stock transaction items" },
            { status: 500 }
          );
        }

        const locationId = selectedLocationId || warehouseStock?.default_location_id || null;
        try {
          await adjustItemLocation({
            supabase,
            companyId: salesOrder.company_id,
            itemId: item.item_id,
            warehouseId: body.warehouseId,
            locationId,
            userId: user.id,
            qtyOnHandDelta: -quantity,
          });
        } catch (locationError) {
          await supabase
            .from("stock_transaction_items")
            .delete()
            .eq("transaction_id", stockTransactionId);
          await supabase.from("stock_transactions").delete().eq("id", stockTransactionId);
          await supabase.from("sales_invoice_items").delete().eq("invoice_id", invoice.id);
          await supabase.from("sales_invoices").delete().eq("id", invoice.id);
          logConvertToInvoiceError("Error updating item location stock:", locationError);
          return NextResponse.json(
            { error: "Insufficient stock at selected location" },
            { status: 400 }
          );
        }

        if (locationId) {
          adjustedLocations.push({ itemId: item.item_id, locationId, quantity });
        }

        const { error: updateWarehouseError } = await supabase
          .from("item_warehouse")
          .update({
            current_stock: newBalance,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          })
          .eq("item_id", item.item_id)
          .eq("warehouse_id", body.warehouseId);

        if (updateWarehouseError) {
          await supabase
            .from("stock_transaction_items")
            .delete()
            .eq("transaction_id", stockTransactionId);
          await supabase.from("stock_transactions").delete().eq("id", stockTransactionId);
          await supabase.from("sales_invoice_items").delete().eq("invoice_id", invoice.id);
          await supabase.from("sales_invoices").delete().eq("id", invoice.id);
          for (const adjusted of adjustedLocations.reverse()) {
            await adjustItemLocation({
              supabase,
              companyId: salesOrder.company_id,
              itemId: adjusted.itemId,
              warehouseId: body.warehouseId,
              locationId: adjusted.locationId,
              userId: user.id,
              qtyOnHandDelta: adjusted.quantity,
            });
          }
          logConvertToInvoiceError("Error updating warehouse inventory:", updateWarehouseError);
          return NextResponse.json(
            { error: "Failed to update warehouse inventory" },
            { status: 500 }
          );
        }
      }
    }

    // Step 8: Update sales order status to 'invoiced'
    const { error: updateError } = await supabase
      .from("sales_orders")
      .update({
        status: "invoiced",
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", salesOrderId);

    if (updateError) {
      // Note: We don't rollback here as the invoice is already created successfully
      logConvertToInvoiceError(
        "Error updating sales order status after invoice conversion:",
        updateError
      );
    }

    // Step 9: Post AR transaction to general ledger
    let arResult: { success: boolean; journalEntryId?: string; error?: string } = {
      success: false,
      journalEntryId: undefined,
      error: undefined,
    };

    try {
      arResult = await postARInvoice(salesOrder.company_id, user.id, {
        invoiceId: invoice.id,
        invoiceCode: invoice.invoice_code,
        customerId: invoice.customer_id,
        invoiceDate: invoice.invoice_date,
        totalAmount: parseNumber(invoice.total_amount),
        description: `Sales invoice ${invoice.invoice_code} (from SO ${salesOrder.order_code})`,
      });

      if (!arResult.success) {
        logConvertToInvoiceError("AR posting failed after invoice conversion:", arResult.error);
      }
    } catch (postingError) {
      logConvertToInvoiceError(
        "Unexpected AR posting error after invoice conversion:",
        postingError
      );
    }

    // Step 10: Calculate and post COGS to general ledger
    let cogsCalculation: {
      success: boolean;
      items?: COGSItem[];
      totalCOGS?: number;
      error?: string;
    } = {
      success: false,
      totalCOGS: undefined,
    };

    let cogsResult: { success: boolean; journalEntryId?: string; error?: string } = {
      success: false,
      journalEntryId: undefined,
    };

    try {
      if (stockManagedItems.length > 0) {
        cogsCalculation = await calculateCOGS(
          salesOrder.company_id,
          body.warehouseId,
          stockManagedItems.map((item) => ({
            itemId: item.item_id,
            quantity: parseNumber(item.quantity),
          }))
        );
      }

      if (cogsCalculation.success && cogsCalculation.items && cogsCalculation.totalCOGS) {
        cogsResult = await postCOGS(salesOrder.company_id, user.id, {
          invoiceId: invoice.id,
          invoiceCode: invoice.invoice_code,
          warehouseId: body.warehouseId,
          invoiceDate: invoice.invoice_date,
          items: cogsCalculation.items,
          totalCOGS: cogsCalculation.totalCOGS,
          description: `COGS for invoice ${invoice.invoice_code} (from SO ${salesOrder.order_code})`,
        });

        if (!cogsResult.success && cogsResult.error) {
          logConvertToInvoiceError(
            "COGS posting failed after invoice conversion:",
            cogsResult.error
          );
        }
      } else if (cogsCalculation.error) {
        logConvertToInvoiceError(
          "COGS calculation failed after invoice conversion:",
          cogsCalculation.error
        );
      }
    } catch (cogsError) {
      logConvertToInvoiceError(
        "Unexpected COGS posting error after invoice conversion:",
        cogsError
      );
    }

    // Return success with invoice details
    return NextResponse.json({
      success: true,
      message: "Sales order successfully converted to Invoice",
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoice_code,
      },
      arJournalEntryId: arResult.journalEntryId,
      arPostingSuccess: arResult.success,
      cogsJournalEntryId: cogsResult.journalEntryId,
      cogsPostingSuccess: cogsResult.success,
      cogsTotalAmount: cogsCalculation.totalCOGS,
    });
  } catch (error) {
    logConvertToInvoiceError("Unexpected sales order invoice conversion error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = withActivityLogging(POSTHandler, {
  action: "convert_to_invoice",
  resourceType: "sales_orders",
  route: "/api/sales-orders/[id]/convert-to-invoice",
});
