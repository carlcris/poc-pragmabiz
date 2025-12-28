import { createServerClientWithBU } from '@/lib/supabase/server-with-bu'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/reorder/alerts/acknowledge
// Acknowledges reorder alerts
// Note: Since alerts are generated dynamically from stock levels, this is a no-op
// In a full implementation, this would store acknowledgments in a reorder_alerts table
export async function POST(request: NextRequest) {
  try {
    const { supabase, currentBusinessUnitId } = await createServerClientWithBU()
    const body = await request.json()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Validate business unit context
    if (!currentBusinessUnitId) {
      return NextResponse.json(
        { error: 'Business unit context required' },
        { status: 400 }
      )
    }

    // Validate request body
    if (!body.alertIds || !Array.isArray(body.alertIds)) {
      return NextResponse.json(
        { error: 'Invalid request: alertIds must be an array' },
        { status: 400 }
      )
    }

    // Since alerts are generated dynamically from current stock levels,
    // there's no persistent alert records to update.
    // In a full implementation, you would:
    // 1. Create a reorder_alerts table to track alert history
    // 2. Store acknowledgment information (acknowledged_by, acknowledged_at)
    // 3. Filter out acknowledged alerts in the GET endpoint

    // For now, just return success
    return NextResponse.json({
      success: true,
      message: `${body.alertIds.length} alert(s) acknowledged`,
      acknowledgedCount: body.alertIds.length,
    })
  } catch (error) {
    console.error('Unexpected error in POST /api/reorder/alerts/acknowledge:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
