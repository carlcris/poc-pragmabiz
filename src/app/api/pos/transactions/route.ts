import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { postPOSSale, calculatePOSCOGS, postPOSCOGS } from "@/services/accounting/posPosting";
import { createPOSStockTransaction } from "@/services/inventory/posStockService";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import {
  calculateInclusiveVat,
  calculatePOSLineTotal,
  calculatePOSTotals,
  POS_VAT_RATE_PERCENT,
} from "@/lib/pos/totals";
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
  pricingTier?: string;
  pricingTierName?: string;
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
  warehouseId?: string;
  items: POSItemInput[];
  payments: POSPaymentInput[];
  notes?: string;
};

type POSCustomer = {
  id: string;
  name: string;
  paymentTerms: string | null;
};

type ProcessedPOSItem = POSItemInput & {
  lineTotal: number;
};

type InvoicePaymentMethod =
  | "cash"
  | "credit_card"
  | "gcash"
  | "maya"
  | "check"
  | "bank_transfer"
  | "other";

type POSInvoiceIntegration = {
  salesInvoiceId: string;
  salesInvoiceNumber: string;
  invoicePaymentIds: string[];
  invoicePaymentCodes: string[];
};

type SupabaseServerClient = Awaited<ReturnType<typeof createServerClientWithBU>>["supabase"];

async function voidCreatedPOSTransaction(params: {
  supabase: SupabaseServerClient;
  transactionId: string;
  companyId: string;
  userId: string;
  businessUnitId: string;
  reason: string;
}) {
  const { supabase, transactionId, companyId, userId, businessUnitId, reason } = params;

  const { error } = await supabase.rpc("void_pos_transaction", {
    p_transaction_id: transactionId,
    p_company_id: companyId,
    p_user_id: userId,
    p_business_unit_id: businessUnitId,
    p_void_reason: reason,
  });

  if (error) {
    console.error("Failed to roll back POS transaction through void RPC", {
      transactionId,
      code: error.code,
      message: error.message,
    });
  }
}

function mapPOSPaymentMethodToInvoiceMethod(method: PaymentMethod): InvoicePaymentMethod {
  switch (method) {
    case "cash":
      return "cash";
    case "credit_card":
      return "credit_card";
    case "gcash":
      return "gcash";
    case "paymaya":
      return "maya";
    case "debit_card":
      return "other";
    default:
      return "other";
  }
}

async function findOrCreatePOSCustomer(params: {
  supabase: Awaited<ReturnType<typeof createServerClientWithBU>>["supabase"];
  companyId: string;
  userId: string;
  customerId?: string;
}): Promise<POSCustomer | null> {
  const { supabase, companyId, userId, customerId } = params;

  if (customerId) {
    const { data: customer, error } = await supabase
      .from("customers")
      .select("id, customer_name, payment_terms")
      .eq("id", customerId)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .single();

    if (error || !customer) {
      return null;
    }

    return {
      id: customer.id,
      name: customer.customer_name,
      paymentTerms: customer.payment_terms,
    };
  }

  const { data: existingCustomer, error: existingError } = await supabase
    .from("customers")
    .select("id, customer_name, payment_terms")
    .eq("company_id", companyId)
    .eq("customer_code", "WALK-IN")
    .is("deleted_at", null)
    .maybeSingle();

  if (existingError) {
    return null;
  }

  if (existingCustomer) {
    return {
      id: existingCustomer.id,
      name: existingCustomer.customer_name,
      paymentTerms: existingCustomer.payment_terms,
    };
  }

  const { data: createdCustomer, error: createError } = await supabase
    .from("customers")
    .insert({
      company_id: companyId,
      customer_code: "WALK-IN",
      customer_name: "Walk-in Customer",
      customer_type: "individual",
      payment_terms: "cash",
      credit_limit: 0,
      is_active: true,
      created_by: userId,
      updated_by: userId,
    })
    .select("id, customer_name, payment_terms")
    .single();

  if (!createError && createdCustomer) {
    return {
      id: createdCustomer.id,
      name: createdCustomer.customer_name,
      paymentTerms: createdCustomer.payment_terms,
    };
  }

  // Retry after a possible concurrent checkout created the shared walk-in customer.
  const { data: retriedCustomer } = await supabase
    .from("customers")
    .select("id, customer_name, payment_terms")
    .eq("company_id", companyId)
    .eq("customer_code", "WALK-IN")
    .is("deleted_at", null)
    .maybeSingle();

  if (!retriedCustomer) {
    return null;
  }

  return {
    id: retriedCustomer.id,
    name: retriedCustomer.customer_name,
    paymentTerms: retriedCustomer.payment_terms,
  };
}

