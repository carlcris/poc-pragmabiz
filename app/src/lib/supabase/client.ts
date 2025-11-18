/**
 * Supabase Client for Browser (Client Components)
 *
 * Use this client in Client Components (with 'use client' directive)
 * This creates a singleton instance of the Supabase client that can be used
 * throughout your application in browser/client-side code.
 *
 * @example
 * ```tsx
 * 'use client'
 *
 * import { supabase } from '@/lib/supabase/client'
 *
 * export default function MyComponent() {
 *   const fetchData = async () => {
 *     const { data, error } = await supabase.from('items').select('*')
 *   }
 *
 *   return <button onClick={fetchData}>Fetch Items</button>
 * }
 * ```
 */

import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env.local file.'
  )
}

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

export default supabase
