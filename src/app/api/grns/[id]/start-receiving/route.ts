import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import {
  GRN_RECEIVING_START_CAPABILITY,
  requireGrnReceivingOperation,
} from "@/lib/grns/permissions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const userSafeStartMessage = (message: string | undefined) => {
  const allowedMessages = new Set([
    "GRN not found",
    "Load list not found",
    "Only draft or paused GRNs can start receiving",
    "Only arrived or receiving load lists can start receiving",
  ]);

  return message && allowedMessages.has(message) ? message : "Failed to start GRN receiving";
};

async function POSTHandler(_request: NextRequest, context: RouteContext) {
  try {
    const access = await requireGrnReceivingOperation(GRN_RECEIVING_START_CAPABILITY);
    if (access instanceof NextResponse) return access;
    const { id } = await context.params;
    const { supabase, userId, companyId } = access.context;

    const { error } = await supabase.rpc("start_grn_receiving", {
      p_company_id: companyId,
      p_user_id: userId,
      p_grn_id: id,
    });

    if (error) {
      console.error("Error starting GRN receiving:", error);
      const status = error.message === "Unauthorized" ? 403 : 400;
      return NextResponse.json({ error: userSafeStartMessage(error.message) }, { status });
    }

    return NextResponse.json({
      id,
      status: "receiving",
      message: "GRN receiving started",
    });
  } catch (error) {
    console.error("Unexpected error starting GRN receiving:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = withActivityLogging(POSTHandler, {
  action: "start_receiving",
  resourceType: "grns",
  route: "/api/grns/[id]/start-receiving",
});