async function createSalesInvoiceForPOSTransaction(params: {
  supabase: Awaited<ReturnType<typeof createServerClientWithBU>>["supabase"];
  companyId: string;
  businessUnitId: string;
  userId: string;
  warehouseId: string | null;
  transaction: POSTransactionRow;
  customer: POSCustomer;
  items: ProcessedPOSItem[];
  payments: POSPaymentInput[];
  notes?: string;
}): Promise<POSInvoiceIntegration | null> {
  const {
    supabase,
    companyId,
    businessUnitId,
    userId,
    warehouseId,
    transaction,
    customer,
    items,
    payments,
    notes,
  } = params;

  const invoiceDate = transaction.transaction_date.split("T")[0];
  const totalAmount = Number(transaction.total_amount);

  const { data: itemsWithUom, error: itemsWithUomError } = await supabase
    .from("items")
    .select("id, uom_id")
    .in(
      "id",
      items.map((item) => item.itemId)
    )
    .eq("company_id", companyId);

  if (itemsWithUomError) {
    console.error("Failed to load POS item UOMs for invoice", itemsWithUomError);
    return null;
  }

  const uomByItemId = new Map((itemsWithUom || []).map((item) => [item.id, item.uom_id]));

  const { data: invoice, error: invoiceError } = await supabase
    .from("sales_invoices")
    .insert({
      company_id: companyId,
      business_unit_id: businessUnitId,
      customer_id: customer.id,
      warehouse_id: warehouseId,
      invoice_date: invoiceDate,
      due_date: invoiceDate,
      status: "paid",
      subtotal: Number(transaction.subtotal),
      discount_amount: Number(transaction.total_discount),
      tax_amount: Number(transaction.total_tax),
      total_amount: totalAmount,
      amount_paid: totalAmount,
      amount_due: 0,
      payment_terms: customer.paymentTerms || "cash",
      notes: notes || `POS invoice for ${transaction.transaction_code}`,
      custom_fields: {
        posTransactionId: transaction.id,
        posTransactionCode: transaction.transaction_code,
      },
      created_by: userId,
      updated_by: userId,
    })
    .select("id, invoice_code")
    .single();

  if (invoiceError || !invoice) {
    console.error("Failed to create sales invoice for POS transaction", invoiceError);
    return null;
  }

  const invoiceItemsToInsert = items.map((item, index) => {
    const itemSubtotal = item.quantity * item.unitPrice;
    const discountAmount = Math.min(Math.max(item.discount || 0, 0), itemSubtotal);
    const discountPercent = itemSubtotal > 0 ? (discountAmount / itemSubtotal) * 100 : 0;

    return {
      company_id: companyId,
      invoice_id: invoice.id,
      item_id: item.itemId,
      item_description: item.itemName,
      quantity: item.quantity,
      uom_id: uomByItemId.get(item.itemId) || null,
      pricing_tier: item.pricingTier || null,
      pricing_tier_name: item.pricingTierName || null,
      rate: item.unitPrice,
      discount_percent: discountPercent,
      discount_amount: discountAmount,
      tax_percent: Number(transaction.tax_rate),
      tax_amount: calculateInclusiveVat(item.lineTotal),
      line_total: item.lineTotal,
      sort_order: index,
      created_by: userId,
      updated_by: userId,
    };
  });

  const { error: invoiceItemsError } = await supabase
    .from("sales_invoice_items")
    .insert(invoiceItemsToInsert);

  if (invoiceItemsError) {
    console.error("Failed to create sales invoice items for POS transaction", invoiceItemsError);
    await supabase.from("sales_invoices").delete().eq("id", invoice.id);
    return null;
  }

  let remainingAmount = totalAmount;
  const invoicePaymentsToInsert = payments.flatMap((payment) => {
    const paymentAmount = Number(payment.amount);

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0 || remainingAmount <= 0) {
      return [];
    }

    const appliedAmount = Math.min(paymentAmount, remainingAmount);
    remainingAmount -= appliedAmount;

    return [
      {
        company_id: companyId,
        business_unit_id: businessUnitId,
        invoice_id: invoice.id,
        payment_date: invoiceDate,
        amount: appliedAmount,
        payment_method: mapPOSPaymentMethodToInvoiceMethod(payment.method),
        reference: payment.reference || `POS ${transaction.transaction_code}`,
        notes: `POS payment for ${transaction.transaction_code}`,
        created_by: userId,
        updated_by: userId,
      },
    ];
  });

  if (invoicePaymentsToInsert.length === 0 || remainingAmount > 0.0001) {
    await supabase.from("sales_invoices").delete().eq("id", invoice.id);
    return null;
  }

  const { data: invoicePayments, error: invoicePaymentsError } = await supabase
    .from("invoice_payments")
    .insert(invoicePaymentsToInsert)
    .select("id, payment_code");

  if (invoicePaymentsError || !invoicePayments) {
    console.error("Failed to create invoice payments for POS transaction", invoicePaymentsError);
    await supabase.from("sales_invoices").delete().eq("id", invoice.id);
    return null;
  }

  return {
    salesInvoiceId: invoice.id,
    salesInvoiceNumber: invoice.invoice_code,
    invoicePaymentIds: invoicePayments.map((payment) => payment.id),
    invoicePaymentCodes: invoicePayments.map((payment) => payment.payment_code || ""),
  };
}

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
            pricingTier: item.pricing_tier || undefined,
            pricingTierName: item.pricing_tier_name || undefined,
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

    const body = (await request.json()) as POSCreateBody;
    const { customerId, items, payments, notes } = body;
    const selectedWarehouseId = body.warehouseId || userData.van_warehouse_id;

    if (!selectedWarehouseId) {
      return NextResponse.json({ error: "POS warehouse is required" }, { status: 400 });
    }

    const { data: selectedWarehouse, error: selectedWarehouseError } = await supabase
      .from("warehouses")
      .select("id, business_unit_id")
      .eq("id", selectedWarehouseId)
      .eq("company_id", userData.company_id)
      .eq("is_active", true)
      .is("deleted_at", null)
      .single();

    if (selectedWarehouseError || !selectedWarehouse) {
      return NextResponse.json({ error: "POS warehouse not found" }, { status: 400 });
    }

    if (selectedWarehouse.business_unit_id !== currentBusinessUnitId) {
      return NextResponse.json(
        { error: "POS warehouse does not match the current business unit" },
        { status: 400 }
      );
    }

    const fullName = `${userData.first_name || ""} ${userData.last_name || ""}`.trim() || "Unknown";

    // Validate required fields
    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Items are required" }, { status: 400 });
    }

    if (!payments || payments.length === 0) {
      return NextResponse.json({ error: "Payments are required" }, { status: 400 });
    }

    const processedItems = items.map((item) => ({
      ...item,
      discount: Math.max(0, item.discount || 0),
      lineTotal: calculatePOSLineTotal(item),
    }));
    const { subtotal, totalDiscount, totalTax, totalAmount } = calculatePOSTotals(processedItems);
    const taxRate = POS_VAT_RATE_PERCENT;

    const amountPaid = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const changeAmount = amountPaid - totalAmount;

    if (changeAmount < 0) {
      return NextResponse.json({ error: "Insufficient payment amount" }, { status: 400 });
    }

    const posCustomer = await findOrCreatePOSCustomer({
      supabase,
      companyId: userData.company_id,
      userId: user.id,
      customerId,
    });

    if (!posCustomer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 400 });
    }

    // Create transaction header
    const { data: transaction, error: transactionError } = await supabase
      .from("pos_transactions")
      .insert({
        company_id: userData.company_id,
        business_unit_id: currentBusinessUnitId,
        transaction_date: new Date().toISOString(),
        customer_id: posCustomer.id,
        customer_name: posCustomer.name,
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
      pricing_tier: item.pricingTier || null,
      pricing_tier_name: item.pricingTierName || null,
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

    let stockTransactionId: string | undefined;
    let saleJournalEntryId: string | undefined;
    let cogsJournalEntryId: string | undefined;

    // 1. Create stock transaction. This must succeed so voids can reverse actual stock movement.
    try {
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
          warehouseId: selectedWarehouseId,
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
        await supabase.from("pos_transactions").delete().eq("id", transaction.id);
        return NextResponse.json(
          { error: stockResult.error || "Failed to create stock transaction" },
          { status: 400 }
        );
      }
    } catch (error) {
      console.error("POS stock transaction creation failed", error);
      await supabase.from("pos_transactions").delete().eq("id", transaction.id);
      return NextResponse.json({ error: "Failed to create stock transaction" }, { status: 500 });
    }

    const invoiceIntegration = await createSalesInvoiceForPOSTransaction({
      supabase,
      companyId: userData.company_id,
      businessUnitId: currentBusinessUnitId,
      userId: user.id,
      warehouseId: selectedWarehouseId,
      transaction,
      customer: posCustomer,
      items: processedItems,
      payments,
      notes,
    });

    if (!invoiceIntegration) {
      await voidCreatedPOSTransaction({
        supabase,
        transactionId: transaction.id,
        companyId: userData.company_id,
        userId: user.id,
        businessUnitId: currentBusinessUnitId,
        reason: "POS checkout rollback: invoice creation failed",
      });

      return NextResponse.json(
        { error: "Failed to create sales invoice for POS transaction" },
        { status: 500 }
      );
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
        await voidCreatedPOSTransaction({
          supabase,
          transactionId: transaction.id,
          companyId: userData.company_id,
          userId: user.id,
          businessUnitId: currentBusinessUnitId,
          reason: "POS checkout rollback: sale GL posting failed",
        });

        return NextResponse.json(
          { error: saleResult.error || "Failed to post POS sale to general ledger" },
          { status: 500 }
        );
      }
    } catch (error) {
      console.error("Sale GL posting failed", error);
      await voidCreatedPOSTransaction({
        supabase,
        transactionId: transaction.id,
        companyId: userData.company_id,
        userId: user.id,
        businessUnitId: currentBusinessUnitId,
        reason: "POS checkout rollback: sale GL posting failed",
      });

      return NextResponse.json(
        { error: "Failed to post POS sale to general ledger" },
        { status: 500 }
      );
    }

    // 3. Calculate and post COGS to general ledger
    try {
      const cogsCalculation = await calculatePOSCOGS(userData.company_id, transaction.id);

      if (!cogsCalculation.success) {
        await voidCreatedPOSTransaction({
          supabase,
          transactionId: transaction.id,
          companyId: userData.company_id,
          userId: user.id,
          businessUnitId: currentBusinessUnitId,
          reason: "POS checkout rollback: COGS calculation failed",
        });

        return NextResponse.json(
          { error: cogsCalculation.error || "Failed to calculate POS COGS" },
          { status: 500 }
        );
      }

      if (cogsCalculation.items && cogsCalculation.totalCOGS) {
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
          await voidCreatedPOSTransaction({
            supabase,
            transactionId: transaction.id,
            companyId: userData.company_id,
            userId: user.id,
            businessUnitId: currentBusinessUnitId,
            reason: "POS checkout rollback: COGS GL posting failed",
          });

          return NextResponse.json(
            { error: cogsResult.error || "Failed to post POS COGS to general ledger" },
            { status: 500 }
          );
        }
      }
    } catch (error) {
      console.error("COGS GL posting failed", error);
      await voidCreatedPOSTransaction({
        supabase,
        transactionId: transaction.id,
        companyId: userData.company_id,
        userId: user.id,
        businessUnitId: currentBusinessUnitId,
        reason: "POS checkout rollback: COGS GL posting failed",
      });

      return NextResponse.json(
        { error: "Failed to post POS COGS to general ledger" },
        { status: 500 }
      );
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
            pricingTier: item.pricing_tier || undefined,
            pricingTierName: item.pricing_tier_name || undefined,
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
        integrations: {
          stockTransactionId,
          saleJournalEntryId,
          cogsJournalEntryId,
          salesInvoiceId: invoiceIntegration.salesInvoiceId,
          salesInvoiceNumber: invoiceIntegration.salesInvoiceNumber,
          invoicePaymentIds: invoiceIntegration.invoicePaymentIds,
          invoicePaymentCodes: invoiceIntegration.invoicePaymentCodes,
        },
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
