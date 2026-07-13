import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { requireRequestContext } from "@/lib/auth/requestContext";
import {
  LOAD_LIST_LINK_STOCK_REQUISITIONS_CAPABILITY,
  requireLoadListOperation,
} from "@/lib/load-lists/permissions";
import type { Database } from "@/types/database.types";

type EligibleRequisitionItemRow =
  Database["public"]["Functions"]["list_eligible_load_list_requisition_items"]["Returns"][number];

const querySchema = z.object({
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const createListErrorResponse = (message: string) => {
  const status =
    message === "Unauthorized" ? 403 : message === "Load list not found" ? 404 : 500;
  const safeMessage =
    message === "Unauthorized" || message === "Load list not found"
      ? message
      : "Failed to list eligible requisition items";
  return NextResponse.json({ error: safeMessage }, { status });
};

async function GETHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const unauthorized = await requireLoadListOperation(
      LOAD_LIST_LINK_STOCK_REQUISITIONS_CAPABILITY
    );
    if (unauthorized) return unauthorized;

    const { id } = await params;
    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, userId, companyId, currentBusinessUnitId } = context;

    if (!currentBusinessUnitId) {
      return NextResponse.json({ error: "Business unit context required" }, { status: 400 });
    }

    const parsedQuery = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsedQuery.success) {
      return NextResponse.json({ error: "Invalid requisition search" }, { status: 400 });
    }

    const requestedPage = parsedQuery.data.page;
    const limit = parsedQuery.data.limit;
    const fetchPage = (page: number) =>
      supabase.rpc("list_eligible_load_list_requisition_items", {
        p_company_id: companyId,
        p_business_unit_id: currentBusinessUnitId,
        p_user_id: userId,
        p_load_list_id: id,
        p_search: parsedQuery.data.search || undefined,
        p_page: page,
        p_limit: limit,
      });

    const { data, error } = await fetchPage(requestedPage);

    if (error) {
      console.error("Error listing eligible load-list requisition items:", error);
      return createListErrorResponse(error.message);
    }

    let rows: EligibleRequisitionItemRow[] = data ?? [];
    let total = Number(rows[0]?.total_count ?? 0);
    let page = requestedPage;

    if (rows.length === 0 && requestedPage > 1) {
      const { data: firstPageData, error: firstPageError } = await fetchPage(1);

      if (firstPageError) {
        console.error(
          "Error recovering eligible load-list requisition pagination:",
          firstPageError
        );
        return createListErrorResponse(firstPageError.message);
      }

      const firstPageRows: EligibleRequisitionItemRow[] = firstPageData ?? [];
      total = Number(firstPageRows[0]?.total_count ?? 0);
      const lastPage = Math.max(1, Math.ceil(total / limit));

      if (total === 0 || lastPage === 1) {
        rows = firstPageRows;
        page = 1;
      } else {
        const { data: lastPageData, error: lastPageError } = await fetchPage(lastPage);

        if (lastPageError) {
          console.error(
            "Error loading the last eligible load-list requisition page:",
            lastPageError
          );
          return createListErrorResponse(lastPageError.message);
        }

        const lastPageRows: EligibleRequisitionItemRow[] = lastPageData ?? [];
        if (lastPageRows.length > 0) {
          rows = lastPageRows;
          total = Number(lastPageRows[0].total_count);
          page = lastPage;
        } else {
          rows = firstPageRows;
          page = 1;
        }
      }
    }

    return NextResponse.json({
      data: rows.map((row) => ({
        id: row.sr_item_id,
        stockRequisitionId: row.sr_id,
        stockRequisitionNumber: row.sr_number,
        stockRequisitionStatus: row.sr_status,
        requisitionDate: row.requisition_date,
        itemId: row.item_id,
        itemCode: row.item_code,
        itemName: row.item_name,
        requestedQty: Number(row.requested_qty),
        fulfilledQty: Number(row.fulfilled_qty),
        outstandingQty: Number(row.outstanding_qty),
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Unexpected error listing eligible load-list requisition items:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list_eligible_requisition_items",
  resourceType: "load_lists",
  route: "/api/load-lists/[id]/eligible-requisition-items",
});
