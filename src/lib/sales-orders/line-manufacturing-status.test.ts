import { describe, expect, it } from "vitest";
import {
  getLineManufacturingStatus,
  type LineManufacturingContext,
} from "./line-manufacturing-status";

const context: LineManufacturingContext = {
  eligibleItemIds: new Set(["chop-line", "frame-line", "new-line"]),
  frameJobOrderById: new Map([
    ["chop-job", { id: "chop-job", jobOrderCode: "FJO-1", status: "completed" }],
    ["frame-job", { id: "frame-job", jobOrderCode: "FJO-2", status: "pending" }],
  ]),
  frameJobOrderItemBySalesOrderItemId: new Map([
    ["chop-line", { job_order_id: "chop-job" }],
    ["frame-line", { job_order_id: "frame-job" }],
  ]),
  manufacturingOrderByJobOrderId: new Map([
    ["chop-job", { id: "mo-1", manufacturingOrderCode: "MO-1", status: "completed" }],
  ]),
  operationByManufacturingOrderId: new Map(),
};

describe("sales order line manufacturing status", () => {
  it("uses each line's own job, never its sibling's production status", () => {
    expect(getLineManufacturingStatus("chop-line", context)).toMatchObject({
      status: "ready_for_release",
      jobOrderId: "chop-job",
      manufacturingOrderId: "mo-1",
    });
    expect(getLineManufacturingStatus("frame-line", context)).toEqual({
      required: true,
      status: "job_order_ready",
      label: "Job Order Ready",
      jobOrderId: "frame-job",
      jobOrderCode: "FJO-2",
    });
  });
  it("does not assign an existing sibling job to a newly added line", () => {
    expect(getLineManufacturingStatus("new-line", context)?.status).toBe("needs_job_order");
    expect(getLineManufacturingStatus("raw-material", context)).toBeNull();
  });
});
