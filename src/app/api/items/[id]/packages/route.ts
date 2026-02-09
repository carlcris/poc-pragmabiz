import { NextRequest, NextResponse } from "next/server";

/**
 * GET/POST /api/items/[id]/packages
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

export async function POST(request: NextRequest) {
  void request;
  return NextResponse.json(
    { error: "Packaging has been removed." },
    { status: 410 }
  );
}
