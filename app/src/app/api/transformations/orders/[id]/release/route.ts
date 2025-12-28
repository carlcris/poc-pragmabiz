import { createServerClientWithBU } from '@/lib/supabase/server-with-bu';
import { NextRequest, NextResponse } from 'next/server';
import {
  validateTemplate,
  validateStockAvailability,
  validateStateTransition,
} from '@/services/inventory/transformationService';

// POST /api/transformations/orders/[id]/release - Release order (DRAFT → PREPARING)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    // Get order details
    const { data: order } = await supabase
      .from('transformation_orders')
      .select('id, status, template_id, order_code')
      .eq('id', id)
      .eq('company_id', userData.company_id)
      .is('deleted_at', null)
      .single();

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Validate state transition
    const transitionValidation = await validateStateTransition(id, 'PREPARING');
    if (!transitionValidation.isValid) {
      return NextResponse.json(
        { error: transitionValidation.error || 'Invalid state transition' },
        { status: 400 }
      );
    }

    // Validate template is still active
    const templateValidation = await validateTemplate(order.template_id);
    if (!templateValidation.isValid) {
      return NextResponse.json(
        { error: `Template validation failed: ${templateValidation.error}` },
        { status: 400 }
      );
    }

    // Validate stock availability
    const stockValidation = await validateStockAvailability(id);
    if (!stockValidation.isAvailable) {
      return NextResponse.json(
        {
          error: stockValidation.error || 'Insufficient stock',
          insufficientItems: stockValidation.insufficientItems,
        },
        { status: 400 }
      );
    }

    // Update order status to PREPARING
    const { data: updatedOrder, error: updateError } = await supabase
      .from('transformation_orders')
      .update({
        status: 'PREPARING',
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error preparing order:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      data: updatedOrder,
      message: `Order ${order.order_code} is now being prepared`,
    });
  } catch (error) {
    console.error('Error in POST /api/transformations/orders/[id]/release:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
