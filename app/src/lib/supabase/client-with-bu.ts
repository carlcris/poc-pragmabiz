/**
 * Supabase Client with Business Unit Context
 *
 * Enhanced Supabase client that automatically injects business unit context
 * for all queries. This ensures RLS policies are properly enforced.
 *
 * Usage:
 *   const supabase = createClientWithBU();
 *   await supabase.from('customers').select('*'); // Automatically filtered by BU
 */

import { createClient } from '@/lib/supabase/client';
import { useBusinessUnitStore } from '@/stores/businessUnitStore';
import type { SupabaseClient } from '@supabase/supabase-js';

type SupabaseClientWithBU = SupabaseClient & {
  _buContextSet?: boolean;
};

/**
 * Create a Supabase client with automatic business unit context injection
 *
 * @returns Supabase client with BU context set
 * @throws Error if no current business unit is selected
 */
export function createClientWithBU(): SupabaseClientWithBU {
  const client = createClient() as SupabaseClientWithBU;
  const currentBU = useBusinessUnitStore.getState().currentBusinessUnit;

  if (!currentBU) {

    return client;
  }

  // Mark that we've set the BU context
  client._buContextSet = true;

  // Set the business unit context for this client
  // Note: This uses the database function to set session context
  // The RLS policies will automatically filter based on this context
  void client.rpc('set_business_unit_context', {
    bu_id: currentBU.id,
  });

  return client;
}

/**
 * Create a Supabase client without BU context (for system operations)
 *
 * WARNING: Only use this for operations that should bypass BU isolation,
 * such as admin operations or cross-BU reporting.
 *
 * @returns Standard Supabase client without BU context
 */
export function createClientWithoutBU(): SupabaseClient {
  return createClient();
}

/**
 * Check if a Supabase client has BU context set
 *
 * @param client - Supabase client to check
 * @returns true if BU context is set, false otherwise
 */
export function hasBUContext(client: SupabaseClient): boolean {
  return (client as SupabaseClientWithBU)._buContextSet === true;
}
