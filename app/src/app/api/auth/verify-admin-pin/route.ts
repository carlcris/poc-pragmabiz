import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { pin } = body;

    if (!pin) {
      return NextResponse.json(
        { error: 'PIN is required' },
        { status: 400 }
      );
    }

    // For now, use a simple default PIN check
    // In production, you should:
    // 1. Add admin_pin column to users table
    // 2. Hash the PIN
    // 3. Check against the hashed value
    const DEFAULT_ADMIN_PIN = '0000';
    const isValid = pin === DEFAULT_ADMIN_PIN;

    return NextResponse.json({
      valid: isValid,
    });

  } catch (error) {

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
