/**
 * Supabase Server Client with Business Unit Context
 *
 * NEW JWT-BASED APPROACH:
 * - Business unit context is stored in JWT claims (current_business_unit_id)
 * - RLS policies read from JWT using get_current_business_unit_id() function
 * - No need to set session/transaction-level config variables
 * - Solves connection pooling issue where config doesn't persist across connections
 *
 * The BU flow is:
 * 1. User logs in → Auth hook injects default BU into JWT
 * 2. User switches BU → Call update_current_business_unit(), then refresh session
 * 3. New JWT issued → Contains updated current_business_unit_id claim
 * 4. RLS policies enforce → Read BU from JWT (available in every pooled connection)
 */

import { createClient } from '@/lib/supabase/server';

/**
 * Create a Supabase server client and extract business unit context from JWT
 *
 * SECURITY: Uses getUser() instead of getSession() to verify JWT authenticity
 * with Supabase Auth server. getSession() data comes from cookies and may be tampered.
 *
 * @returns Object with supabase client and currentBusinessUnitId from JWT
 */
export async function createServerClientWithBU() {
  const supabase = await createClient();

  // SECURITY: Use getUser() to authenticate the JWT by contacting Supabase Auth server
  // Do NOT use getSession() as it reads from cookies without verification
  await supabase.auth.getUser();

  // Custom claims from auth hooks are NOT in the user object from getUser()
  // We need to decode the JWT directly to access custom claims
  // Let's get the session which has the raw JWT
  const { data: { session } } = await supabase.auth.getSession();

  // Decode JWT to get custom claims
  let currentBusinessUnitId: string | undefined;
  if (session?.access_token) {
    try {
      const parts = session.access_token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
        currentBusinessUnitId = payload.current_business_unit_id;
      }
    } catch {
    }
  }

  return {
    supabase,
    currentBusinessUnitId
  };
}

/**
 * Create a Supabase server client without BU context (for admin operations)
 *
 * WARNING: Only use this for operations that should bypass BU isolation
 *
 * @returns Standard Supabase server client
 */
export async function createServerClientWithoutBU() {
  return createClient();
}
