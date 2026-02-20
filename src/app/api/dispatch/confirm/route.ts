import { NextRequest, NextResponse } from "next/server";

type DispatchConfirmBody = {
  stockRequestId?: string;
  dispatchDate?: string;
  notes?: string;
  items?: Array<{
    stockRequestItemId: string;
    dispatchQty?: number;
  }>;
};

// POST /api/dispatch/confirm - PRD compatibility alias
export async function POST(request: NextRequest) {
  try {
    const clone = request.clone();
    const body = (await clone.json().catch(() => ({}))) as DispatchConfirmBody;
    if (!body.stockRequestId) {
      return NextResponse.json({ error: "stockRequestId is required" }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: "Stock request dispatch confirmation is deprecated.",
        next: `Use Delivery Notes dispatch lifecycle: POST /api/delivery-notes/:id/dispatch. Legacy stockRequestId=${body.stockRequestId} can be resolved from delivery_note_sources.`,
      },
      { status: 410 }
    );
  } catch (error) {
    console.error("Error in dispatch confirm:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
