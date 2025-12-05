import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { postARInvoice, postARPayment } from '@/services/accounting/arPosting';
import { calculateCOGS, postCOGS } from '@/services/accounting/cogsPosting';
import { calculateInvoiceCommission } from '@/services/commission/commissionService';

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
  paymentMethod: 'cash' | 'check' | 'credit_card' | 'bank_transfer' | 'other';
  paymentReference?: string;
  notes?: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    // Validate stock availability for all items
    const itemIds = body.lineItems.map(item => item.itemId);
    const { data: stockData, error: stockError } = await supabase
      .from('item_warehouse')
      .select('item_id, current_stock')
      .eq('warehouse_id', body.warehouseId)
      .in('item_id', itemIds);

    if (stockError) {
      console.error('Error checking stock availability:', stockError);
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

    // Create sales order
    const { data: salesOrder, error: orderError } = await supabase
      .from('sales_orders')
      .insert({
        company_id: userData.company_id,
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
      console.error('Error creating sales order:', orderError);
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
      console.error('Error creating sales order items:', orderItemsError);
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
      console.error('Error creating invoice:', invoiceError);
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
      console.error('Error creating invoice items:', invoiceItemsError);
      return NextResponse.json({ error: 'Failed to create invoice items' }, { status: 500 });
    }

    // ========================================================================
    // STEP 3: Record Full Payment
    // ========================================================================

    // Generate payment code
    const { data: lastPayment } = await supabase
      .from('invoice_payments')
      .select('payment_code')
      .eq('company_id', userData.company_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let paymentCode = 'PAY-00001';
    if (lastPayment?.payment_code) {
      const lastNumber = parseInt(lastPayment.payment_code.split('-')[1] || '0');
      paymentCode = `PAY-${String(lastNumber + 1).padStart(5, '0')}`;
    }

    // Create payment record
    const { data: payment, error: paymentError } = await supabase
      .from('invoice_payments')
      .insert({
        company_id: userData.company_id,
        invoice_id: invoice.id,
        payment_code: paymentCode,
        payment_date: today,
        amount: totalAmount.toFixed(4),
        payment_method: body.paymentMethod,
        reference: body.paymentReference || `Van Sales - ${invoiceNumber}`,
        notes: body.notes || 'Van sales payment',
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (paymentError || !payment) {
      console.error('Error creating payment:', paymentError);
      return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 });
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
      console.error('Error updating invoice status:', updateInvoiceError);
      return NextResponse.json({ error: 'Failed to update invoice status' }, { status: 500 });
    }

    // Calculate commission for the invoice
    try {
      const commissionResult = await calculateInvoiceCommission(
        invoice.id,
        employeeId || undefined
      );

      if (!commissionResult.success) {
        console.warn(
          `Invoice ${invoice.invoice_code} paid but commission calculation failed: ${commissionResult.error}`
        );
      }
    } catch (commissionError) {
      console.error('Error calculating commission:', commissionError);
      // Don't fail payment if commission calculation fails
    }

    // Update sales order status to 'delivered'
    await supabase
      .from('sales_orders')
      .update({
        status: 'delivered',
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
      console.error('Error posting AR invoice to GL:', arInvoiceResult.error);
      console.warn(
        `Van sale invoice ${invoiceNumber} completed but AR GL posting failed: ${arInvoiceResult.error}`
      );
    }

    // Post AR Payment (DR Cash, CR AR)
    const arPaymentResult = await postARPayment(userData.company_id, user.id, {
      paymentId: payment.id,
      invoiceId: invoice.id,
      invoiceCode: invoiceNumber,
      customerId: body.customerId,
      paymentDate: today,
      paymentAmount: totalAmount,
      paymentMethod: body.paymentMethod,
      description: `Van sales payment for ${invoiceNumber}`,
    });

    if (!arPaymentResult.success) {
      console.error('Error posting AR payment to GL:', arPaymentResult.error);
      console.warn(
        `Van sale payment for ${invoiceNumber} completed but AR payment GL posting failed: ${arPaymentResult.error}`
      );
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
        console.error('Error posting COGS to GL:', cogsResult.error);
        console.warn(
          `Van sale ${invoiceNumber} completed but COGS GL posting failed: ${cogsResult.error}`
        );
      }
    } else {
      console.error('Error calculating COGS:', cogsCalculation.error);
      console.warn(
        `Van sale ${invoiceNumber} completed but COGS calculation failed: ${cogsCalculation.error}`
      );
    }

    // ========================================================================
    // Return Success Response
    // ========================================================================

    return NextResponse.json({
      success: true,
      data: {
        orderNumber: salesOrder.order_code,
        invoiceNumber: invoice.invoice_code,
        paymentCode: payment.payment_code,
        totalAmount: parseFloat(totalAmount.toFixed(2)),
        orderId: salesOrder.id,
        invoiceId: invoice.id,
        paymentId: payment.id,
      },
    }, { status: 201 });

  } catch (error) {
    console.error('Unexpected error in van sales payment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
