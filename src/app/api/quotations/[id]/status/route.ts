import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import {
  asRpcClient,
  fetchQuotationById,
  getClientErrorMessage,
  logQuotationError,
} from "../../_shared";
import { z } from "zod";
import type { QuotationStatus } from "@/types/quotation";
import { validateAcceptance, type AcceptanceChannel } from "@/lib/quotations/acceptance";

const validManualStatuses: QuotationStatus[] = ["sent", "accepted", "rejected", "expired"];
const statusPayloadSchema = z
  .object({
    status: z.string(),
    acceptedByName: z.string().trim().max(200).optional(),
    acceptedChannel: z.string().max(30).optional(),
    waiverPaths: z.array(z.string().min(1).max(1024)).max(50).optional(),
  })
  .strict();

// PATCH /api/quotations/[id]/status
async function PATCHHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const unauthorized = await requirePermission(RESOURCES.SALES_QUOTATIONS, "edit");
    if (unauthorized) return unauthorized;

    const { id: quotationId } = await params;
    const parsed = statusPayloadSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Review the quotation status details and try again." },
        { status: 400 }
      );
    }
    const body = parsed.data;
    const { status } = body;

    if (!status) {
      return NextResponse.json({ error: "Status is required" }, { status: 400 });
    }

    if (!validManualStatuses.includes(status as QuotationStatus)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const { supabase } = await createServerClientWithBU();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Acceptance carries a record or it does not happen. Checked here and not
    // only in the dialog: a client-side guard leaves this endpoint able to
    // accept a quotation with no evidence, which is what the record exists to
    // prevent.
    const acceptance =
      status === "accepted"
        ? {
            acceptedByName: body.acceptedByName?.trim() ?? "",
            acceptedChannel: body.acceptedChannel as AcceptanceChannel,
            waiverPaths: body.waiverPaths ?? [],
          }
        : null;

    if (acceptance) {
      const errors = validateAcceptance(acceptance);
      if (errors.length > 0) {
        return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
      }
    }

    const { error: updateError } = await asRpcClient(supabase).rpc(
      "change_sales_quotation_status_transaction",
      {
        p_quotation_id: quotationId,
        p_status: status,
        p_accepted_by_name: acceptance?.acceptedByName ?? null,
        p_accepted_channel: acceptance?.acceptedChannel ?? null,
        p_waiver_paths: acceptance?.waiverPaths ?? null,
      }
    );

    if (updateError) {
      logQuotationError("Error updating quotation status:", updateError);
      const message = getClientErrorMessage(updateError, "Failed to update quotation status");
      const statusCode =
        message === "Quotation not found"
          ? 404
          : updateError.message === "QUOTATION_STATUS_TRANSITION_INVALID"
            ? 409
            : message === "Failed to update quotation status"
              ? 500
              : 400;
      return NextResponse.json({ error: message }, { status: statusCode });
    }

    const { quotation: updatedQuotation, error: updatedFetchError } = await fetchQuotationById(
      supabase,
      quotationId
    );

    if (updatedFetchError || !updatedQuotation) {
      logQuotationError("Error fetching updated quotation status:", updatedFetchError);
      return NextResponse.json(
        { error: "Quotation status was updated but could not be loaded" },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedQuotation);
  } catch (error) {
    logQuotationError("Unexpected quotation status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const PATCH = withActivityLogging(PATCHHandler, {
  action: "change_status",
  resourceType: "quotations",
  route: "/api/quotations/[id]/status",
});
