"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";
import {
  useApproveStockRequest,
  useRejectStockRequest,
  useStockRequest,
} from "@/hooks/useStockRequests";
import type { StockRequestStatus } from "@/types/stock-request";

const formatDate = (dateString?: string | null) => {
  if (!dateString) return "--";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatUser = (user?: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}) => {
  if (!user) return "--";
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ");
  return fullName || user.email || "--";
};

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

export default function StockRequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: request, isLoading, error } = useStockRequest(id);
  const currentBusinessUnit = useBusinessUnitStore((state) => state.currentBusinessUnit);

  const approveMutation = useApproveStockRequest();
  const rejectMutation = useRejectStockRequest();

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const canFulfillRequest = useMemo(() => {
    if (!currentBusinessUnit?.id || !request?.fulfilling_warehouse?.businessUnitId) return false;
    return request.fulfilling_warehouse.businessUnitId === currentBusinessUnit.id;
  }, [currentBusinessUnit?.id, request?.fulfilling_warehouse?.businessUnitId]);

  const handleApprove = async () => {
    if (!request) return;
    await approveMutation.mutateAsync(request.id);
  };

  const handleReject = async () => {
    if (!request) return;
    await rejectMutation.mutateAsync({ id: request.id, reason: rejectReason });
    setRejectDialogOpen(false);
    setRejectReason("");
  };

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Stock Request</h1>
            <p className="text-muted-foreground">{request?.request_code || id}</p>
          </div>
        </div>
        {request && (
          <div className="flex flex-wrap items-center gap-2">
            {request.status === "submitted" && canFulfillRequest && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setRejectDialogOpen(true)}
                  disabled={rejectMutation.isPending}
                >
                  Reject
                </Button>
                <Button onClick={handleApprove} disabled={approveMutation.isPending}>
                  Approve
                </Button>
              </>
            )}
            <Button
              variant="outline"
              onClick={() => router.push("/inventory/delivery-notes")}
              disabled={!canFulfillRequest}
            >
              Open Delivery Notes
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="h-24 animate-pulse rounded bg-muted" />
          <div className="h-64 animate-pulse rounded bg-muted" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-8 text-center text-destructive">
            Failed to load stock request.
          </CardContent>
        </Card>
      ) : !request ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Stock request not found.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Request Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-sm">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <div>{getStatusLabel(request.status)}</div>
                  </div>
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
                    <span className="text-muted-foreground">Fulfilling Delivery Notes:</span>
                    <div className="font-medium">
                      {(request.fulfilling_delivery_notes || []).length > 0 ? (
                        <div className="space-y-1">
                          {(request.fulfilling_delivery_notes || []).map((note) => (
                            <div key={note.id} className="flex items-center gap-2">
                              <Link
                                href={`/inventory/delivery-notes/${note.id}`}
                                className="text-blue-600 hover:underline"
                              >
                                {note.dn_no}
                              </Link>
                              <span className="text-xs text-muted-foreground">
                                {String(note.status || "--").replace(/_/g, " ")}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        "--"
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Requested By:</span>
                    <div className="font-medium">{formatUser(request.requested_by_user)}</div>
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
                    <div className="font-medium">{formatDate(request.received_at)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Received By:</span>
                    <div className="font-medium">{formatUser(request.received_by_user)}</div>
                  </div>
                </div>
              </div>

              {(request.purpose || request.notes) && (
                <div className="grid grid-cols-2 gap-6">
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        </>
      )}

      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Stock Request</AlertDialogTitle>
            <AlertDialogDescription>
              Provide a reason for rejecting this request.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Reason"
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              className="bg-destructive hover:bg-destructive/90"
              disabled={!rejectReason.trim() || rejectMutation.isPending}
            >
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
