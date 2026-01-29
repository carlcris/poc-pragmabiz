/**
 * Supabase Client for Server Components & Server Actions
 *
 * Use this client in Server Components and Server Actions.
 * This creates a Supabase client that properly handles cookies for authentication
 * in server-side Next.js code.
 *
 * @example Server Component
 * ```tsx
 * import { createClient } from '@/lib/supabase/server'
 *
 * export default async function ServerComponent() {
 *   const supabase = await createClient()
 *   const { data: items } = await supabase.from('items').select('*')
 *
 *   return <div>{items.map(item => <p key={item.id}>{item.name}</p>)}</div>
 * }
 * ```
 *
 * @example Server Action
 * ```tsx
 * 'use server'
 *
 * import { createClient } from '@/lib/supabase/server'
 *
 * export async function createItem(formData: FormData) {
 *   const supabase = await createClient()
 *   const { data, error } = await supabase.from('items').insert({
 *     name: formData.get('name')
 *   })
 *   return { data, error }
 * }
 * ```
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}
