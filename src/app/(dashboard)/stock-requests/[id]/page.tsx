"use client";

import { useMemo, useState } from "react";
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
  useMarkDelivered,
  useMarkReadyForPick,
  useRejectStockRequest,
  useStockRequest,
} from "@/hooks/useStockRequests";
import { ReceiveStockRequestDialog } from "@/components/stock-requests/ReceiveStockRequestDialog";
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

export default function StockRequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: request, isLoading, error } = useStockRequest(id);
  const currentBusinessUnit = useBusinessUnitStore((state) => state.currentBusinessUnit);

  const approveMutation = useApproveStockRequest();
  const rejectMutation = useRejectStockRequest();
  const readyForPickMutation = useMarkReadyForPick();
  const deliveredMutation = useMarkDelivered();

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);

  const canFulfillRequest = useMemo(() => {
    if (!currentBusinessUnit?.id || !request?.to_location?.businessUnitId) return false;
    return request.to_location.businessUnitId === currentBusinessUnit.id;
  }, [currentBusinessUnit?.id, request?.to_location?.businessUnitId]);

  const canReceiveRequest = useMemo(() => {
    if (!currentBusinessUnit?.id || !request?.from_location?.businessUnitId) return false;
    return request.from_location.businessUnitId === currentBusinessUnit.id;
  }, [currentBusinessUnit?.id, request?.from_location?.businessUnitId]);

  const handleApprove = async () => {
    if (!request) return;
    await approveMutation.mutateAsync(request.id);
  };

  const handleReadyForPick = async () => {
    if (!request) return;
    await readyForPickMutation.mutateAsync(request.id);
  };

  const handleDeliver = async () => {
    if (!request) return;
    await deliveredMutation.mutateAsync(request.id);
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
            {request.status === "approved" && canFulfillRequest && (
              <Button onClick={handleReadyForPick} disabled={readyForPickMutation.isPending}>
                Ready to Pick
              </Button>
            )}
            {request.status === "ready_for_pick" && canFulfillRequest && (
              <Button onClick={handleDeliver} disabled={deliveredMutation.isPending}>
                Mark Delivered
              </Button>
            )}
            {(request.status === "delivered" || request.status === "picked") &&
              canReceiveRequest && (
                <Button onClick={() => setReceiveDialogOpen(true)}>Receive</Button>
              )}
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
                      {request.from_location?.warehouse_code
                        ? `${request.from_location.warehouse_code} - ${request.from_location.warehouse_name}`
                        : "--"}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Requested To:</span>
                    <div className="font-medium">
                      {request.to_location?.warehouse_code
                        ? `${request.to_location.warehouse_code} - ${request.to_location.warehouse_name}`
                        : "--"}
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
                        <td colSpan={4} className="p-3 text-center text-muted-foreground">
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

      <ReceiveStockRequestDialog
        open={receiveDialogOpen}
        onOpenChange={setReceiveDialogOpen}
        stockRequest={request || null}
      />

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
