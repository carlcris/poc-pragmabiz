import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Get current user from Supabase session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user details from our users table
    const { data: userData, error: dbError } = await supabase
      .from('users')
      .select('id, username, email, first_name, last_name, company_id')
      .eq('id', user.id)
      .single()

    if (dbError) {

      // If user not in database, create basic user object from auth
      return NextResponse.json({
        user: {
          id: user.id,
          email: user.email,
          username: user.email?.split('@')[0] || '',
          firstName: '',
          lastName: '',
          companyId: '',
        },
      })
    }

    return NextResponse.json({
      user: {
        id: userData.id,
        email: userData.email,
        username: userData.username,
        firstName: userData.first_name || '',
        lastName: userData.last_name || '',
        companyId: userData.company_id,
      },
    })
  } catch {

    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
