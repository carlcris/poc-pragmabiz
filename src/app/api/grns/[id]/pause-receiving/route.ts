import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import {
  GRN_RECEIVING_SAVE_CAPABILITY,
  requireGrnReceivingOperation,
} from "@/lib/grns/permissions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const userSafePauseMessage = (message: string | undefined) => {
  const allowedMessages = new Set(["GRN not found", "Only receiving GRNs can be paused"]);

  return message && allowedMessages.has(message)
    ? message
    : "Failed to pause GRN receiving";
};

async function POSTHandler(_request: NextRequest, context: RouteContext) {
  try {
    const unauthorized = await requireGrnReceivingOperation(GRN_RECEIVING_SAVE_CAPABILITY);
    if (unauthorized) return unauthorized;
    const { id } = await context.params;
    const { supabase } = await createServerClientWithBU();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: "User company not found" }, { status: 400 });
    }

    const { error } = await supabase.rpc("pause_grn_receiving", {
      p_company_id: userData.company_id,
      p_user_id: user.id,
      p_grn_id: id,
    });

    if (error) {
      console.error("Error pausing GRN receiving:", error);
      return NextResponse.json({ error: userSafePauseMessage(error.message) }, { status: 400 });
    }

    return NextResponse.json({
      id,
      status: "draft",
      message: "GRN receiving paused",
    });
  } catch (error) {
    console.error("Unexpected error pausing GRN receiving:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = withActivityLogging(POSTHandler, {
  action: "pause_receiving",
  resourceType: "grns",
  route: "/api/grns/[id]/pause-receiving",
});
