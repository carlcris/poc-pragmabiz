import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user details
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const { id: warehouseId } = await params;

    // Verify warehouse belongs to user's company
    const { data: warehouse, error: warehouseError } = await supabase
      .from('warehouses')
      .select('id, warehouse_code, warehouse_name, is_van, company_id')
      .eq('id', warehouseId)
      .eq('company_id', userData.company_id)
      .single();

    if (warehouseError || !warehouse) {
      return NextResponse.json(
        { error: 'Warehouse not found' },
        { status: 404 }
      );
    }

    // Get inventory levels for this warehouse
    const { data: inventoryData, error: inventoryError } = await supabase
      .from('item_warehouse')
      .select(`
        item_id,
        warehouse_id,
        current_stock,
        reorder_level,
        items!inner (
          id,
          item_code,
          item_name,
          description,
          sales_price,
          category_id,
          uom_id
        )
      `)
      .eq('warehouse_id', warehouseId);

    // Get UOM names separately to avoid relationship conflicts
    const uomIds = [...new Set(inventoryData?.map((stock: any) => stock.items?.uom_id).filter(Boolean))];
    console.log('UOM IDs to fetch:', uomIds);

    const { data: uomsData, error: uomError } = await supabase
      .from('units_of_measure')
      .select('id, name')
      .in('id', uomIds);

    console.log('UOMs fetched:', uomsData?.length, 'Error:', uomError);
    const uomMap = new Map(uomsData?.map((uom: any) => [uom.id, uom.name]));

    if (inventoryError) {
      console.error('Error fetching inventory:', inventoryError);
      return NextResponse.json(
        { error: 'Failed to fetch inventory' },
        { status: 500 }
      );
    }

    // Transform data
    const inventory = inventoryData?.map((stock: any) => ({
      id: stock.items?.id,
      itemId: stock.item_id,
      itemCode: stock.items?.item_code,
      itemName: stock.items?.item_name,
      description: stock.items?.description,
      currentStock: parseFloat(stock.current_stock) || 0,
      availableStock: parseFloat(stock.current_stock) || 0,
      unitPrice: parseFloat(stock.items?.sales_price) || 0,
      reorderPoint: parseFloat(stock.reorder_level) || 0,
      categoryId: stock.items?.category_id,
      categoryName: null,
      uomId: stock.items?.uom_id,
      uomName: uomMap.get(stock.items?.uom_id) || '',
    })) || [];

    console.log('Inventory data count:', inventory.length);
    console.log('Sample item:', inventory[0]);

    return NextResponse.json({
      data: {
        warehouse: {
          id: warehouse.id,
          code: warehouse.warehouse_code,
          name: warehouse.warehouse_name,
          isVan: warehouse.is_van,
        },
        inventory,
        summary: {
          totalItems: inventory.length,
          itemsInStock: inventory.filter((i: any) => i.availableStock > 0).length,
          lowStockItems: inventory.filter(
            (i: any) => i.availableStock > 0 && i.availableStock <= i.reorderPoint
          ).length,
          outOfStockItems: inventory.filter((i: any) => i.availableStock === 0).length,
        },
      },
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
