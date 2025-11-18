import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

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
      console.error('Error fetching item categories:', error)
      return NextResponse.json({ error: 'Failed to fetch item categories' }, { status: 500 })
    }

    return NextResponse.json({
      data: categories || [],
    })
  } catch (error) {
    console.error('Unexpected error in GET /api/item-categories:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
