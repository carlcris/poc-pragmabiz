import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { email, password, firstName, lastName } = await request.json()

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { message: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Sign up with Supabase
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName || '',
          last_name: lastName || '',
        },
      },
    })

    if (signUpError) {

      return NextResponse.json(
        { message: signUpError.message || 'Registration failed' },
        { status: 400 }
      )
    }

    if (!data.user) {
      return NextResponse.json(
        { message: 'Registration failed' },
        { status: 400 }
      )
    }

    // Create user profile in our users table
    const { error: profileError } = await supabase.from('users').insert({
      id: data.user.id,
      company_id: '00000000-0000-0000-0000-000000000001', // Demo company
      username: email.split('@')[0],
      email: email,
      first_name: firstName || '',
      last_name: lastName || '',
      is_active: true,
    })

    if (profileError) {

      // Continue anyway as auth user is created
    }

    return NextResponse.json({
      message: 'Registration successful',
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    })
  } catch (error) {

    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
