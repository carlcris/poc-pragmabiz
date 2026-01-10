/**
 * Business Units API Route
 *
 * GET /api/business-units - Get all business units accessible by current user
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { BusinessUnitWithAccess } from '@/types/business-unit';

export async function GET() {
  try {
    // Note: No permission check - all authenticated users need to see their business units
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get business units accessible by user
    const { data: accessRecords, error: accessError } = await supabase
      .from('user_business_unit_access')
      .select(
        `
        user_id,
        business_unit_id,
        role,
        is_default,
        granted_at,
        granted_by,
        business_units (
          id,
          company_id,
          code,
          name,
          type,
          is_active,
          created_at,
          created_by,
          updated_at,
          updated_by
        )
      `
      )
      .eq('user_id', user.id);

    if (accessError) {

      return NextResponse.json(
        { error: 'Failed to fetch business units' },
        { status: 500 }
      );
    }

    if (!accessRecords || accessRecords.length === 0) {
      return NextResponse.json(
        { error: 'No business units found for user' },
        { status: 404 }
      );
    }

    type AccessRecord = {
      role: BusinessUnitWithAccess["access"]["role"];
      is_default: boolean;
      business_units: Omit<BusinessUnitWithAccess, "access"> | null;
    };

    // Transform data to BusinessUnitWithAccess format
    const businessUnits: BusinessUnitWithAccess[] = (accessRecords as AccessRecord[])
      .map((record) => {
        if (!record.business_units) return null;

        return {
          ...record.business_units,
          access: {
            role: record.role,
            is_default: record.is_default,
          },
        };
      })
      .filter((bu): bu is BusinessUnitWithAccess => bu !== null)
      .filter((bu) => bu.is_active); // Only return active business units

    return NextResponse.json({
      data: businessUnits,
    });
  } catch {

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
