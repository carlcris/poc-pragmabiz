import { createServerClientWithBU } from '@/lib/supabase/server-with-bu';
import { NextRequest, NextResponse } from 'next/server';
import { postARInvoice, postARPayment } from '@/services/accounting/arPosting';
import { calculateCOGS, postCOGS } from '@/services/accounting/cogsPosting';
import { calculateInvoiceCommission } from '@/services/commission/commissionService';
import { requirePermission } from '@/lib/auth';
import { RESOURCES } from '@/constants/resources';
import { adjustItemLocation, ensureWarehouseDefaultLocation } from '@/services/inventory/locationService';

interface ProcessPaymentRequest {
  customerId: string;
  warehouseId: string;
  lineItems: {
    itemId: string;
    description: string;
    quantity: number;
    uomId: string;
    unitPrice: number;
    discount?: number; // Discount percentage
  }[];
  payments: {
    paymentMethod: 'cash' | 'check' | 'credit_card' | 'bank_transfer' | 'gcash' | 'paymaya' | 'other';
    amount: number;
    reference?: string;
  }[];
  notes?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Check permission
    const unauthorized = await requirePermission(RESOURCES.VAN_SALES, 'create');
    if (unauthorized) return unauthorized;

    const { supabase, currentBusinessUnitId } = await createServerClientWithBU();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!currentBusinessUnitId) {
      return NextResponse.json(
        { error: 'Business unit context required' },
        { status: 400 }
      )
    }

    const body: ProcessPaymentRequest = await request.json();

    // Get user's company and employee_id
    const { data: userData } = await supabase
      .from('users')
      .select('company_id, employee_id')
      .eq('id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'User company not found' }, { status: 400 });
    }

    // Get employee_id directly from user data (faster than joining employees table)
    const employeeId = userData.employee_id || null;

    // Validate required fields
    if (!body.customerId || !body.lineItems || body.lineItems.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!body.warehouseId) {
      return NextResponse.json({ error: 'Warehouse ID is required' }, { status: 400 });
    }

    if (!body.payments || body.payments.length === 0) {
      return NextResponse.json({ error: 'At least one payment method is required' }, { status: 400 });
    }

    // Validate payment amounts sum up to total
    const totalPaymentAmount = body.payments.reduce((sum, payment) => sum + payment.amount, 0);

    // Validate stock availability for all items
    const itemIds = body.lineItems.map(item => item.itemId);
    const { data: stockData, error: stockError } = await supabase
      .from('item_warehouse')
      .select('item_id, current_stock')
      .eq('warehouse_id', body.warehouseId)
      .in('item_id', itemIds);

    if (stockError) {

      return NextResponse.json({ error: 'Failed to check stock availability' }, { status: 500 });
    }

    // Create a map of item_id to current_stock
    const stockMap = new Map(stockData?.map(s => [s.item_id, parseFloat(s.current_stock) || 0]) || []);

    // Check each item's availability
    for (const item of body.lineItems) {
      const availableStock = stockMap.get(item.itemId) || 0;
      if (item.quantity > availableStock) {
        return NextResponse.json({
          error: `Insufficient stock for item ${item.description}. Available: ${availableStock}, Requested: ${item.quantity}`
        }, { status: 400 });
      }
    }

    const today = new Date().toISOString().split('T')[0];

    // ========================================================================
    // STEP 1: Create Sales Order
    // ========================================================================

    // Generate order number
    const { data: lastOrder } = await supabase
      .from('sales_orders')
      .select('order_code')
      .eq('company_id', userData.company_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let orderNumber = 'SO-00001';
    if (lastOrder?.order_code) {
      const lastNumber = parseInt(lastOrder.order_code.split('-')[1] || '0');
      orderNumber = `SO-${String(lastNumber + 1).padStart(5, '0')}`;
    }

    // Calculate totals
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;

    const itemsWithCalculations = body.lineItems.map((item) => {
      const itemSubtotal = item.quantity * item.unitPrice;
      const discountAmount = (itemSubtotal * (item.discount || 0)) / 100;
      const taxableAmount = itemSubtotal - discountAmount;
      const taxRate = 12; // 12% VAT
      const taxAmount = (taxableAmount * taxRate) / 100;
      const lineTotal = taxableAmount + taxAmount;

      subtotal += itemSubtotal;
      totalDiscount += discountAmount;
      totalTax += taxAmount;

      return {
        ...item,
        discountAmount,
        taxRate,
        taxAmount,
        lineTotal,
      };
    });

    const totalAmount = subtotal - totalDiscount + totalTax;

    // Validate payment amounts match total
    const roundedTotal = Math.round(totalAmount * 100) / 100;
    const roundedPayments = Math.round(totalPaymentAmount * 100) / 100;

    if (Math.abs(roundedPayments - roundedTotal) > 0.01) {
      return NextResponse.json({
        error: `Payment amounts (₱${roundedPayments.toFixed(2)}) do not match invoice total (₱${roundedTotal.toFixed(2)})`
      }, { status: 400 });
    }

    // Create sales order
    const { data: salesOrder, error: orderError } = await supabase
      .from('sales_orders')
      .insert({
        company_id: userData.company_id,
        business_unit_id: currentBusinessUnitId,
        order_code: orderNumber,
        order_date: today,
        customer_id: body.customerId,
        expected_delivery_date: today,
        status: 'confirmed', // Auto-confirm for van sales
        subtotal: subtotal.toFixed(4),
        discount_amount: totalDiscount.toFixed(4),
        tax_amount: totalTax.toFixed(4),
        total_amount: totalAmount.toFixed(4),
        payment_terms: 'Cash',
        notes: body.notes || 'Van sales order',
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (orderError || !salesOrder) {

      return NextResponse.json({ error: 'Failed to create sales order' }, { status: 500 });
    }

    // Create sales order items
    const orderItemsToInsert = itemsWithCalculations.map((item, index) => ({
      company_id: userData.company_id,
      order_id: salesOrder.id,
      item_id: item.itemId,
      item_description: item.description,
      quantity: item.quantity,
      uom_id: item.uomId,
      rate: item.unitPrice,
      discount_percent: item.discount || 0,
      discount_amount: item.discountAmount,
      tax_percent: item.taxRate,
      tax_amount: item.taxAmount,
      line_total: item.lineTotal,
      sort_order: index,
      created_by: user.id,
      updated_by: user.id,
    }));

    const { error: orderItemsError } = await supabase
      .from('sales_order_items')
      .insert(orderItemsToInsert);

    if (orderItemsError) {

      // Rollback: delete the order
      await supabase.from('sales_orders').delete().eq('id', salesOrder.id);
      return NextResponse.json({ error: 'Failed to create sales order items' }, { status: 500 });
    }

    // ========================================================================
    // STEP 2: Create Sales Invoice from Order
    // ========================================================================

    // Generate invoice number (using same format as sales orders: INV-YYYY-NNNN)
    const { data: invoices } = await supabase
      .from('sales_invoices')
      .select('invoice_code')
      .eq('company_id', userData.company_id)
      .order('created_at', { ascending: false })
      .limit(1);

    let invoiceNumber = 'INV-2025-0001';
    if (invoices && invoices.length > 0 && invoices[0].invoice_code) {
      const parts = invoices[0].invoice_code.split('-');
      if (parts.length === 3) {
        // Format: INV-YYYY-NNNN
        const lastNum = parseInt(parts[2]);
        const nextNum = lastNum + 1;
        invoiceNumber = `INV-2025-${String(nextNum).padStart(4, '0')}`;
      } else if (parts.length === 2) {
        // Old format: INV-NNNNN - convert to new format starting from that number
        const lastNum = parseInt(parts[1]);
        const nextNum = lastNum + 1;
        invoiceNumber = `INV-2025-${String(nextNum).padStart(4, '0')}`;
      }
    }

    // Create invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('sales_invoices')
      .insert({
        company_id: userData.company_id,
        business_unit_id: currentBusinessUnitId,
        invoice_code: invoiceNumber,
        customer_id: body.customerId,
        sales_order_id: salesOrder.id,
        warehouse_id: body.warehouseId,
        invoice_date: today,
        due_date: today, // Due today for van sales (cash)
        status: 'draft', // Will be updated after payment
        subtotal: subtotal.toFixed(4),
        discount_amount: totalDiscount.toFixed(4),
        tax_amount: totalTax.toFixed(4),
        total_amount: totalAmount.toFixed(4),
        amount_paid: '0', // Will be updated after payment
        amount_due: totalAmount.toFixed(4),
        payment_terms: 'Cash',
        notes: body.notes || 'Van sales invoice',
        primary_employee_id: employeeId, // Linked to logged-in user's employee record
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (invoiceError || !invoice) {

      return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
    }

    // Create invoice items
    const invoiceItemsToInsert = itemsWithCalculations.map((item, index) => ({
      company_id: userData.company_id,
      invoice_id: invoice.id,
      item_id: item.itemId,
      item_description: item.description,
      quantity: item.quantity,
      uom_id: item.uomId,
      rate: item.unitPrice,
      discount_percent: item.discount || 0,
      discount_amount: item.discountAmount,
      tax_percent: item.taxRate,
      tax_amount: item.taxAmount,
      line_total: item.lineTotal,
      sort_order: index,
      created_by: user.id,
      updated_by: user.id,
    }));

    const { error: invoiceItemsError } = await supabase
      .from('sales_invoice_items')
      .insert(invoiceItemsToInsert);

    if (invoiceItemsError) {

      return NextResponse.json({ error: 'Failed to create invoice items' }, { status: 500 });
    }

    // ========================================================================
    // STEP 3: Record Multiple Payments
    // ========================================================================

    // Get the last payment code to generate new ones
    const { data: lastPayment } = await supabase
      .from('invoice_payments')
      .select('payment_code')
      .eq('company_id', userData.company_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let lastPaymentNumber = 0;
    if (lastPayment?.payment_code) {
      lastPaymentNumber = parseInt(lastPayment.payment_code.split('-')[1] || '0');
    }

    // Create payment records for each payment method
    const paymentRecords = [];
    const paymentCodes = [];

    for (let i = 0; i < body.payments.length; i++) {
      const paymentMethod = body.payments[i];
      const paymentNumber = lastPaymentNumber + i + 1;
      const paymentCode = `PAY-${String(paymentNumber).padStart(5, '0')}`;
      paymentCodes.push(paymentCode);

      const { data: payment, error: paymentError } = await supabase
        .from('invoice_payments')
        .insert({
          company_id: userData.company_id,
          business_unit_id: currentBusinessUnitId,
          invoice_id: invoice.id,
          payment_code: paymentCode,
          payment_date: today,
          amount: paymentMethod.amount.toFixed(4),
          payment_method: paymentMethod.paymentMethod,
          reference: paymentMethod.reference || `Van Sales - ${invoiceNumber} - ${paymentMethod.paymentMethod}`,
          notes: body.notes || `Van sales payment via ${paymentMethod.paymentMethod}`,
          created_by: user.id,
          updated_by: user.id,
        })
        .select()
        .single();

      if (paymentError || !payment) {

        return NextResponse.json({ error: `Failed to record payment for ${paymentMethod.paymentMethod}` }, { status: 500 });
      }

      paymentRecords.push(payment);
    }

    // Update invoice status to 'paid'
    const { error: updateInvoiceError } = await supabase
      .from('sales_invoices')
      .update({
        status: 'paid',
        amount_paid: totalAmount.toFixed(4),
        amount_due: '0',
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoice.id);

    if (updateInvoiceError) {

      return NextResponse.json({ error: 'Failed to update invoice status' }, { status: 500 });
    }

    // create stock transactions entry
    // Get invoice items
    const { data: invoiceItems, error: itemsError } = await supabase
      .from('sales_invoice_items')
      .select('*')
      .eq('invoice_id', invoice.id)
      .is('deleted_at', null)

    if (itemsError || !invoiceItems || invoiceItems.length === 0) {
      return NextResponse.json({ error: 'Invoice items not found' }, { status: 404 })
    }

    // Generate stock transaction code
    const currentYear = new Date().getFullYear()
    const { data: lastTransaction } = await supabase
      .from('stock_transactions')
      .select('transaction_code')
      .eq('company_id', userData.company_id)
      .like('transaction_code', `ST-${currentYear}-%`)
      .order('transaction_code', { ascending: false })
      .limit(1)

    let nextTransactionNum = 1
    if (lastTransaction && lastTransaction.length > 0) {
      const match = lastTransaction[0].transaction_code.match(/ST-\d+-(\d+)/)
      if (match) {
        nextTransactionNum = parseInt(match[1]) + 1
      }
    }
    const transactionCode = `ST-${currentYear}-${String(nextTransactionNum).padStart(4, '0')}`

    const defaultLocationId = await ensureWarehouseDefaultLocation({
      supabase,
      companyId: userData.company_id,
      warehouseId: invoice.warehouse_id,
      userId: user.id,
    })

    // Create stock transaction header
    const { data: stockTransaction, error: transactionError } = await supabase
      .from('stock_transactions')
      .insert({
        company_id: userData.company_id,
        business_unit_id: currentBusinessUnitId,
        transaction_code: transactionCode,
        transaction_type: 'out',
        transaction_date: invoice.invoice_date,
        warehouse_id: invoice.warehouse_id,
        from_location_id: defaultLocationId,
        reference_type: 'sales_invoice',
        reference_id: invoice.id,
        reference_code: invoice.invoice_code,
        notes: `Stock deduction for invoice ${invoice.invoice_code}`,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single()

    if (transactionError || !stockTransaction) {

      return NextResponse.json(
        { error: 'Failed to create stock transaction' },
        { status: 500 }
      )
    }

    // Create stock transaction items and update stock ledger
      // iterate the previously fetched invoiceItems (from sales_invoice_items)
      for (const item of invoiceItems || []) {
        // Create stock transaction item
        const { data: stockTxItem, error: stockTxItemError } = await supabase
        .from('stock_transaction_items')
        .insert({
          company_id: userData.company_id,
          transaction_id: stockTransaction.id,
          item_id: item.item_id,
          quantity: parseFloat(String(item.quantity)) || 0,
          uom_id: item.uom_id,
          unit_cost: parseFloat(String(item.rate)) || 0,
          total_cost: (parseFloat(String(item.quantity)) || 0) * (parseFloat(String(item.rate)) || 0),
          notes: `From invoice ${invoice.invoice_code}`,
          created_by: user.id,
          updated_by: user.id,
        })
        .select()
        .single()

        if (stockTxItemError) {

          // Rollback stock transaction
          await supabase.from('stock_transactions').delete().eq('id', stockTransaction.id)
          return NextResponse.json(
            { error: 'Failed to create stock transaction items' },
            { status: 500 }
          )
        }

        // Get current stock from item_warehouse (source of truth)
        const { data: warehouseStock } = await supabase
          .from('item_warehouse')
          .select('current_stock, default_location_id')
          .eq('item_id', item.item_id)
          .eq('warehouse_id', invoice.warehouse_id)
          .single()

        const currentBalance = warehouseStock
          ? parseFloat(String(warehouseStock.current_stock))
          : 0

        const newBalance = currentBalance - parseFloat(String(item.quantity))

        const postingDate = invoice.invoice_date
        const postingTime = new Date().toTimeString().split(' ')[0]

        // Update stock_transaction_items with before/after quantities
        const { error: updateTxItemError } = await supabase
          .from('stock_transaction_items')
          .update({
            qty_before: currentBalance,
            qty_after: newBalance,
            valuation_rate: parseFloat(item.rate),
            stock_value_before: currentBalance * parseFloat(item.rate),
            stock_value_after: newBalance * parseFloat(item.rate),
            posting_date: postingDate,
            posting_time: postingTime,
          })
          .eq('id', stockTxItem.id)

        if (updateTxItemError) {

          // Rollback
          await supabase.from('stock_transaction_items').delete().eq('id', stockTxItem.id)
          await supabase.from('stock_transactions').delete().eq('id', stockTransaction.id)
          return NextResponse.json(
            { error: 'Failed to update stock transaction items' },
            { status: 500 }
          )
        }

        await adjustItemLocation({
          supabase,
          companyId: userData.company_id,
          itemId: item.item_id,
          warehouseId: invoice.warehouse_id,
          locationId: defaultLocationId || warehouseStock?.default_location_id || null,
          userId: user.id,
          qtyOnHandDelta: -parseFloat(String(item.quantity)),
        })

        // Update item_warehouse current_stock
        const { error: updateWarehouseError } = await supabase
          .from('item_warehouse')
          .update({
            current_stock: newBalance,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          })
          .eq('item_id', item.item_id)
          .eq('warehouse_id', invoice.warehouse_id)

        if (updateWarehouseError) {

          // Rollback
          await supabase.from('stock_transaction_items').delete().eq('id', stockTxItem.id)
          await supabase.from('stock_transactions').delete().eq('id', stockTransaction.id)
          return NextResponse.json(
            { error: 'Failed to update warehouse inventory' },
            { status: 500 }
          )
        }
       }

    // Stock has already been updated in item_warehouse above, no additional processing needed

    // Calculate commission for the invoice
    try {
      const commissionResult = await calculateInvoiceCommission(
        invoice.id,
        employeeId || undefined
      );

      if (!commissionResult.success) {

      }
    } catch {

      // Don't fail payment if commission calculation fails
    }

    // Update sales order status to 'delivered'
    await supabase
      .from('sales_orders')
      .update({
        status: 'invoiced',
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', salesOrder.id);

    // ========================================================================
    // STEP 4: Post to General Ledger (AR)
    // ========================================================================

    // Post AR Invoice (DR AR, CR Revenue)
    const arInvoiceResult = await postARInvoice(userData.company_id, user.id, {
      invoiceId: invoice.id,
      invoiceCode: invoiceNumber,
      customerId: body.customerId,
      invoiceDate: today,
      totalAmount: totalAmount,
      description: `Van sales invoice ${invoiceNumber}`,
    });

    if (!arInvoiceResult.success) {

    }

    // Post AR Payments (DR Cash, CR AR) - for each payment
    for (const payment of paymentRecords) {
      const arPaymentResult = await postARPayment(userData.company_id, user.id, {
        paymentId: payment.id,
        invoiceId: invoice.id,
        invoiceCode: invoiceNumber,
        customerId: body.customerId,
        paymentDate: today,
        paymentAmount: parseFloat(payment.amount),
        paymentMethod: payment.payment_method,
        description: `Van sales payment for ${invoiceNumber} via ${payment.payment_method}`,
      });

      if (!arPaymentResult.success) {

      }
    }

    // Calculate and post COGS to general ledger
    const cogsCalculation = await calculateCOGS(
      userData.company_id,
      body.warehouseId,
      body.lineItems.map((item) => ({
        itemId: item.itemId,
        quantity: item.quantity,
      }))
    );

    let cogsResult: { success: boolean; journalEntryId?: string; error?: string } = {
      success: true,
      journalEntryId: undefined
    };

    if (cogsCalculation.success && cogsCalculation.items && cogsCalculation.totalCOGS) {
      cogsResult = await postCOGS(userData.company_id, user.id, {
        invoiceId: invoice.id,
        invoiceCode: invoiceNumber,
        warehouseId: body.warehouseId,
        invoiceDate: today,
        items: cogsCalculation.items,
        totalCOGS: cogsCalculation.totalCOGS,
        description: `COGS for van sales invoice ${invoiceNumber}`,
      });

      if (!cogsResult.success && cogsResult.error) {

      }
    } else {

    }

    // ========================================================================
    // Return Success Response
    // ========================================================================

    return NextResponse.json({
      success: true,
      data: {
        orderNumber: salesOrder.order_code,
        invoiceNumber: invoice.invoice_code,
        paymentCodes: paymentCodes,
        payments: paymentRecords.map(p => ({
          paymentCode: p.payment_code,
          method: p.payment_method,
          amount: parseFloat(p.amount),
        })),
        totalAmount: parseFloat(totalAmount.toFixed(2)),
        orderId: salesOrder.id,
        invoiceId: invoice.id,
        paymentIds: paymentRecords.map(p => p.id),
      },
    }, { status: 201 });

  } catch {

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
