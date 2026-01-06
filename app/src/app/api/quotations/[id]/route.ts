import { createServerClientWithBU } from '@/lib/supabase/server-with-bu'
import { NextRequest, NextResponse } from 'next/server'
import type { Quotation, QuotationLineItem, UpdateQuotationRequest } from '@/types/quotation'
import type { Database } from '@/types/database.types'
import { requirePermission } from '@/lib/auth'
import { RESOURCES } from '@/constants/resources'
import { normalizeTransactionItems } from '@/services/inventory/normalizationService'
import type { StockTransactionItemInput } from '@/types/inventory-normalization'

type DbQuotation = Database['public']['Tables']['sales_quotations']['Row']
type DbQuotationItem = Database['public']['Tables']['sales_quotation_items']['Row']
type DbCustomer = Database['public']['Tables']['customers']['Row']
type DbItem = Database['public']['Tables']['items']['Row']
type DbUser = Database['public']['Tables']['users']['Row']
type DbUoM = Database['public']['Tables']['units_of_measure']['Row']
type DbPackaging = Database['public']['Tables']['item_packaging']['Row']

// Transform database quotation to frontend type
function transformDbQuotation(
  dbQuotation: DbQuotation & {
    customers?: DbCustomer | null
    users?: DbUser | null
  },
  items?: QuotationLineItem[]
): Quotation {
  return {
    id: dbQuotation.id,
    companyId: dbQuotation.company_id,
    quotationNumber: dbQuotation.quotation_code,
    customerId: dbQuotation.customer_id,
    customerName: dbQuotation.customers?.customer_name,
    customerEmail: dbQuotation.customers?.email,
    quotationDate: dbQuotation.quotation_date,
    validUntil: dbQuotation.valid_until || '',
    status: dbQuotation.status as Quotation['status'],
    salesOrderId: dbQuotation.sales_order_id || undefined,
    lineItems: items || [],
    subtotal: Number(dbQuotation.subtotal) || 0,
    totalDiscount: Number(dbQuotation.discount_amount) || 0,
    totalTax: Number(dbQuotation.tax_amount) || 0,
    totalAmount: Number(dbQuotation.total_amount) || 0,
    terms: dbQuotation.terms_conditions || '',
    notes: dbQuotation.notes || '',
    createdBy: dbQuotation.created_by || '',
    createdByName: dbQuotation.users ? `${dbQuotation.users.first_name || ''} ${dbQuotation.users.last_name || ''}`.trim() : undefined,
    createdAt: dbQuotation.created_at,
    updatedAt: dbQuotation.updated_at,
  }
}

// Transform database quotation item to frontend type
function transformDbQuotationItem(
  dbItem: DbQuotationItem & {
    items?: DbItem | null
    units_of_measure?: DbUoM | null
    item_packaging?: DbPackaging | null
  }
): QuotationLineItem {
  return {
    id: dbItem.id,
    itemId: dbItem.item_id,
    itemCode: dbItem.items?.item_code,
    itemName: dbItem.items?.item_name,
    description: dbItem.item_description || '',
    quantity: Number(dbItem.quantity),
    packagingId: dbItem.packaging_id,
    packagingName: dbItem.item_packaging?.pack_name,
    uomId: dbItem.uom_id,
    unitPrice: Number(dbItem.rate),
    discount: Number(dbItem.discount_percent) || 0,
    discountAmount: Number(dbItem.discount_amount) || 0,
    taxRate: Number(dbItem.tax_percent) || 0,
    taxAmount: Number(dbItem.tax_amount) || 0,
    lineTotal: Number(dbItem.line_total),
    sortOrder: dbItem.sort_order || 0,
  }
}

