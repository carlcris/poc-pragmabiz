/** Frame jobs may use residual materials; warehouse shortages are advisory. */
export const isManufacturingStartBlocked = (order: {
  frameJobOrderId: string | null;
  hasMaterialShortage: boolean;
  status: string;
}): boolean =>
  !order.frameJobOrderId &&
  order.hasMaterialShortage &&
  (order.status === "ready" || order.status === "queued");
