"use client";

import Link from "next/link";
import { useStockRequest } from "@/hooks/useStockRequests";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { StockRequest, StockRequestPriority, StockRequestStatus } from "@/types/stock-request";

interface StockRequestViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: StockRequest | null;
}

const getStatusLabel = (status: StockRequestStatus) => {
  const baseClass = "text-xs font-medium";

  switch (status) {
    case "draft":
      return <span className={`${baseClass} text-muted-foreground`}>Draft</span>;
    case "submitted":
      return <span className={`${baseClass} text-amber-600`}>Submitted</span>;
    case "approved":
      return <span className={`${baseClass} text-blue-600`}>Approved</span>;
    case "picked":
      return <span className={`${baseClass} text-indigo-600`}>Picked</span>;
    case "picking":
      return <span className={`${baseClass} text-indigo-600`}>Picking</span>;
    case "allocating":
      return <span className={`${baseClass} text-amber-600`}>Allocating</span>;
    case "partially_allocated":
      return <span className={`${baseClass} text-orange-600`}>Partially Allocated</span>;
    case "allocated":
      return <span className={`${baseClass} text-orange-700`}>Allocated</span>;
    case "dispatched":
      return <span className={`${baseClass} text-indigo-600`}>Dispatched</span>;
    case "partially_fulfilled":
      return <span className={`${baseClass} text-emerald-600`}>Partially Fulfilled</span>;
    case "fulfilled":
      return <span className={`${baseClass} text-emerald-700`}>Fulfilled</span>;
    case "received":
      return <span className={`${baseClass} text-emerald-600`}>Received</span>;
    case "completed":
      return <span className={`${baseClass} text-emerald-600`}>Completed</span>;
    case "cancelled":
      return <span className={`${baseClass} text-red-600`}>Cancelled</span>;
    default:
      return <span className={`${baseClass} text-muted-foreground`}>{String(status).replace(/_/g, " ")}</span>;
  }
};

