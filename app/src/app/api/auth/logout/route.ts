import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Sign out from Supabase
    const { error } = await supabase.auth.signOut()

    if (error) {

      return NextResponse.json(
        { message: error.message || 'Logout failed' },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: 'Logged out successfully' })
  } catch (error) {

    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
