import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createTransformationOrderSchema } from '@/lib/validations/transformation-order';
import { validateTemplate } from '@/services/inventory/transformationService';

// GET /api/transformations/orders - List transformation orders
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;

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

    // Parse query parameters
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const templateId = searchParams.get('templateId') || '';
    const warehouseId = searchParams.get('warehouseId') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from('transformation_orders')
      .select(
        `
        id,
        company_id,
        order_code,
        template_id,
        source_warehouse_id,
        status,
        planned_quantity,
        actual_quantity,
        total_input_cost,
        total_output_cost,
        cost_variance,
        order_date,
        planned_date,
        execution_date,
        completion_date,
        notes,
        created_by,
        created_at,
        updated_by,
        updated_at,
        template:transformation_templates(template_code, template_name),
        source_warehouse:warehouses!transformation_orders_source_warehouse_id_fkey(warehouse_code, warehouse_name)
      `,
        { count: 'exact' }
      )
      .eq('company_id', userData.company_id)
      .is('deleted_at', null)
      .order('order_date', { ascending: false })
      .order('created_at', { ascending: false });

    // Apply filters
    if (search) {
      query = query.or(`order_code.ilike.%${search}%,notes.ilike.%${search}%`);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (templateId) {
      query = query.eq('template_id', templateId);
    }
    if (warehouseId) {
      query = query.eq('source_warehouse_id', warehouseId);
    }
    if (dateFrom) {
      query = query.gte('order_date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('order_date', dateTo);
    }

    // Execute query
    const { data: orders, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching transformation orders:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data: orders || [],
      total: count || 0,
      page,
      limit,
    });
  } catch (error) {
    console.error('Error in GET /api/transformations/orders:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/transformations/orders - Create transformation order from template
export async function POST(request: NextRequest) {
  console.log('=== POST /api/transformations/orders called ===');
  try {
    const supabase = await createClient();

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

    // Parse and validate request body
    const body = await request.json();
    console.log('Received body:', JSON.stringify(body, null, 2));

    const dataToValidate = {
      ...body,
      companyId: userData.company_id,
    };
    console.log('Data to validate:', JSON.stringify(dataToValidate, null, 2));

    const validationResult = createTransformationOrderSchema.safeParse(dataToValidate);

    console.log('Validation result success:', validationResult.success);
    if (!validationResult.success) {
      console.error('Validation errors:', JSON.stringify(validationResult.error, null, 2));
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    console.log('Validation passed successfully!');

    const data = validationResult.data;

    // Validate template
    const templateValidation = await validateTemplate(data.templateId);
    if (!templateValidation.isValid) {
      return NextResponse.json(
        { error: templateValidation.error || 'Invalid template' },
        { status: 400 }
      );
    }

    // Get template details
    const { data: template, error: templateError } = await supabase
      .from('transformation_templates')
      .select(
        `
        *,
        inputs:transformation_template_inputs(*),
        outputs:transformation_template_outputs(*)
      `
      )
      .eq('id', data.templateId)
      .single();

    if (templateError || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Generate order code
    const orderDate = new Date();
    const dateStr = orderDate.toISOString().split('T')[0].replace(/-/g, '');
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    const orderCode = `TRN-${dateStr}-${randomStr}`;

    // Create order header
    const { data: order, error: orderError } = await supabase
      .from('transformation_orders')
      .insert({
        company_id: userData.company_id,
        order_code: orderCode,
        template_id: data.templateId,
        source_warehouse_id: data.warehouseId,
        status: 'DRAFT',
        planned_quantity: data.plannedQuantity,
        order_date: data.orderDate || new Date().toISOString().split('T')[0],
        planned_date: data.plannedDate,
        notes: data.notes,
        reference_type: data.referenceType,
        reference_id: data.referenceId,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (orderError || !order) {
      console.error('Error creating order:', orderError);
      return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
    }

    // Get item costs for inputs
    const inputItemIds = template.inputs.map((input: any) => input.item_id);
    console.log('Input item IDs:', inputItemIds);

    const { data: inputItems, error: itemsError } = await supabase
      .from('items')
      .select('id, cost_price')
      .in('id', inputItemIds);

    if (itemsError) {
      console.error('Error fetching item costs:', itemsError);
    }
    console.log('Input items with costs:', JSON.stringify(inputItems, null, 2));

    const itemCostMap = new Map(inputItems?.map((item: any) => [item.id, parseFloat(item.cost_price || '0')]) || []);

    // Create order inputs from template
    const inputsData = template.inputs.map((input: any, index: number) => {
      const unitCost = itemCostMap.get(input.item_id) || 0;
      const plannedQty = input.quantity * data.plannedQuantity;
      return {
        order_id: order.id,
        item_id: input.item_id,
        warehouse_id: data.warehouseId,
        planned_quantity: plannedQty,
        uom_id: input.uom_id,
        unit_cost: unitCost,
        total_cost: unitCost * plannedQty,
        sequence: input.sequence || index + 1,
        notes: input.notes,
        created_by: user.id,
        updated_by: user.id,
      };
    });

    const { error: inputsError } = await supabase
      .from('transformation_order_inputs')
      .insert(inputsData);

    if (inputsError) {
      // Rollback: delete order
      await supabase.from('transformation_orders').delete().eq('id', order.id);
      console.error('Error creating order inputs:', inputsError);
      return NextResponse.json({ error: 'Failed to create order inputs' }, { status: 500 });
    }

    // Calculate total input cost
    const totalInputCost = inputsData.reduce((sum, input) => sum + input.total_cost, 0);
    console.log('Inputs data:', JSON.stringify(inputsData, null, 2));
    console.log('Total input cost:', totalInputCost);

    // Create order outputs from template
    // Allocate input costs to outputs proportionally
    const totalOutputQty = template.outputs.reduce((sum: number, output: any) =>
      sum + (output.is_scrap ? 0 : output.quantity * data.plannedQuantity), 0
    );

    const outputsData = template.outputs.map((output: any, index: number) => {
      const plannedQty = output.quantity * data.plannedQuantity;
      // Only non-scrap items get cost allocation
      const allocatedCostPerUnit = output.is_scrap || totalOutputQty === 0
        ? 0
        : totalInputCost / totalOutputQty;

      return {
        order_id: order.id,
        item_id: output.item_id,
        warehouse_id: data.warehouseId,
        planned_quantity: plannedQty,
        uom_id: output.uom_id,
        is_scrap: output.is_scrap,
        allocated_cost_per_unit: allocatedCostPerUnit,
        total_allocated_cost: allocatedCostPerUnit * plannedQty,
        sequence: output.sequence || index + 1,
        notes: output.notes,
        created_by: user.id,
        updated_by: user.id,
      };
    });

    const { error: outputsError } = await supabase
      .from('transformation_order_outputs')
      .insert(outputsData);

    if (outputsError) {
      // Rollback: delete order and inputs
      await supabase.from('transformation_order_inputs').delete().eq('order_id', order.id);
      await supabase.from('transformation_orders').delete().eq('id', order.id);
      console.error('Error creating order outputs:', outputsError);
      return NextResponse.json({ error: 'Failed to create order outputs' }, { status: 500 });
    }

    // Calculate total output cost
    const totalOutputCost = outputsData.reduce((sum, output) => sum + output.total_allocated_cost, 0);
    console.log('Total output cost:', totalOutputCost);

    // Update order with calculated costs
    const { error: updateError } = await supabase
      .from('transformation_orders')
      .update({
        total_input_cost: totalInputCost,
        total_output_cost: totalOutputCost,
        cost_variance: totalOutputCost - totalInputCost,
      })
      .eq('id', order.id);

    if (updateError) {
      console.error('Error updating order costs:', updateError);
    } else {
      console.log('Order costs updated successfully:', {
        totalInputCost,
        totalOutputCost,
        costVariance: totalOutputCost - totalInputCost,
      });
    }

    // Fetch complete order with inputs/outputs
    const { data: completeOrder } = await supabase
      .from('transformation_orders')
      .select(
        `
        *,
        inputs:transformation_order_inputs(*),
        outputs:transformation_order_outputs(*)
      `
      )
      .eq('id', order.id)
      .single();

    return NextResponse.json({ data: completeOrder }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/transformations/orders:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
