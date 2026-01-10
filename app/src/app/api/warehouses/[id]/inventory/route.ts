import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithBU } from '@/lib/supabase/server-with-bu';
import { requireLookupDataAccess } from '@/lib/auth';
import { RESOURCES } from '@/constants/resources';
import type { Tables } from '@/types/supabase';

type ItemWarehouseRow = Tables<'item_warehouse'>;
type ItemRow = Tables<'items'>;
type UomRow = Tables<'units_of_measure'>;
type ItemWarehouseWithItem = ItemWarehouseRow & {
  items: ItemRow | null;
};

type InventoryItem = {
  id: string | undefined;
  itemId: string;
  itemCode: string | undefined;
  itemName: string | undefined;
  description: string | null | undefined;
  currentStock: number;
  availableStock: number;
  unitPrice: number;
  unitCost: number;
  reorderPoint: number;
  categoryId: string | null | undefined;
  categoryName: string | null;
  uomId: string | null | undefined;
  uomName: string;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check permission using Lookup Data Access Pattern
    // User can access if they have EITHER:
    // 1. Direct 'warehouses' view permission, OR
    // 2. Permission to a feature that depends on warehouses (van_sales, stock_transfers, etc.)
    const unauthorized = await requireLookupDataAccess(RESOURCES.WAREHOUSES);
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();

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
          cost_price,
          category_id,
          uom_id
        )
      `)
      .eq('warehouse_id', warehouseId);

    // Fail early if inventory fetch failed
    if (inventoryError) {

      return NextResponse.json(
        { error: 'Failed to fetch inventory' },
        { status: 500 }
      );
    }

    // Get UOM names separately to avoid relationship conflicts
    const uomIds = inventoryData && inventoryData.length > 0
      ? [...new Set((inventoryData as ItemWarehouseWithItem[]).map((stock) => stock.items?.uom_id).filter(Boolean))]
      : [];

    let uomsData: UomRow[] = [];
    let uomError: unknown = null;
    if (uomIds.length > 0) {
      const uomRes = await supabase
        .from('units_of_measure')
        .select('id, name')
        .in('id', uomIds);
      uomsData = (uomRes.data as UomRow[] | null) || [];
      uomError = uomRes.error;
    }

    if (uomError) {
    }

    const uomMap = new Map((uomsData || []).map((uom) => [uom.id, uom.name]));

    // Transform data
    const inventory: InventoryItem[] = (inventoryData as ItemWarehouseWithItem[] | null)?.map((stock) => ({
      id: stock.items?.id,
      itemId: stock.item_id,
      itemCode: stock.items?.item_code,
      itemName: stock.items?.item_name,
      description: stock.items?.description,
      currentStock: Number(stock.current_stock) || 0,
      availableStock: Number(stock.current_stock) || 0,
      unitPrice: Number(stock.items?.sales_price) || 0,
      unitCost: Number(stock.items?.cost_price) || 0,
      reorderPoint: Number(stock.reorder_level) || 0,
      categoryId: stock.items?.category_id,
      categoryName: null,
      uomId: stock.items?.uom_id,
      uomName: uomMap.get(stock.items?.uom_id) || '',
    })) || [];

    // Sort client-side by itemName to emulate previous ordering
    inventory.sort((a, b) => {
      return (a.itemName || '').toString().localeCompare((b.itemName || '').toString());
    });

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
          itemsInStock: inventory.filter((i) => i.availableStock > 0).length,
          lowStockItems: inventory.filter(
            (i) => i.availableStock > 0 && i.availableStock <= i.reorderPoint
          ).length,
          outOfStockItems: inventory.filter((i) => i.availableStock === 0).length,
        },
      },
    });

  } catch {

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
