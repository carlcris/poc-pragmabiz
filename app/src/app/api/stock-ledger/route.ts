import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/stock-ledger
// Returns detailed stock movement history with running balance
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's company
    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'User company not found' }, { status: 400 })
    }

    // Extract query parameters
    const itemId = searchParams.get('itemId')
    const warehouseId = searchParams.get('warehouseId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const voucherType = searchParams.get('voucherType')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('stock_ledger')
      .select(
        `
        id,
        posting_date,
        posting_time,
        voucher_type,
        voucher_no,
        actual_qty,
        qty_after_trans,
        incoming_rate,
        valuation_rate,
        stock_value,
        stock_value_diff,
        item_id,
        warehouse_id,
        transaction_id,
        item:items!inner(
          id,
          item_code,
          item_name,
          uom:units_of_measure(id, code, name)
        ),
        warehouse:warehouses!inner(
          id,
          warehouse_code,
          warehouse_name
        ),
        transaction:stock_transactions(
          id,
          transaction_code,
          transaction_type,
          reference_type,
          reference_id,
          notes
        )
      `,
        { count: 'exact' }
      )
      .eq('company_id', userData.company_id)

    // Apply filters
    if (itemId) {
      query = query.eq('item_id', itemId)
    }

    if (warehouseId) {
      query = query.eq('warehouse_id', warehouseId)
    }

    if (startDate) {
      query = query.gte('posting_date', startDate)
    }

    if (endDate) {
      query = query.lte('posting_date', endDate)
    }

    if (voucherType) {
      query = query.eq('voucher_type', voucherType)
    }

    // Get total count first
    const { count } = await query

    // Apply ordering and pagination
    query = query
      .order('posting_date', { ascending: false })
      .order('posting_time', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: ledgerEntries, error } = await query

    if (error) {
      console.error('Error fetching stock ledger:', error)
      return NextResponse.json({ error: 'Failed to fetch stock ledger' }, { status: 500 })
    }

    // Format response
    const formattedEntries = (ledgerEntries || []).map((entry: any) => ({
      id: entry.id,
      postingDate: entry.posting_date,
      postingTime: entry.posting_time,
      voucherType: entry.voucher_type,
      voucherNo: entry.voucher_no,
      itemId: entry.item_id,
      itemCode: entry.item?.item_code,
      itemName: entry.item?.item_name,
      warehouseId: entry.warehouse_id,
      warehouseCode: entry.warehouse?.warehouse_code,
      warehouseName: entry.warehouse?.warehouse_name,
      actualQty: parseFloat(entry.actual_qty),
      qtyAfterTransaction: parseFloat(entry.qty_after_trans),
      incomingRate: entry.incoming_rate ? parseFloat(entry.incoming_rate) : 0,
      valuationRate: entry.valuation_rate ? parseFloat(entry.valuation_rate) : 0,
      stockValue: entry.stock_value ? parseFloat(entry.stock_value) : 0,
      stockValueDiff: entry.stock_value_diff ? parseFloat(entry.stock_value_diff) : 0,
      uom: entry.item?.uom?.code || '',
      transactionId: entry.transaction_id,
      transactionCode: entry.transaction?.transaction_code,
      transactionType: entry.transaction?.transaction_type,
      referenceType: entry.transaction?.reference_type,
      referenceId: entry.transaction?.reference_id,
      notes: entry.transaction?.notes,
    }))

    // Calculate opening balance if itemId and warehouseId are provided
    let openingBalance = 0
    if (itemId && warehouseId && startDate) {
      const { data: openingEntry } = await supabase
        .from('stock_ledger')
        .select('qty_after_trans')
        .eq('company_id', userData.company_id)
        .eq('item_id', itemId)
        .eq('warehouse_id', warehouseId)
        .lt('posting_date', startDate)
        .order('posting_date', { ascending: false })
        .order('posting_time', { ascending: false })
        .limit(1)

      if (openingEntry && openingEntry.length > 0) {
        openingBalance = parseFloat(openingEntry[0].qty_after_trans)
      }
    }

    return NextResponse.json({
      data: formattedEntries,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
      openingBalance,
    })
  } catch (error) {
    console.error('Unexpected error in GET /api/stock-ledger:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
