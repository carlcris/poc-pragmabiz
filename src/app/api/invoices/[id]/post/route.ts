import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { postARInvoice } from "@/services/accounting/arPosting";
import { calculateCOGS, postCOGS } from "@/services/accounting/cogsPosting";
import { calculateInvoiceCommission } from "@/services/commission/commissionService";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import {
  adjustItemLocation,
  ensureWarehouseDefaultLocation,
} from "@/services/inventory/locationService";

// POST /api/invoices/[id]/post - Post an invoice and create stock transactions
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(RESOURCES.SALES_INVOICES, "edit");
    const { supabase } = await createServerClientWithBU();
    const { id } = await params;

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

    // Get the invoice with items
    const { data: invoice, error: invoiceError } = await supabase
      .from("sales_invoices")
      .select("*")
      .eq("id", id)
      .eq("company_id", userData.company_id)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Validate status
    if (invoice.status !== "draft") {
      return NextResponse.json({ error: "Only draft invoices can be posted" }, { status: 400 });
    }

    // Validate warehouse
    if (!invoice.warehouse_id) {
      return NextResponse.json(
        { error: "Invoice must have a warehouse to post stock transactions" },
        { status: 400 }
      );
    }

    // Get invoice items
    const { data: invoiceItems, error: itemsError } = await supabase
      .from("sales_invoice_items")
      .select("*")
      .eq("invoice_id", id)
      .is("deleted_at", null);

    if (itemsError || !invoiceItems || invoiceItems.length === 0) {
      return NextResponse.json({ error: "Invoice items not found" }, { status: 404 });
    }

    // Generate stock transaction code
    const currentYear = new Date().getFullYear();
    const { data: lastTransaction } = await supabase
      .from("stock_transactions")
      .select("transaction_code")
      .eq("company_id", userData.company_id)
      .like("transaction_code", `ST-${currentYear}-%`)
      .order("transaction_code", { ascending: false })
      .limit(1);

    let nextTransactionNum = 1;
    if (lastTransaction && lastTransaction.length > 0) {
      const match = lastTransaction[0].transaction_code.match(/ST-\d+-(\d+)/);
      if (match) {
        nextTransactionNum = parseInt(match[1]) + 1;
      }
    }
    const transactionCode = `ST-${currentYear}-${String(nextTransactionNum).padStart(4, "0")}`;

    // Create stock transaction header
    const defaultLocationId = await ensureWarehouseDefaultLocation({
      supabase,
      companyId: userData.company_id,
      warehouseId: invoice.warehouse_id,
      userId: user.id,
    });
    const selectedLocationId = invoice.custom_fields?.locationId || defaultLocationId;

    const { data: stockTransaction, error: transactionError } = await supabase
      .from("stock_transactions")
      .insert({
        company_id: userData.company_id,
        transaction_code: transactionCode,
        transaction_type: "out",
        transaction_date: invoice.invoice_date,
        warehouse_id: invoice.warehouse_id,
        from_location_id: selectedLocationId,
        reference_type: "sales_invoice",
        reference_id: invoice.id,
        reference_code: invoice.invoice_code,
        notes: `Stock deduction for invoice ${invoice.invoice_code}`,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (transactionError || !stockTransaction) {
      return NextResponse.json({ error: "Failed to create stock transaction" }, { status: 500 });
    }

    // Create stock transaction items and update warehouse inventory
    const now = new Date();
    const postingDate = now.toISOString().split("T")[0];
    const postingTime = now.toTimeString().split(" ")[0];

    for (const item of invoiceItems) {
      const quantity = parseFloat(item.quantity);
      const rate = parseFloat(item.rate);

      // Get current stock from item_warehouse (source of truth)
      const { data: warehouseStock } = await supabase
        .from("item_warehouse")
        .select("current_stock, default_location_id")
        .eq("item_id", item.item_id)
        .eq("warehouse_id", invoice.warehouse_id)
        .single();

      const currentBalance = warehouseStock ? parseFloat(String(warehouseStock.current_stock)) : 0;

      const newBalance = currentBalance - quantity;

      // Validate sufficient stock
      if (newBalance < 0) {
        // Rollback: delete the transaction
        await supabase.from("stock_transactions").delete().eq("id", stockTransaction.id);
        return NextResponse.json(
          {
            error: `Insufficient stock for item. Available: ${currentBalance}, Requested: ${quantity}`,
          },
          { status: 400 }
        );
      }

      // Create stock transaction item with before/after quantities
      const { data: stockTxItem, error: stockTxItemError } = await supabase
        .from("stock_transaction_items")
        .insert({
          company_id: userData.company_id,
          transaction_id: stockTransaction.id,
          item_id: item.item_id,
          quantity: quantity,
          uom_id: item.uom_id,
          unit_cost: rate,
          total_cost: quantity * rate,
          qty_before: currentBalance,
          qty_after: newBalance,
          valuation_rate: rate,
          stock_value_before: currentBalance * rate,
          stock_value_after: newBalance * rate,
          posting_date: postingDate,
          posting_time: postingTime,
          notes: `From invoice ${invoice.invoice_code}`,
          created_by: user.id,
          updated_by: user.id,
        })
        .select()
        .single();

      if (stockTxItemError) {
        // Rollback
        await supabase.from("stock_transactions").delete().eq("id", stockTransaction.id);
        return NextResponse.json(
          { error: "Failed to create stock transaction items" },
          { status: 500 }
        );
      }

      await adjustItemLocation({
        supabase,
        companyId: userData.company_id,
        itemId: item.item_id,
        warehouseId: invoice.warehouse_id,
        locationId: selectedLocationId || warehouseStock?.default_location_id || null,
        userId: user.id,
        qtyOnHandDelta: -quantity,
      });

      // Update item_warehouse current_stock
      const { error: warehouseUpdateError } = await supabase
        .from("item_warehouse")
        .update({
          current_stock: newBalance,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq("item_id", item.item_id)
        .eq("warehouse_id", invoice.warehouse_id);

      if (warehouseUpdateError) {
        // Rollback
        await supabase.from("stock_transaction_items").delete().eq("id", stockTxItem.id);
        await supabase.from("stock_transactions").delete().eq("id", stockTransaction.id);
        return NextResponse.json(
          { error: "Failed to update warehouse inventory" },
          { status: 500 }
        );
      }
    }

    // Update invoice status to 'sent' (or 'posted')
    const { error: updateError } = await supabase
      .from("sales_invoices")
      .update({
        status: "sent",
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: "Failed to update invoice status" }, { status: 500 });
    }

    // Calculate commission when invoice is posted
    let commissionResult = { success: true, commissionTotal: 0, employeeId: null as string | null };
    try {
      commissionResult = await calculateInvoiceCommission(
        invoice.id,
        invoice.primary_employee_id || undefined
      );

      if (!commissionResult.success) {
      }
    } catch {
      // Don't fail invoice posting if commission calculation fails
    }

    // Post AR transaction to general ledger
    const arResult = await postARInvoice(userData.company_id, user.id, {
      invoiceId: invoice.id,
      invoiceCode: invoice.invoice_code,
      customerId: invoice.customer_id,
      invoiceDate: invoice.invoice_date,
      totalAmount: parseFloat(invoice.total_amount),
      description: `Sales invoice ${invoice.invoice_code}`,
    });

    if (!arResult.success) {
      // Log warning but don't fail the invoice posting
      // The invoice is already posted with stock transactions
    }

    // Calculate and post COGS to general ledger
    const cogsCalculation = await calculateCOGS(
      userData.company_id,
      invoice.warehouse_id,
      invoiceItems.map((item) => ({
        itemId: item.item_id,
        quantity: parseFloat(item.quantity),
      }))
    );

    let cogsResult: { success: boolean; journalEntryId?: string; error?: string } = {
      success: true,
    };

    if (cogsCalculation.success && cogsCalculation.items && cogsCalculation.totalCOGS) {
      cogsResult = await postCOGS(userData.company_id, user.id, {
        invoiceId: invoice.id,
        invoiceCode: invoice.invoice_code,
        warehouseId: invoice.warehouse_id,
        invoiceDate: invoice.invoice_date,
        items: cogsCalculation.items,
        totalCOGS: cogsCalculation.totalCOGS,
        description: `COGS for invoice ${invoice.invoice_code}`,
      });

      if (!cogsResult.success) {
      }
    } else {
    }

    return NextResponse.json(
      {
        success: true,
        transactionId: stockTransaction.id,
        transactionCode: stockTransaction.transaction_code,
        arJournalEntryId: arResult.journalEntryId,
        arPostingSuccess: arResult.success,
        cogsJournalEntryId: cogsResult.journalEntryId,
        cogsPostingSuccess: cogsResult.success,
        cogsTotalAmount: cogsCalculation.totalCOGS,
        commissionTotal: commissionResult.commissionTotal,
        commissionEmployeeId: commissionResult.employeeId,
        commissionSuccess: commissionResult.success,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
