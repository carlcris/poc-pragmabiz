import { createServerClientWithBU } from '@/lib/supabase/server-with-bu'
import { NextRequest, NextResponse } from 'next/server'
import { requireLookupDataAccess } from '@/lib/auth'
import { RESOURCES } from '@/constants/resources'

export async function GET(request: NextRequest) {
  try {
    const permissionCheck = await requireLookupDataAccess(RESOURCES.ITEMS)
    if (permissionCheck) return permissionCheck

    const { supabase } = await createServerClientWithBU()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'User company not found' }, { status: 400 })
    }

    const { data: units, error } = await supabase
      .from('units_of_measure')
      .select('id, code, name, symbol, is_base_unit, is_active')
      .eq('company_id', userData.company_id)
      .is('deleted_at', null)
      .order('code', { ascending: true })

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch units of measure' }, { status: 500 })
    }

    return NextResponse.json({
      data: (units || []).map((unit) => ({
        id: unit.id,
        code: unit.code,
        name: unit.name,
        symbol: unit.symbol,
        isBaseUnit: unit.is_base_unit ?? false,
        isActive: unit.is_active ?? true,
      })),
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
