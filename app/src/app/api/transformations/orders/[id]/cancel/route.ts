import { createServerClientWithBU } from '@/lib/supabase/server-with-bu';
import { NextRequest, NextResponse } from 'next/server';
import { validateStateTransition } from '@/services/inventory/transformationService';
import { requirePermission } from '@/lib/auth';
import { RESOURCES } from '@/constants/resources';

// POST /api/transformations/orders/[id]/cancel - Cancel order (DRAFT or PREPARING → CANCELLED)
export async function POST(
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

    // Validate state transition (must be in DRAFT or PREPARING status)
    const transitionValidation = await validateStateTransition(id, 'CANCELLED');
    if (!transitionValidation.isValid) {
      return NextResponse.json(
        { error: transitionValidation.error || 'Invalid state transition' },
        { status: 400 }
      );
    }

    // Update order status to CANCELLED
    const { data: order, error: updateError } = await supabase
      .from('transformation_orders')
      .update({
        status: 'CANCELLED',
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('company_id', userData.company_id)
      .select()
      .single();

    if (updateError || !order) {

      return NextResponse.json(
        { error: updateError?.message || 'Failed to cancel order' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: order,
      message: 'Order cancelled successfully',
    });
  } catch (error) {

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
