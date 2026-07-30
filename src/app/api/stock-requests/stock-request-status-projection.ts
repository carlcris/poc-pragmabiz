import type { createServerClientWithBU } from "@/lib/supabase/server-with-bu";

type SupabaseClient = Awaited<ReturnType<typeof createServerClientWithBU>>["supabase"];

const toNumber = (value: number | string | null | undefined) => {
  if (value == null) return 0;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const getStockRequestStatusProjection = async (
  supabase: SupabaseClient,
  companyId: string,
  stockRequestId: string
) => {
  const { data: request, error: requestError } = await supabase
    .from("stock_requests")
    .select("id, status")
    .eq("id", stockRequestId)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .maybeSingle();

  if (requestError) {
    throw new Error("STOCK_REQUEST_STATUS_LOAD_FAILED");
  }
  if (!request) return null;

  const [
    { data: requestItems, error: requestItemsError },
    { data: deliveryItems, error: dnError },
  ] = await Promise.all([
    supabase
      .from("stock_request_items")
      .select("requested_qty, received_qty")
      .eq("stock_request_id", stockRequestId),
    supabase
      .from("delivery_note_items")
      .select("allocated_qty, dispatched_qty, is_voided, delivery_notes!inner(status)")
      .eq("company_id", companyId)
      .eq("sr_id", stockRequestId),
  ]);

  if (requestItemsError || dnError) {
    throw new Error("STOCK_REQUEST_STATUS_LOAD_FAILED");
  }

  const activeDeliveryItems = (deliveryItems || []).filter((item) => {
    const header = Array.isArray(item.delivery_notes)
      ? item.delivery_notes[0]
      : item.delivery_notes;
    return header?.status !== "voided" && item.is_voided !== true;
  });

  return {
    stockRequestId,
    cachedStatus: request.status,
    derivedStatus: request.status,
    totals: {
      totalRequested: (requestItems || []).reduce(
        (sum, item) => sum + toNumber(item.requested_qty),
        0
      ),
      totalAllocated: activeDeliveryItems.reduce(
        (sum, item) => sum + toNumber(item.allocated_qty),
        0
      ),
      totalDispatched: activeDeliveryItems.reduce(
        (sum, item) => sum + toNumber(item.dispatched_qty),
        0
      ),
      totalReceived: (requestItems || []).reduce(
        (sum, item) => sum + toNumber(item.received_qty),
        0
      ),
    },
  };
};
