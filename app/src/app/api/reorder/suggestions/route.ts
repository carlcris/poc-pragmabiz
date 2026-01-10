import { createServerClientWithBU } from '@/lib/supabase/server-with-bu'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { RESOURCES } from '@/constants/resources'

// GET /api/reorder/suggestions
// Generates purchase suggestions based on stock levels
// NOTE: This feature requires reorder management tables that haven't been set up yet
export async function GET() {
  try {
    await requirePermission(RESOURCES.REORDER_MANAGEMENT, 'view')
    const { supabase } = await createServerClientWithBU()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // TODO: Implement reorder suggestions logic
    // This requires setting up reorder_rules, reorder_alerts, and reorder_statistics tables
    // For now, return empty array
    return NextResponse.json([])
  } catch {

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
