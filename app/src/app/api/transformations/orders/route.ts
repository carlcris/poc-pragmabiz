import { createServerClientWithBU } from '@/lib/supabase/server-with-bu';
import { NextRequest, NextResponse } from 'next/server';
import { createTransformationOrderSchema } from '@/lib/validations/transformation-order';
import { validateTemplate } from '@/services/inventory/transformationService';
import { requirePermission } from '@/lib/auth';
import { RESOURCES } from '@/constants/resources';

type TemplateInputRow = {
  item_id: string
  quantity: number | string
  uom_id: string
  sequence?: number | null
  notes?: string | null
}

type TemplateOutputRow = {
  item_id: string
  quantity: number | string
  uom_id: string
  is_scrap: boolean
  sequence?: number | null
  notes?: string | null
}

type TemplateWithLines = {
  inputs: TemplateInputRow[]
  outputs: TemplateOutputRow[]
}

type ItemCostRow = {
  id: string
  cost_price: number | string | null
}

// GET /api/transformations/orders - List transformation orders
export async function GET(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_TRANSFORMATIONS, 'view');
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();
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

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data: orders || [],
      total: count || 0,
      page,
      limit,
    });
  } catch {

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/transformations/orders - Create transformation order from template
export async function POST(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_TRANSFORMATIONS, 'create');
    if (unauthorized) return unauthorized;

    const { supabase, currentBusinessUnitId } = await createServerClientWithBU();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!currentBusinessUnitId) {
      return NextResponse.json(
        { error: 'Business unit context required' },
        { status: 400 }
      )
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

    const dataToValidate = {
      ...body,
      companyId: userData.company_id,
    };

    const validationResult = createTransformationOrderSchema.safeParse(dataToValidate);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.errors },
        { status: 400 }
      );
    }

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
        business_unit_id: currentBusinessUnitId,
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

      return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
    }

    // Get item costs for inputs
    const typedTemplate = template as TemplateWithLines
    const inputItemIds = typedTemplate.inputs.map((input) => input.item_id)

    const { data: inputItems, error: itemsError } = await supabase
      .from('items')
      .select('id, cost_price')
      .in('id', inputItemIds);

    if (itemsError) {

    }

    const itemCostMap = new Map(
      ((inputItems || []) as ItemCostRow[]).map((item) => [
        item.id,
        parseFloat(String(item.cost_price ?? 0)),
      ])
    )

    // Create order inputs from template
    const inputsData = typedTemplate.inputs.map((input, index) => {
      const unitCost = itemCostMap.get(input.item_id) || 0;
      const plannedQty = Number(input.quantity) * data.plannedQuantity;
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

      return NextResponse.json({ error: 'Failed to create order inputs' }, { status: 500 });
    }

    // Calculate total input cost
    const totalInputCost = inputsData.reduce((sum, input) => sum + input.total_cost, 0);

    // Create order outputs from template
    // Allocate input costs to outputs proportionally
    const totalOutputQty = typedTemplate.outputs.reduce(
      (sum, output) =>
        sum + (output.is_scrap ? 0 : Number(output.quantity) * data.plannedQuantity),
      0
    )

    const outputsData = typedTemplate.outputs.map((output, index) => {
      const plannedQty = Number(output.quantity) * data.plannedQuantity;
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

      return NextResponse.json({ error: 'Failed to create order outputs' }, { status: 500 });
    }

    // Calculate total output cost
    const totalOutputCost = outputsData.reduce((sum, output) => sum + output.total_allocated_cost, 0);

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
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
