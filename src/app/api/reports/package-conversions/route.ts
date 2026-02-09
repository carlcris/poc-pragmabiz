import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/reports/package-conversions
 *
 * Deprecated: packaging has been removed.
 */
export async function GET(request: NextRequest) {
  void request;
  return NextResponse.json(
    { error: "Packaging has been removed." },
    { status: 410 }
  );
}
