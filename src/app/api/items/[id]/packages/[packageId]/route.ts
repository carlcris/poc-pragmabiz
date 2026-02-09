import { NextRequest, NextResponse } from "next/server";

/**
 * GET/PUT/DELETE /api/items/[id]/packages/[packageId]
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

export async function PUT(request: NextRequest) {
  void request;
  return NextResponse.json(
    { error: "Packaging has been removed." },
    { status: 410 }
  );
}

export async function DELETE(request: NextRequest) {
  void request;
  return NextResponse.json(
    { error: "Packaging has been removed." },
    { status: 410 }
  );
}
