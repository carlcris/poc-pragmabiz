import { createServerClientWithBU } from '@/lib/supabase/server-with-bu';
import { NextRequest, NextResponse } from 'next/server';
import { updateTransformationOrderSchema } from '@/lib/validations/transformation-order';
import { requirePermission } from '@/lib/auth';
import { RESOURCES } from '@/constants/resources';

// GET /api/transformations/orders/[id] - Get order by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_TRANSFORMATIONS, 'view');
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();
    const { id } = await params;

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's company
    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'User company not found' }, { status: 400 });
    }

    // Fetch order with all details
    const { data: order, error } = await supabase
      .from('transformation_orders')
      .select(
        `
        *,
        template:transformation_templates(id, template_code, template_name),
        source_warehouse:warehouses!transformation_orders_source_warehouse_id_fkey(id, warehouse_code, warehouse_name),
        inputs:transformation_order_inputs(
          *,
          items(id, item_code, item_name),
          warehouse:warehouses(id, warehouse_code, warehouse_name),
          uom:units_of_measure(id, code, name)
        ),
        outputs:transformation_order_outputs(
          *,
          items(id, item_code, item_name),
          warehouse:warehouses(id, warehouse_code, warehouse_name),
          uom:units_of_measure(id, code, name)
        )
      `
      )
      .eq('id', id)
      .eq('company_id', userData.company_id)
      .is('deleted_at', null)
      .single();

    if (error || !order) {

      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({ data: order });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/transformations/orders/[id] - Update order (DRAFT only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_TRANSFORMATIONS, 'edit');
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();
    const { id } = await params;

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's company
    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'User company not found' }, { status: 400 });
    }

    // Check if order exists and is in DRAFT status
    const { data: existingOrder } = await supabase
      .from('transformation_orders')
      .select('id, status')
      .eq('id', id)
      .eq('company_id', userData.company_id)
      .is('deleted_at', null)
      .single();

    if (!existingOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (existingOrder.status !== 'DRAFT') {
      return NextResponse.json(
        { error: `Cannot update order in ${existingOrder.status} status. Only DRAFT orders can be updated.` },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = updateTransformationOrderSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Build update object
    const updateData: any = {
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    if (data.plannedQuantity !== undefined) {
      updateData.planned_quantity = data.plannedQuantity;
    }
    if (data.plannedDate !== undefined) {
      updateData.planned_date = data.plannedDate;
    }
    if (data.notes !== undefined) {
      updateData.notes = data.notes;
    }

    // Update order
    const { data: updatedOrder, error: updateError } = await supabase
      .from('transformation_orders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {

      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ data: updatedOrder });
  } catch (error) {

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/transformations/orders/[id] - Soft delete order (DRAFT only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_TRANSFORMATIONS, 'delete');
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();
    const { id } = await params;

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's company
    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'User company not found' }, { status: 400 });
    }

    // Check if order exists and is in DRAFT status
    const { data: order } = await supabase
      .from('transformation_orders')
      .select('id, status, order_code')
      .eq('id', id)
      .eq('company_id', userData.company_id)
      .is('deleted_at', null)
      .single();

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.status !== 'DRAFT') {
      return NextResponse.json(
        { error: `Cannot delete order ${order.order_code} in ${order.status} status. Only DRAFT orders can be deleted.` },
        { status: 400 }
      );
    }

    // Soft delete order
    const { error: deleteError } = await supabase
      .from('transformation_orders')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('id', id);

    if (deleteError) {

      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Order deleted successfully' });
  } catch (error) {

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
