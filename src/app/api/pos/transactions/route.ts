import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { postPOSSale, calculatePOSCOGS, postPOSCOGS } from "@/services/accounting/posPosting";
import { createPOSStockTransaction } from "@/services/inventory/posStockService";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import type { PaymentMethod } from "@/types/pos";
import type { Tables } from "@/types/supabase";

type POSTransactionRow = Tables<"pos_transactions">;
type POSTransactionItemRow = Tables<"pos_transaction_items">;
type POSTransactionPaymentRow = Tables<"pos_transaction_payments">;

type POSTransactionQueryRow = POSTransactionRow & {
  pos_transaction_items?: POSTransactionItemRow[];
  pos_transaction_payments?: POSTransactionPaymentRow[];
};

type POSItemInput = {
  itemId: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
};

type POSPaymentInput = {
  method: PaymentMethod;
  amount: number | string;
  reference?: string;
};

type POSCreateBody = {
  customerId?: string;
  items: POSItemInput[];
  payments: POSPaymentInput[];
  notes?: string;
};

export async function GET(request: NextRequest) {
  try {
    await requirePermission(RESOURCES.POS, "view");

    const { supabase, companyId } = await createServerClientWithBU();

    if (!companyId) {
      return NextResponse.json({ error: "User company not found" }, { status: 400 });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") || "10", 10)), 50);
    const status = searchParams.get("status");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const cashierId = searchParams.get("cashierId");
    const includeDetails = searchParams.get("includeDetails") === "true";

    const baseSelect = `
      id,
      transaction_code,
      transaction_date,
      customer_id,
      customer_name,
      subtotal,
      total_discount,
      tax_rate,
      total_tax,
      total_amount,
      amount_paid,
      change_amount,
      status,
      cashier_id,
      cashier_name,
      notes,
      created_at,
      updated_at
    `;

    const fullSelect = `
      id,
      transaction_code,
      transaction_date,
      customer_id,
      customer_name,
      subtotal,
      total_discount,
      tax_rate,
      total_tax,
      total_amount,
      amount_paid,
      change_amount,
      status,
      cashier_id,
      cashier_name,
      notes,
      created_at,
      updated_at,
      pos_transaction_items (
        id,
        item_id,
        item_code,
        item_name,
        quantity,
        unit_price,
        discount,
        line_total
      ),
      pos_transaction_payments (
        id,
        payment_method,
        amount,
        reference
      )
    `;

    // Build query
    let query = includeDetails
      ? supabase
          .from("pos_transactions")
          .select(fullSelect, { count: "exact" })
          .eq("company_id", companyId)
          .order("transaction_date", { ascending: false })
      : supabase
          .from("pos_transactions")
          .select(baseSelect, { count: "exact" })
          .eq("company_id", companyId)
          .order("transaction_date", { ascending: false });

    // Apply filters
    if (search) {
      query = query.or(
        `transaction_code.ilike.%${search}%,customer_name.ilike.%${search}%,cashier_name.ilike.%${search}%`
      );
    }

    if (status) {
      query = query.eq("status", status);
    }

    if (dateFrom) {
      query = query.gte("transaction_date", dateFrom);
    }

    if (dateTo) {
      // Add one day to include the entire end date
      const endDate = new Date(dateTo);
      endDate.setDate(endDate.getDate() + 1);
      query = query.lt("transaction_date", endDate.toISOString().split("T")[0]);
    }

    if (cashierId) {
      query = query.eq("cashier_id", cashierId);
    }

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: "Failed to fetch POS transactions" }, { status: 500 });
    }

    const itemCountByTransactionId = new Map<string, number>();
    if (!includeDetails) {
      const transactionIds = ((data as POSTransactionQueryRow[] | null) || []).map((txn) => txn.id);
      if (transactionIds.length > 0) {
        const { data: itemRows } = await supabase
          .from("pos_transaction_items")
          .select("pos_transaction_id")
          .in("pos_transaction_id", transactionIds);
        (itemRows || []).forEach((row) => {
          const key = row.pos_transaction_id;
          itemCountByTransactionId.set(key, (itemCountByTransactionId.get(key) || 0) + 1);
        });
      }
    }

    // Transform data to match POSTransaction type
    const transactions =
      (data as POSTransactionQueryRow[] | null)?.map((txn) => ({
        id: txn.id,
        companyId,
        transactionNumber: txn.transaction_code,
        transactionDate: txn.transaction_date,
        customerId: txn.customer_id,
        customerName: txn.customer_name,
        items:
          txn.pos_transaction_items?.map((item) => ({
            id: item.id,
            itemId: item.item_id,
            itemCode: item.item_code,
            itemName: item.item_name,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unit_price),
            discount: Number(item.discount),
            lineTotal: Number(item.line_total),
          })) || [],
        subtotal: Number(txn.subtotal),
        totalDiscount: Number(txn.total_discount),
        taxRate: Number(txn.tax_rate),
        totalTax: Number(txn.total_tax),
        totalAmount: Number(txn.total_amount),
        payments:
          txn.pos_transaction_payments?.map((payment) => ({
            method: payment.payment_method,
            amount: Number(payment.amount),
            reference: payment.reference,
          })) || [],
        amountPaid: Number(txn.amount_paid),
        changeAmount: Number(txn.change_amount),
        status: txn.status,
        cashierId: txn.cashier_id,
        cashierName: txn.cashier_name,
        itemCount: includeDetails
          ? txn.pos_transaction_items?.length || 0
          : itemCountByTransactionId.get(txn.id) || 0,
        notes: txn.notes,
        createdAt: txn.created_at,
        updatedAt: txn.updated_at,
      })) || [];

    return NextResponse.json({
      data: transactions,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(RESOURCES.POS, "create");

    const { supabase, currentBusinessUnitId } = await createServerClientWithBU();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user details including van_warehouse_id
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("company_id, first_name, last_name, van_warehouse_id")
      .eq("id", user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check business unit context
    if (!currentBusinessUnitId) {
      return NextResponse.json({ error: "Business unit context required" }, { status: 400 });
    }

    // Check if user has a warehouse assigned (required for stock transactions)
    if (!userData.van_warehouse_id) {
    }

    const fullName = `${userData.first_name || ""} ${userData.last_name || ""}`.trim() || "Unknown";

    const body = (await request.json()) as POSCreateBody;
    const { customerId, items, payments, notes } = body;

    // Validate required fields
    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Items are required" }, { status: 400 });
    }

    if (!payments || payments.length === 0) {
      return NextResponse.json({ error: "Payments are required" }, { status: 400 });
    }

    // Calculate totals
    let subtotal = 0;
    let totalDiscount = 0;
    const taxRate = 0; // Can be configured

    const processedItems = items.map((item) => {
      const itemSubtotal = item.quantity * item.unitPrice;
      const itemDiscount = (itemSubtotal * (item.discount || 0)) / 100;
      const lineTotal = itemSubtotal - itemDiscount;

      subtotal += itemSubtotal;
      totalDiscount += itemDiscount;

      return {
        ...item,
        lineTotal,
      };
    });

    const totalTax = ((subtotal - totalDiscount) * taxRate) / 100;
    const totalAmount = subtotal - totalDiscount + totalTax;

    const amountPaid = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const changeAmount = amountPaid - totalAmount;

    if (changeAmount < 0) {
      return NextResponse.json({ error: "Insufficient payment amount" }, { status: 400 });
    }

    // Get customer name if customerId provided
    let customerName = null;
    if (customerId) {
      const { data: customer } = await supabase
        .from("customers")
        .select("name")
        .eq("id", customerId)
        .single();
      customerName = customer?.name;
    }

    // Generate transaction code
    const transactionCode = `POS-${Date.now()}`;

    // Create transaction header
    const { data: transaction, error: transactionError } = await supabase
      .from("pos_transactions")
      .insert({
        company_id: userData.company_id,
        business_unit_id: currentBusinessUnitId,
        transaction_code: transactionCode,
        transaction_date: new Date().toISOString(),
        customer_id: customerId,
        customer_name: customerName,
        subtotal: subtotal.toFixed(4),
        total_discount: totalDiscount.toFixed(4),
        tax_rate: taxRate.toFixed(2),
        total_tax: totalTax.toFixed(4),
        total_amount: totalAmount.toFixed(4),
        amount_paid: amountPaid.toFixed(4),
        change_amount: changeAmount.toFixed(4),
        status: "completed",
        cashier_id: user.id,
        cashier_name: fullName,
        notes,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (transactionError) {
      return NextResponse.json({ error: "Failed to create transaction" }, { status: 500 });
    }

    // Create transaction items
    const itemsToInsert = processedItems.map((item) => ({
      pos_transaction_id: transaction.id,
      item_id: item.itemId,
      item_code: item.itemCode,
      item_name: item.itemName,
      quantity: item.quantity.toFixed(4),
      unit_price: item.unitPrice.toFixed(4),
      discount: (item.discount || 0).toFixed(2),
      line_total: item.lineTotal.toFixed(4),
    }));

    const { error: itemsError } = await supabase
      .from("pos_transaction_items")
      .insert(itemsToInsert);

    if (itemsError) {
      // Rollback transaction
      await supabase.from("pos_transactions").delete().eq("id", transaction.id);
      return NextResponse.json({ error: "Failed to create transaction items" }, { status: 500 });
    }

    // Create transaction payments
    const paymentsToInsert = payments.map((payment) => ({
      pos_transaction_id: transaction.id,
      payment_method: payment.method,
      amount: Number(payment.amount).toFixed(4),
      reference: payment.reference,
    }));

    const { error: paymentsError } = await supabase
      .from("pos_transaction_payments")
      .insert(paymentsToInsert);

    if (paymentsError) {
      // Rollback transaction
      await supabase.from("pos_transactions").delete().eq("id", transaction.id);
      return NextResponse.json({ error: "Failed to create transaction payments" }, { status: 500 });
    }

    // Fetch the complete transaction
    const { data: completeTransactionData } = await supabase
      .from("pos_transactions")
      .select(
        `
        *,
        pos_transaction_items (*),
        pos_transaction_payments (*)
      `
      )
      .eq("id", transaction.id)
      .single();
    const completeTransaction = completeTransactionData as POSTransactionQueryRow;

    // ============================================================================
    // POST-TRANSACTION PROCESSING: Stock & Accounting Integration
    // ============================================================================

    const warnings: string[] = [];
    let stockTransactionId: string | undefined;
    let saleJournalEntryId: string | undefined;
    let cogsJournalEntryId: string | undefined;

    // 1. Create stock transaction (if warehouse assigned)
    if (userData.van_warehouse_id) {
      try {
        // Get items with UOM data
        const { data: itemsWithUom } = await supabase
          .from("items")
          .select("id, uom_id")
          .in(
            "id",
            processedItems.map((item) => item.itemId)
          )
          .eq("company_id", userData.company_id);

        const itemsMap = new Map(itemsWithUom?.map((item) => [item.id, item.uom_id]) || []);

        const stockResult = await createPOSStockTransaction(
          userData.company_id,
          currentBusinessUnitId,
          user.id,
          {
            transactionId: transaction.id,
            transactionCode: transaction.transaction_code,
            transactionDate: transaction.transaction_date,
            warehouseId: userData.van_warehouse_id,
            items: processedItems.map((item) => ({
              itemId: item.itemId,
              quantity: Number(item.quantity),
              uomId: itemsMap.get(item.itemId) || "",
              rate: Number(item.unitPrice),
            })),
          }
        );

        if (stockResult.success) {
          stockTransactionId = stockResult.stockTransactionId;
        } else {
          warnings.push(`Stock transaction failed: ${stockResult.error}`);
        }
      } catch {
        warnings.push("Stock transaction creation failed");
      }
    } else {
      warnings.push("No warehouse assigned - stock transaction skipped");
    }

    // 2. Post sale to general ledger
    try {
      const saleResult = await postPOSSale(userData.company_id, user.id, {
        transactionId: transaction.id,
        transactionCode: transaction.transaction_code,
        transactionDate: transaction.transaction_date,
        subtotal: parseFloat(transaction.subtotal),
        totalDiscount: parseFloat(transaction.total_discount),
        totalTax: parseFloat(transaction.total_tax),
        totalAmount: parseFloat(transaction.total_amount),
        amountPaid: parseFloat(transaction.amount_paid),
        description: `POS Sale - ${transaction.transaction_code}`,
      });

      if (saleResult.success) {
        saleJournalEntryId = saleResult.journalEntryId;
      } else {
        warnings.push(`Sale GL posting failed: ${saleResult.error}`);
      }
    } catch {
      warnings.push("Sale GL posting failed");
    }

    // 3. Calculate and post COGS to general ledger
    try {
      const cogsCalculation = await calculatePOSCOGS(userData.company_id, transaction.id);

      if (cogsCalculation.success && cogsCalculation.items && cogsCalculation.totalCOGS) {
        const cogsResult = await postPOSCOGS(userData.company_id, user.id, {
          transactionId: transaction.id,
          transactionCode: transaction.transaction_code,
          transactionDate: transaction.transaction_date,
          items: cogsCalculation.items,
          totalCOGS: cogsCalculation.totalCOGS,
          description: `COGS - POS Sale ${transaction.transaction_code}`,
        });

        if (cogsResult.success) {
          cogsJournalEntryId = cogsResult.journalEntryId;
        } else {
          warnings.push(`COGS GL posting failed: ${cogsResult.error}`);
        }
      } else {
        warnings.push(`COGS calculation failed: ${cogsCalculation.error || "Unknown error"}`);
      }
    } catch {
      warnings.push("COGS GL posting failed");
    }

    // ============================================================================
    // RETURN RESPONSE
    // ============================================================================

    return NextResponse.json(
      {
        data: {
          id: completeTransaction.id,
          companyId: completeTransaction.company_id,
          transactionNumber: completeTransaction.transaction_code,
          transactionDate: completeTransaction.transaction_date,
          customerId: completeTransaction.customer_id,
          customerName: completeTransaction.customer_name,
          items: (completeTransaction.pos_transaction_items || []).map((item) => ({
            id: item.id,
            itemId: item.item_id,
            itemCode: item.item_code,
            itemName: item.item_name,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unit_price),
            discount: Number(item.discount),
            lineTotal: Number(item.line_total),
          })),
          subtotal: Number(completeTransaction.subtotal),
          totalDiscount: Number(completeTransaction.total_discount),
          taxRate: Number(completeTransaction.tax_rate),
          totalTax: Number(completeTransaction.total_tax),
          totalAmount: Number(completeTransaction.total_amount),
          payments: (completeTransaction.pos_transaction_payments || []).map((payment) => ({
            method: payment.payment_method,
            amount: Number(payment.amount),
            reference: payment.reference,
          })),
          amountPaid: Number(completeTransaction.amount_paid),
          changeAmount: Number(completeTransaction.change_amount),
          status: completeTransaction.status,
          cashierId: completeTransaction.cashier_id,
          cashierName: completeTransaction.cashier_name,
          notes: completeTransaction.notes,
          createdAt: completeTransaction.created_at,
          updatedAt: completeTransaction.updated_at,
        },
        warnings: warnings.length > 0 ? warnings : undefined,
        integrations: {
          stockTransactionId,
          saleJournalEntryId,
          cogsJournalEntryId,
        },
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
