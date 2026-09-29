import type { SalesOrderLineItem } from "@/types/sales-order";

export type LineManufacturingContext = {
  eligibleItemIds: Set<string>;
  frameJobOrderById: Map<string, { id: string; jobOrderCode: string; status: string }>;
  frameJobOrderItemBySalesOrderItemId: Map<string, { job_order_id: string }>;
  manufacturingOrderByJobOrderId: Map<
    string,
    { id: string; manufacturingOrderCode: string; status: string }
  >;
  operationByManufacturingOrderId: Map<string, { operation_name: string }>;
};

export function getLineManufacturingStatus(
  lineItemId: string,
  context: LineManufacturingContext
): SalesOrderLineItem["manufacturing"] {
  if (!context.eligibleItemIds.has(lineItemId)) return null;

  const jobOrderItem = context.frameJobOrderItemBySalesOrderItemId.get(lineItemId);
  const jobOrder = jobOrderItem ? context.frameJobOrderById.get(jobOrderItem.job_order_id) : null;
  if (!jobOrder) {
    return {
      required: true,
      status: "needs_job_order",
      label: "Needs Job Order",
    };
  }

  const manufacturingOrder = context.manufacturingOrderByJobOrderId.get(jobOrder.id);

  if (!manufacturingOrder) {
    return {
      required: true,
      status: "job_order_ready",
      label: "Job Order Ready",
      jobOrderId: jobOrder.id,
      jobOrderCode: jobOrder.jobOrderCode,
    };
  }

  const operation = context.operationByManufacturingOrderId.get(manufacturingOrder.id);
  const base = {
    required: true,
    jobOrderId: jobOrder.id,
    jobOrderCode: jobOrder.jobOrderCode,
    manufacturingOrderId: manufacturingOrder.id,
    manufacturingOrderCode: manufacturingOrder.manufacturingOrderCode,
    operationName: operation?.operation_name,
  };

  if (manufacturingOrder.status === "completed") {
    return { ...base, status: "ready_for_release", label: "Ready for Release" };
  }
  if (manufacturingOrder.status === "quality_check") {
    return {
      ...base,
      status: "quality_check",
      label: operation?.operation_name || "Quality Check",
    };
  }
  if (manufacturingOrder.status === "in_progress") {
    return { ...base, status: "in_progress", label: operation?.operation_name || "In Production" };
  }
  if (manufacturingOrder.status === "on_hold") {
    return { ...base, status: "on_hold", label: "On Hold" };
  }
  if (manufacturingOrder.status === "cancelled") {
    return { ...base, status: "cancelled", label: "Cancelled" };
  }

  return { ...base, status: "ready", label: "Ready for Production" };
}
