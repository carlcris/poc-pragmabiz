import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/items/create-with-packages
 *
 * Deprecated: packaging has been removed. Use POST /api/items instead.
 */
export async function POST(request: NextRequest) {
  void request;
  return NextResponse.json(
    { error: "Packaging has been removed. Use POST /api/items instead." },
    { status: 410 }
  );
}
