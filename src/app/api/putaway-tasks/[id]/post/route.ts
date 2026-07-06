import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const postPutawayTaskSchema = z.object({
  locationId: z.string().uuid(),
  quantity: z.number().positive(),
  batchCode: z.string().trim().min(1).max(150),
});

type PostPutawayTaskResultRow = {
  transaction_id: string;
  batch_location_id: string;
  batch_location_sku: string;
  batch_code: string;
  posted_quantity: number | string;
  posted_date: string;
  location_id: string;
};

const parseNumber = (value: number | string | null | undefined) => {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

async function POSTHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requirePermission(RESOURCES.WAREHOUSES, "edit");
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const { supabase, userId } = await createServerClientWithBU();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = postPutawayTaskSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { data, error } = await supabase.rpc("post_putaway_task", {
    p_task_id: id,
    p_location_id: parsed.data.locationId,
    p_quantity: parsed.data.quantity,
    p_batch_code: parsed.data.batchCode,
    p_user_id: userId,
  });

  if (error) {
    console.error("Error posting putaway task:", error);
    return NextResponse.json({ error: "Failed to post putaway task" }, { status: 400 });
  }

  const result = ((data || []) as PostPutawayTaskResultRow[])[0];

  if (!result) {
    console.error("Putaway post RPC returned no result", { taskId: id });
    return NextResponse.json({ error: "Failed to post putaway task" }, { status: 500 });
  }

  return NextResponse.json({
    message: "Putaway posted successfully",
    transactionId: result.transaction_id,
    batchLocationId: result.batch_location_id,
    batchLocationSku: result.batch_location_sku,
    batchCode: result.batch_code,
    postedQuantity: parseNumber(result.posted_quantity),
    postedDate: result.posted_date,
    locationId: result.location_id,
  });
}

export const POST = withActivityLogging(POSTHandler, {
  action: "post",
  resourceType: "putaway_tasks",
  route: "/api/putaway-tasks/[id]/post",
});
