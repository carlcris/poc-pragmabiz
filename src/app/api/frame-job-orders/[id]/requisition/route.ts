import { NextRequest, NextResponse } from "next/server";

import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { requireAnyPermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { formatCustomerAddress } from "@/lib/framing/customerAddress";
import {
  loadSalesOrderFrameDetails,
  transformSalesOrderFrameDetails,
} from "@/app/api/sales-orders/frame-details";
import { buildFrameJobOrderRequisitionRows } from "@/lib/frame-job-orders/requisition";
import { logQuotationError } from "../../../quotations/_shared";
import type { FrameQuotationSize } from "@/types/quotation";

type RelatedOne<T> = T | T[] | null | undefined;

type JobOrderCustomer = {
  customer_name: string | null;
  billing_address_line1: string | null;
  billing_address_line2: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_postal_code: string | null;
  shipping_address_line1: string | null;
  shipping_address_line2: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_postal_code: string | null;
};

type JobOrderCreator = {
  first_name: string | null;
  last_name: string | null;
};

type JobOrderHeader = {
  id: string;
  job_order_code: string;
  billing_mode: string;
  customers?: RelatedOne<JobOrderCustomer>;
  created_by_user?: RelatedOne<JobOrderCreator>;
};

type JobOrderItemLink = {
  sales_order_item_id: string | null;
};

type SalesOrderLineTotal = {
  id: string;
  line_total: number | string;
  sort_order: number | null;
};

type QuotationConfigurationSupplement = {
  id: string;
  backing_thickness_in: number | string | null;
  framing_instructions: string | null;
};

const MAX_JOB_COMPONENTS = 500;

const one = <T>(value: RelatedOne<T>): T | null => {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
};

const streetAddress = (line1: string | null, line2: string | null): string | undefined => {
  const street = [line1?.trim(), line2?.trim()].filter(Boolean).join(", ");
  return street || undefined;
};

async function GETHandler(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const unauthorized = await requireAnyPermission([
      [RESOURCES.SALES_QUOTATIONS, "view"],
      [RESOURCES.MANUFACTURING, "view"],
      [RESOURCES.STOCK_TRANSFORMATIONS, "view"],
    ]);
    if (unauthorized) return unauthorized;

    const { id: jobOrderId } = await params;
    const { supabase, currentBusinessUnitId } = await createServerClientWithBU();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!currentBusinessUnitId) {
      return NextResponse.json({ error: "Business unit context required" }, { status: 400 });
    }

    const { data: headerData, error: headerError } = await supabase
      .from("frame_job_orders")
      .select(
        `
        id,
        job_order_code,
        billing_mode,
        customers:customer_id(
          customer_name,
          billing_address_line1,
          billing_address_line2,
          billing_city,
          billing_state,
          billing_postal_code,
          shipping_address_line1,
          shipping_address_line2,
          shipping_city,
          shipping_state,
          shipping_postal_code
        ),
        created_by_user:users!frame_job_orders_created_by_fkey(first_name, last_name)
      `
      )
      .eq("id", jobOrderId)
      .eq("business_unit_id", currentBusinessUnitId)
      .is("deleted_at", null)
      .maybeSingle();

    if (headerError) {
      logQuotationError("Error loading job order requisition header:", headerError);
      return NextResponse.json({ error: "Failed to load job order requisition" }, { status: 500 });
    }

    if (!headerData) {
      return NextResponse.json({ error: "Job order not found" }, { status: 404 });
    }

    const header = headerData as unknown as JobOrderHeader;
    const {
      data: jobItemData,
      error: jobItemsError,
      count: jobItemCount,
    } = await supabase
      .from("frame_job_order_items")
      .select("sales_order_item_id", { count: "exact" })
      .eq("job_order_id", jobOrderId)
      .is("deleted_at", null)
      .range(0, MAX_JOB_COMPONENTS - 1);

    if (jobItemsError) {
      logQuotationError("Error loading job order requisition item links:", jobItemsError);
      return NextResponse.json({ error: "Failed to load job order requisition" }, { status: 500 });
    }

    if ((jobItemCount ?? 0) > MAX_JOB_COMPONENTS) {
      return NextResponse.json(
        { error: "Job order is too large to print in one requisition" },
        { status: 409 }
      );
    }

    const orderItemIds = Array.from(
      new Set(
        ((jobItemData || []) as JobOrderItemLink[])
          .map((item) => item.sales_order_item_id)
          .filter((id): id is string => Boolean(id))
      )
    );

    if (orderItemIds.length === 0) {
      return NextResponse.json(
        { error: "Job order has no printable frame configurations" },
        { status: 409 }
      );
    }

    const [lineResult, frameDetails] = await Promise.all([
      supabase
        .from("sales_order_items")
        .select("id, line_total, sort_order")
        .in("id", orderItemIds)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true })
        .limit(orderItemIds.length),
      loadSalesOrderFrameDetails(supabase, orderItemIds),
    ]);

    if (lineResult.error || frameDetails.error) {
      logQuotationError(
        "Error loading job order requisition frame details:",
        lineResult.error || frameDetails.error
      );
      return NextResponse.json({ error: "Failed to load job order requisition" }, { status: 500 });
    }

    const orderedLines = (lineResult.data || []) as SalesOrderLineTotal[];
    const sourceConfigurationIds = Array.from(
      new Set(
        Array.from(frameDetails.configurationsByItemId.values())
          .flat()
          .map((configuration) => configuration.quotation_configuration_id)
          .filter((id): id is string => Boolean(id))
      )
    );
    const supplementsById = new Map<string, QuotationConfigurationSupplement>();

    if (sourceConfigurationIds.length > 0) {
      const { data: supplementData, error: supplementError } = await supabase
        .from("sales_quotation_item_configurations")
        .select("id, backing_thickness_in, framing_instructions")
        .in("id", sourceConfigurationIds)
        .is("deleted_at", null)
        .limit(sourceConfigurationIds.length);

      if (supplementError) {
        logQuotationError("Error loading job order requisition source details:", supplementError);
        return NextResponse.json(
          { error: "Failed to load job order requisition" },
          { status: 500 }
        );
      }

      for (const supplement of (supplementData || []) as QuotationConfigurationSupplement[]) {
        supplementsById.set(supplement.id, supplement);
      }
    }

    const frameSizes: FrameQuotationSize[] = orderedLines.flatMap((line) => {
      const transformed = transformSalesOrderFrameDetails(
        frameDetails.configurationsByItemId.get(line.id) || [],
        frameDetails.componentsByItemId.get(line.id) || [],
        frameDetails.matLayersByConfigurationId
      );

      return (transformed.frameSizes || [])
        .filter((size) => size.frameConfiguration.billingMode === header.billing_mode)
        .map((size) => {
          const sourceId = size.frameConfiguration.quotationConfigurationId;
          const supplement = sourceId ? supplementsById.get(sourceId) : undefined;
          return {
            ...size,
            frameConfiguration: {
              ...size.frameConfiguration,
              backingThicknessIn:
                supplement?.backing_thickness_in === null ||
                supplement?.backing_thickness_in === undefined
                  ? size.frameConfiguration.backingThicknessIn
                  : Number(supplement.backing_thickness_in),
              framingInstructions:
                supplement?.framing_instructions || size.frameConfiguration.framingInstructions,
            },
          };
        });
    });

    const rows = buildFrameJobOrderRequisitionRows(frameSizes);
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Job order has no printable frame configurations" },
        { status: 409 }
      );
    }

    const customer = one(header.customers);
    const creator = one(header.created_by_user);
    const preparedBy = creator
      ? [creator.first_name, creator.last_name].filter(Boolean).join(" ").trim()
      : undefined;
    const customerAddress = customer
      ? formatCustomerAddress({
          shippingAddress: streetAddress(
            customer.shipping_address_line1,
            customer.shipping_address_line2
          ),
          shippingCity: customer.shipping_city || undefined,
          shippingState: customer.shipping_state || undefined,
          shippingPostalCode: customer.shipping_postal_code || undefined,
          billingAddress: streetAddress(
            customer.billing_address_line1,
            customer.billing_address_line2
          ),
          billingCity: customer.billing_city || undefined,
          billingState: customer.billing_state || undefined,
          billingPostalCode: customer.billing_postal_code || undefined,
        })
      : undefined;

    return NextResponse.json({
      data: {
        rows,
        totalSales: orderedLines.reduce((total, line) => total + (Number(line.line_total) || 0), 0),
        customerName: customer?.customer_name || "",
        customerAddress,
        transactionNumber: header.job_order_code,
        preparedBy: preparedBy || undefined,
      },
    });
  } catch (error) {
    logQuotationError("Unexpected job order requisition error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "view_requisition",
  resourceType: "frame_job_orders",
  route: "/api/frame-job-orders/[id]/requisition",
});
