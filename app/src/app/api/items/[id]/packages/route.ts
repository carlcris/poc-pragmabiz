import { createServerClientWithBU } from '@/lib/supabase/server-with-bu';
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { RESOURCES } from '@/constants/resources';

// GET /api/items/[id]/packages - List all packages for an item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const unauthorized = await requirePermission(RESOURCES.ITEMS, 'view');
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();
    const { id: itemId } = await params;

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

    // Verify item exists and belongs to company
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('id, item_code, item_name, package_id')
      .eq('id', itemId)
      .eq('company_id', userData.company_id)
      .is('deleted_at', null)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Get all packages for this item
    const { data: packages, error: packagesError } = await supabase
      .from('item_packaging')
      .select(`
        id,
        pack_type,
        pack_name,
        qty_per_pack,
        uom_id,
        barcode,
        is_default,
        is_active,
        created_at,
        updated_at,
        units_of_measure(id, code, name, symbol)
      `)
      .eq('item_id', itemId)
      .eq('company_id', userData.company_id)
      .is('deleted_at', null)
      .order('is_default', { ascending: false })
      .order('qty_per_pack', { ascending: true });

    if (packagesError) {
      return NextResponse.json(
        { error: 'Failed to fetch packages' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: packages.map((pkg: any) => ({
        id: pkg.id,
        packType: pkg.pack_type,
        packName: pkg.pack_name,
        qtyPerPack: parseFloat(pkg.qty_per_pack),
        uomId: pkg.uom_id,
        uom: pkg.units_of_measure,
        barcode: pkg.barcode,
        isDefault: pkg.is_default,
        isBasePackage: pkg.id === item.package_id,
        isActive: pkg.is_active,
        createdAt: pkg.created_at,
        updatedAt: pkg.updated_at,
      })),
    });
  } catch (error) {
    console.error('Error fetching item packages:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/items/[id]/packages - Create a new package for an item
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const unauthorized = await requirePermission(RESOURCES.ITEMS, 'create');
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();
    const { id: itemId } = await params;
    const body = await request.json();

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

    // Verify item exists and belongs to company
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('id, package_id, setup_complete')
      .eq('id', itemId)
      .eq('company_id', userData.company_id)
      .is('deleted_at', null)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Validate required fields
    if (!body.packType || !body.packName || !body.qtyPerPack) {
      return NextResponse.json(
        { error: 'Missing required fields: packType, packName, qtyPerPack' },
        { status: 400 }
      );
    }

    // Validate qty_per_pack is positive
    if (parseFloat(body.qtyPerPack) <= 0) {
      return NextResponse.json(
        { error: 'qtyPerPack must be greater than 0' },
        { status: 400 }
      );
    }

    // Check if pack_type already exists for this item
    const { data: existingPack } = await supabase
      .from('item_packaging')
      .select('id')
      .eq('item_id', itemId)
      .eq('pack_type', body.packType)
      .eq('company_id', userData.company_id)
      .is('deleted_at', null)
      .single();

    if (existingPack) {
      return NextResponse.json(
        { error: 'A package with this pack_type already exists for this item' },
        { status: 400 }
      );
    }

    // Create the package
    const { data: newPackage, error: createError } = await supabase
      .from('item_packaging')
      .insert({
        company_id: userData.company_id,
        item_id: itemId,
        pack_type: body.packType,
        pack_name: body.packName,
        qty_per_pack: parseFloat(body.qtyPerPack),
        uom_id: body.uomId || null,
        barcode: body.barcode || null,
        is_default: body.isDefault || false,
        is_active: body.isActive !== false, // Default to true
        created_by: user.id,
        updated_by: user.id,
      })
      .select(`
        id,
        pack_type,
        pack_name,
        qty_per_pack,
        uom_id,
        barcode,
        is_default,
        is_active,
        created_at,
        updated_at
      `)
      .single();

    if (createError || !newPackage) {
      return NextResponse.json(
        { error: 'Failed to create package' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        data: {
          id: newPackage.id,
          packType: newPackage.pack_type,
          packName: newPackage.pack_name,
          qtyPerPack: parseFloat(newPackage.qty_per_pack),
          uomId: newPackage.uom_id,
          barcode: newPackage.barcode,
          isDefault: newPackage.is_default,
          isActive: newPackage.is_active,
          createdAt: newPackage.created_at,
          updatedAt: newPackage.updated_at,
        },
        message: 'Package created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating package:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
