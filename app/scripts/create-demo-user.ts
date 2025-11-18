/**
 * Script to create demo user in Supabase Auth
 * Run with: npx tsx scripts/create-demo-user.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createDemoUser() {
  const email = 'demo@pragmatica.com'
  const password = 'demo1234'

  console.log('Creating demo user...')
  console.log('Email:', email)
  console.log('Password:', password)

  try {
    // First, delete existing user if exists (using admin API)
    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const existingUser = existingUsers.users.find(u => u.email === email)

    if (existingUser) {
      console.log('Deleting existing user...')
      await supabase.auth.admin.deleteUser(existingUser.id)
      console.log('✓ Existing user deleted')
    }

    // Sign up the user (auto-confirms in local dev)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: 'Demo',
          last_name: 'User'
        }
      }
    })

    if (authError) {
      console.error('Error creating auth user:', authError)
      process.exit(1)
    }

    if (!authData.user) {
      console.error('No user returned from signUp')
      process.exit(1)
    }

    console.log('✓ Auth user created:', authData.user.id)

    // Insert into users table
    const { error: dbError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        company_id: '00000000-0000-0000-0000-000000000001',
        username: 'demo',
        email: email,
        first_name: 'Demo',
        last_name: 'User',
        is_active: true
      })

    if (dbError) {
      console.error('Error creating user profile:', dbError)
      console.log('⚠ Auth user created but profile creation failed')
    } else {
      console.log('✓ User profile created')
    }

    console.log('\n✓ Demo user created successfully!')
    console.log('Email:', email)
    console.log('Password:', password)
    console.log('User ID:', authData.user.id)

  } catch (error) {
    console.error('Unexpected error:', error)
    process.exit(1)
  }
}

createDemoUser()