const getPriorityLabel = (priority: StockRequestPriority) => {
  const baseClass = "text-xs font-medium";

  switch (priority) {
    case "low":
      return <span className={`${baseClass} text-slate-500`}>Low</span>;
    case "normal":
      return <span className={`${baseClass} text-slate-600`}>Normal</span>;
    case "high":
      return <span className={`${baseClass} text-orange-600`}>High</span>;
    case "urgent":
      return <span className={`${baseClass} text-red-600`}>Urgent</span>;
  }
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export function StockRequestViewDialog({
  open,
  onOpenChange,
  request: initialRequest,
}: StockRequestViewDialogProps) {
  const requestId = initialRequest?.id || "";
  const { data: fullRequest } = useStockRequest(requestId);
  const request = fullRequest || initialRequest;
  if (!request) return null;

  const fulfillmentSummary = (request.stock_request_items || []).reduce(
    (acc, item) => {
      const requestedQty = Number(item.requested_qty || 0);
      const deliveredQty = Number(item.dispatch_qty ?? item.received_qty ?? 0);

      return {
        totalRequested: acc.totalRequested + requestedQty,
        totalDelivered: acc.totalDelivered + deliveredQty,
      };
    },
    { totalRequested: 0, totalDelivered: 0 }
  );
  const remainingQty = Math.max(0, fulfillmentSummary.totalRequested - fulfillmentSummary.totalDelivered);
  const linkedFulfillmentNotes =
    request.fulfilling_delivery_notes && request.fulfilling_delivery_notes.length > 0
      ? request.fulfilling_delivery_notes
      : request.fulfilling_delivery_note
        ? [request.fulfilling_delivery_note]
        : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle>Stock Request Details</DialogTitle>
            {getStatusLabel(request.status)}
          </div>
          <DialogDescription>Request #{request.request_code}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6 text-sm">
            <div className="space-y-3">
              <div>
                <span className="text-muted-foreground">Requested By:</span>
                <div className="font-medium">
                  {request.requesting_warehouse?.warehouse_code
                    ? `${request.requesting_warehouse.warehouse_code} - ${request.requesting_warehouse.warehouse_name}`
                    : "--"}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Requested To:</span>
                <div className="font-medium">
                  {request.fulfilling_warehouse?.warehouse_code
                    ? `${request.fulfilling_warehouse.warehouse_code} - ${request.fulfilling_warehouse.warehouse_name}`
                    : "--"}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Requested By:</span>
                <div className="font-medium">
                  {request.requested_by_user?.full_name || request.requested_by_user?.email || "--"}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-muted-foreground">Request Date:</span>
                <div className="font-medium">{formatDate(request.request_date)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Required Date:</span>
                <div className="font-medium">{formatDate(request.required_date)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Received Date:</span>
                <div className="font-medium">
                  {request.received_at ? formatDate(request.received_at) : "--"}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Received By:</span>
                <div className="font-medium">
                  {request.received_by_user?.full_name || request.received_by_user?.email || "--"}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Priority:</span>
                <div>{getPriorityLabel(request.priority)}</div>
              </div>
            </div>
          </div>

          {(request.purpose || request.notes) && (
            <div className="grid grid-cols-2 gap-6 text-sm">
              <div>
                <span className="text-muted-foreground">Purpose:</span>
                <div className="font-medium">{request.purpose || "--"}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Notes:</span>
                <div className="font-medium">{request.notes || "--"}</div>
              </div>
            </div>
          )}

          <div>
            <h3 className="mb-3 text-sm font-semibold">Line Items</h3>
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-3 text-left">Item</th>
                    <th className="p-3 text-right">Quantity</th>
                    <th className="p-3 text-right">Delivered Qty</th>
                    <th className="p-3 text-left">Unit</th>
                    <th className="p-3 text-left">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {request.stock_request_items?.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="p-3">
                        <div className="font-medium">{item.items?.item_name || "--"}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.items?.item_code || ""}
                        </div>
                      </td>
                      <td className="p-3 text-right">{item.requested_qty.toFixed(2)}</td>
                      <td className="p-3 text-right">
                        {(item.dispatch_qty ?? item.received_qty ?? 0).toFixed(2)}
                      </td>
                      <td className="p-3">
                        <span className="text-muted-foreground">
                          {item.units_of_measure?.code || "--"}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="text-muted-foreground">{item.notes || "--"}</span>
                      </td>
                    </tr>
                  ))}
                  {(!request.stock_request_items || request.stock_request_items.length === 0) && (
                    <tr className="border-t">
                      <td colSpan={5} className="p-3 text-center text-muted-foreground">
                        No items found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              Fulfillment Summary
            </h3>
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="mb-1 text-xs text-muted-foreground">Total Requested</div>
                <div className="text-2xl font-bold">{fulfillmentSummary.totalRequested.toFixed(2)}</div>
              </div>
              <div className="rounded-lg border bg-green-50/40 p-3">
                <div className="mb-1 text-xs text-muted-foreground">Total Delivered</div>
                <div className="text-2xl font-bold text-green-600">
                  {fulfillmentSummary.totalDelivered.toFixed(2)}
                </div>
              </div>
              <div className="rounded-lg border bg-orange-50/50 p-3">
                <div className="mb-1 text-xs text-muted-foreground">Remaining Qty</div>
                <div className="text-2xl font-bold text-orange-600">{remainingQty.toFixed(2)}</div>
              </div>
            </div>
            <div className="rounded-lg border p-4 text-sm">
              <div className="mb-2 text-xs text-muted-foreground">Fulfilling Delivery Notes</div>
              {linkedFulfillmentNotes.length > 0 ? (
                <div className="space-y-2">
                  {linkedFulfillmentNotes.map((note) => (
                    <div key={note.id} className="flex items-center justify-between gap-3">
                      <Link
                        href={`/inventory/delivery-notes/${note.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {note.dn_no}
                      </Link>
                      <span className="text-xs capitalize font-medium text-muted-foreground">
                        {String(note.status || "--").replace(/_/g, " ")}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">No linked delivery notes yet.</div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
