"use client";

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
    case "ready_for_pick":
      return <span className={`${baseClass} text-purple-600`}>Ready for Pick</span>;
    case "picked":
    case "delivered":
      return <span className={`${baseClass} text-indigo-600`}>Delivered</span>;
    case "received":
      return <span className={`${baseClass} text-emerald-600`}>Received</span>;
    case "completed":
      return <span className={`${baseClass} text-emerald-600`}>Completed</span>;
    case "cancelled":
      return <span className={`${baseClass} text-red-600`}>Cancelled</span>;
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
  request,
}: StockRequestViewDialogProps) {
  if (!request) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
                <span className="text-muted-foreground">From Location:</span>
                <div className="font-medium">
                  {request.from_location?.warehouse_code
                    ? `${request.from_location.warehouse_code} - ${request.from_location.warehouse_name}`
                    : "--"}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">To Location:</span>
                <div className="font-medium">
                  {request.to_location?.warehouse_code
                    ? `${request.to_location.warehouse_code} - ${request.to_location.warehouse_name}`
                    : "--"}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Requested By:</span>
                <div className="font-medium">
                  {request.requested_by_user?.full_name ||
                    request.requested_by_user?.email ||
                    "--"}
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
                  {request.received_by_user?.full_name ||
                    request.received_by_user?.email ||
                    "--"}
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
            <h3 className="text-sm font-semibold mb-3">Line Items</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3">Item</th>
                    <th className="text-right p-3">Quantity</th>
                    <th className="text-left p-3">Package</th>
                    <th className="text-left p-3">Notes</th>
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
                      <td className="p-3 text-right">
                        {item.requested_qty.toFixed(2)}
                      </td>
                      <td className="p-3">
                        <span className="text-muted-foreground">
                          {item.packaging?.name || "--"}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="text-muted-foreground">
                          {item.notes || "--"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(!request.stock_request_items || request.stock_request_items.length === 0) && (
                    <tr className="border-t">
                      <td colSpan={4} className="p-3 text-center text-muted-foreground">
                        No items found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
