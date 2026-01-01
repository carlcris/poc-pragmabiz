import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithBU } from '@/lib/supabase/server-with-bu';
import { requirePermission, getAuthenticatedUser } from '@/lib/auth';
import { RESOURCES } from '@/constants/resources';

// GET /api/rbac/permissions - List all permissions
export async function GET(request: NextRequest) {
  try {
    // Require 'permissions' view permission
    const unauthorized = await requirePermission(RESOURCES.PERMISSIONS, 'view');
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');
    const includeRoles = searchParams.get('includeRoles') === 'true';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '100');

    // Build query
    let query = supabase
      .from('permissions')
      .select(
        includeRoles
          ? `
            *,
            role_permissions(
              role_id,
              roles(
                id,
                name,
                company_id
              )
            )
          `
          : '*',
        { count: 'exact' }
      )
      .is('deleted_at', null)
      .order('resource', { ascending: true });

    // Apply search filter
    if (search) {
      query = query.or(`resource.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {

      return NextResponse.json(
        { error: 'Failed to fetch permissions', details: error.message },
        { status: 500 }
      );
    }

    // Transform data if roles are included
    const permissions = includeRoles
      ? (data || []).map((perm: any) => ({
          ...perm,
          roles: perm.role_permissions?.map((rp: any) => rp.roles).filter(Boolean) || []
        }))
      : data || [];

    return NextResponse.json({
      data: permissions,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/rbac/permissions - Create new permission (admin only)
export async function POST(request: NextRequest) {
  try {
    // Require 'permissions' create permission
    const unauthorized = await requirePermission(RESOURCES.PERMISSIONS, 'create');
    if (unauthorized) return unauthorized;

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { supabase } = await createServerClientWithBU();

    // Parse request body
    const body = await request.json();
    const { resource, description, can_view, can_create, can_edit, can_delete } = body;

    // Validate required fields
    if (!resource) {
      return NextResponse.json(
        { error: 'Missing required field', details: 'resource is required' },
        { status: 400 }
      );
    }

    // Check for duplicate resource
    const { data: existing } = await supabase
      .from('permissions')
      .select('id')
      .eq('resource', resource)
      .is('deleted_at', null)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'Permission already exists', details: `Permission for resource "${resource}" already exists` },
        { status: 409 }
      );
    }

    // Create permission
    const { data: newPermission, error: insertError } = await supabase
      .from('permissions')
      .insert({
        resource,
        description: description || null,
        can_view: can_view ?? false,
        can_create: can_create ?? false,
        can_edit: can_edit ?? false,
        can_delete: can_delete ?? false,
        created_by: user.id,
        updated_by: user.id
      })
      .select()
      .single();

    if (insertError) {

      return NextResponse.json(
        { error: 'Failed to create permission', details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { data: newPermission },
      { status: 201 }
    );
  } catch (error) {

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
