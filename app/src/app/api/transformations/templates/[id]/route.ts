import { createServerClientWithBU } from '@/lib/supabase/server-with-bu';
import { NextRequest, NextResponse } from 'next/server';
import { updateTransformationTemplateSchema } from '@/lib/validations/transformation-template';
import { checkTemplateLock } from '@/services/inventory/transformationService';

// GET /api/transformations/templates/[id] - Get template by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { supabase } = await createServerClientWithBU();
    const { id } = params;

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

    // Fetch template with inputs and outputs
    const { data: template, error } = await supabase
      .from('transformation_templates')
      .select(
        `
        *,
        inputs:transformation_template_inputs(
          *,
          items(id, item_code, item_name),
          uom:units_of_measure(id, uom_name)
        ),
        outputs:transformation_template_outputs(
          *,
          items(id, item_code, item_name),
          uom:units_of_measure(id, uom_name)
        )
      `
      )
      .eq('id', id)
      .eq('company_id', userData.company_id)
      .is('deleted_at', null)
      .single();

    if (error || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ data: template });
  } catch (error) {
    console.error('Error in GET /api/transformations/templates/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/transformations/templates/[id] - Update template (limited fields)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { supabase } = await createServerClientWithBU();
    const { id } = params;

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

    // Check if template exists
    const { data: existingTemplate } = await supabase
      .from('transformation_templates')
      .select('id, usage_count')
      .eq('id', id)
      .eq('company_id', userData.company_id)
      .is('deleted_at', null)
      .single();

    if (!existingTemplate) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = updateTransformationTemplateSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Check if template is locked (usage_count > 0)
    // Only allow isActive updates if locked, block name/description changes
    if (existingTemplate.usage_count > 0) {
      if (data.templateName || data.description) {
        return NextResponse.json(
          {
            error: `Template is locked because it is used by ${existingTemplate.usage_count} order(s). Only status changes are allowed.`,
          },
          { status: 400 }
        );
      }
    }

    // Build update object
    const updateData: any = {
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    if (data.templateName !== undefined) {
      updateData.template_name = data.templateName;
    }
    if (data.description !== undefined) {
      updateData.description = data.description;
    }
    if (data.isActive !== undefined) {
      updateData.is_active = data.isActive;
    }

    // Update template
    const { data: updatedTemplate, error: updateError } = await supabase
      .from('transformation_templates')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating template:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ data: updatedTemplate });
  } catch (error) {
    console.error('Error in PATCH /api/transformations/templates/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/transformations/templates/[id] - Soft delete template
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { supabase } = await createServerClientWithBU();
    const { id } = params;

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

    // Check if template exists and is not locked
    const { data: template } = await supabase
      .from('transformation_templates')
      .select('id, usage_count, template_code')
      .eq('id', id)
      .eq('company_id', userData.company_id)
      .is('deleted_at', null)
      .single();

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    if (template.usage_count > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete template ${template.template_code} because it is used by ${template.usage_count} order(s)`,
        },
        { status: 400 }
      );
    }

    // Soft delete template
    const { error: deleteError } = await supabase
      .from('transformation_templates')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting template:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error in DELETE /api/transformations/templates/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