// GET /api/quotations/[id] - Get single quotation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(RESOURCES.SALES_QUOTATIONS, 'view')

    const { id } = await params
    const { supabase } = await createServerClientWithBU()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch quotation with joins
    const { data: quotation, error } = await supabase
      .from('sales_quotations')
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
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error) {

      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!quotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })
    }

    // Fetch quotation items
    const { data: items, error: itemsError } = await supabase
      .from('sales_quotation_items')
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
      .eq('quotation_id', id)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })

    if (itemsError) {

      return NextResponse.json({ error: itemsError.message }, { status: 500 })
    }

    const transformedItems = items?.map(item => transformDbQuotationItem(item as any)) || []
    const result = transformDbQuotation(quotation as any, transformedItems)

    return NextResponse.json(result)
  } catch (error) {

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/quotations/[id] - Update quotation
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(RESOURCES.SALES_QUOTATIONS, 'edit')

    const { id } = await params
    const { supabase } = await createServerClientWithBU()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's company_id from users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body: UpdateQuotationRequest = await request.json()

    // Fetch existing quotation to check status
    const { data: existingQuotation, error: fetchError } = await supabase
      .from('sales_quotations')
      .select('status, company_id')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (fetchError || !existingQuotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })
    }

    // Business rule: Only drafts can be edited
    if (existingQuotation.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft quotations can be edited' },
        { status: 400 }
      )
    }

    // Build update object for header
    const headerUpdate: any = {
      updated_by: user.id,
    }

    if (body.quotationDate) headerUpdate.quotation_date = body.quotationDate
    if (body.validUntil !== undefined) headerUpdate.valid_until = body.validUntil
    if (body.status) headerUpdate.status = body.status
    if (body.notes !== undefined) headerUpdate.notes = body.notes
    if (body.termsConditions !== undefined) headerUpdate.terms_conditions = body.termsConditions

    // If items are being updated, recalculate totals
    if (body.items && body.items.length > 0) {
      let subtotal = 0
      let totalDiscount = 0
      let totalTax = 0

      const itemInputs: StockTransactionItemInput[] = body.items.map((item: any) => ({
        itemId: item.itemId,
        packagingId: item.packagingId ?? null,
        inputQty: parseFloat(item.quantity),
        unitCost: parseFloat(item.rate),
      }))

      const normalizedItems = await normalizeTransactionItems(existingQuotation.company_id, itemInputs)

      const itemsWithCalculations = body.items.map((item, index) => {
        const normalizedQty = normalizedItems[index]?.normalizedQty ?? item.quantity
        const itemSubtotal = normalizedQty * item.rate
        const discountAmount = item.discountAmount || (itemSubtotal * (item.discountPercent || 0) / 100)
        const taxableAmount = itemSubtotal - discountAmount
        const taxAmount = item.taxAmount || (taxableAmount * (item.taxPercent || 0) / 100)
        const lineTotal = taxableAmount + taxAmount

        subtotal += itemSubtotal
        totalDiscount += discountAmount
        totalTax += taxAmount

        return {
          ...item,
          discountAmount,
          taxAmount,
          lineTotal,
        }
      })

      const totalAmount = subtotal - totalDiscount + totalTax

      headerUpdate.subtotal = subtotal.toFixed(4)
      headerUpdate.discount_amount = totalDiscount.toFixed(4)
      headerUpdate.tax_amount = totalTax.toFixed(4)
      headerUpdate.total_amount = totalAmount.toFixed(4)

      // Update header
      const { error: updateError } = await supabase
        .from('sales_quotations')
        .update(headerUpdate)
        .eq('id', id)

      if (updateError) {

        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      // Delete existing items (soft delete)
      const { error: deleteError } = await supabase
        .from('sales_quotation_items')
        .update({ deleted_at: new Date().toISOString() })
        .eq('quotation_id', id)

      if (deleteError) {

        return NextResponse.json({ error: deleteError.message }, { status: 500 })
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
      }))

      const { error: insertError } = await supabase
        .from('sales_quotation_items')
        .insert(itemsToInsert)

      if (insertError) {

        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }
    } else {
      // Update header only (no items changed)
      const { error: updateError } = await supabase
        .from('sales_quotations')
        .update(headerUpdate)
        .eq('id', id)

      if (updateError) {

        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }
    }

    // Fetch the updated quotation with joins
    const { data: updatedQuotation } = await supabase
      .from('sales_quotations')
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
      .eq('id', id)
      .single()

    const { data: quotationItems } = await supabase
      .from('sales_quotation_items')
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
      .eq('quotation_id', id)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })

    const items = quotationItems?.map(item => transformDbQuotationItem(item as any)) || []
    const result = transformDbQuotation(updatedQuotation as any, items)

    return NextResponse.json(result)
  } catch (error) {

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/quotations/[id] - Soft delete quotation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(RESOURCES.SALES_QUOTATIONS, 'delete')

    const { id } = await params
    const { supabase } = await createServerClientWithBU()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch existing quotation to check status
    const { data: existingQuotation, error: fetchError } = await supabase
      .from('sales_quotations')
      .select('status')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (fetchError || !existingQuotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })
    }

    // Business rule: Only drafts can be deleted
    if (existingQuotation.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft quotations can be deleted' },
        { status: 400 }
      )
    }

    // Soft delete the quotation
    const { error: deleteError } = await supabase
      .from('sales_quotations')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('id', id)

    if (deleteError) {

      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    // Soft delete associated items
    const { error: itemsDeleteError } = await supabase
      .from('sales_quotation_items')
      .update({ deleted_at: new Date().toISOString() })
      .eq('quotation_id', id)

    if (itemsDeleteError) {

      return NextResponse.json({ error: itemsDeleteError.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Quotation deleted successfully' })
  } catch (error) {

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
