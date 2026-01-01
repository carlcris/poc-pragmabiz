import { createServerClientWithBU } from '@/lib/supabase/server-with-bu'
import { NextRequest, NextResponse } from 'next/server'
import { requireLookupDataAccess } from '@/lib/auth'
import { RESOURCES } from '@/constants/resources'

export async function GET(request: NextRequest) {
  try {
    // Check permission using Lookup Data Access Pattern
    // User can access if they have EITHER:
    // 1. Direct 'item_categories' view permission, OR
    // 2. Permission to a feature that depends on item categories (pos, sales_orders, etc.)
    const permissionCheck = await requireLookupDataAccess(RESOURCES.ITEM_CATEGORIES)
    if (permissionCheck) return permissionCheck

    const { supabase } = await createServerClientWithBU()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's company
    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'User company not found' }, { status: 400 })
    }

    // Fetch all item categories for the company
    const { data: categories, error } = await supabase
      .from('item_categories')
      .select('id, name, description')
      .eq('company_id', userData.company_id)
      .is('deleted_at', null)
      .order('name', { ascending: true })

    if (error) {

      return NextResponse.json({ error: 'Failed to fetch item categories' }, { status: 500 })
    }

    return NextResponse.json({
      data: categories || [],
    })
  } catch (error) {

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
