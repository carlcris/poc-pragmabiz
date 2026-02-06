"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Package, Pencil, Link as LinkIcon } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { useLoadList, useUpdateLoadListStatus } from "@/hooks/useLoadLists";
import { useCurrency } from "@/hooks/useCurrency";
import { LinkStockRequisitionsDialog } from "@/components/load-lists/LinkStockRequisitionsDialog";
import type { LoadListStatus } from "@/types/load-list";

export default function LoadListDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: ll, isLoading, error } = useLoadList(id);
  const updateStatusMutation = useUpdateLoadListStatus();
  const { formatCurrency } = useCurrency();

  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [inTransitDialogOpen, setInTransitDialogOpen] = useState(false);
  const [arrivedDialogOpen, setArrivedDialogOpen] = useState(false);
  const [receivedDialogOpen, setReceivedDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);

  const getStatusBadge = (status: LoadListStatus) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "confirmed":
        return (
          <Badge
            variant="outline"
            className="border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-400"
          >
            Confirmed
          </Badge>
        );
      case "in_transit":
        return (
          <Badge
            variant="outline"
            className="border-purple-600 text-purple-700 dark:border-purple-400 dark:text-purple-400"
          >
            In Transit
          </Badge>
        );
      case "arrived":
        return (
          <Badge
            variant="outline"
            className="border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-400"
          >
            Arrived
          </Badge>
        );
      case "receiving":
        return (
          <Badge
            variant="outline"
            className="border-amber-600 text-amber-700 dark:border-amber-400 dark:text-amber-400"
          >
            Receiving
          </Badge>
        );
      case "pending_approval":
        return (
          <Badge
            variant="outline"
            className="border-yellow-600 text-yellow-700 dark:border-yellow-400 dark:text-yellow-400"
          >
            Pending Approval
          </Badge>
        );
      case "received":
        return (
          <Badge
            variant="outline"
            className="border-green-600 text-green-700 dark:border-green-400 dark:text-green-400"
          >
            Received
          </Badge>
        );
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleStatusChange = async (newStatus: LoadListStatus, dialogSetter: (open: boolean) => void) => {
    try {
      await updateStatusMutation.mutateAsync({ id, status: newStatus });
      toast.success(`Load List marked as ${newStatus.replace(/_/g, " ")}`);
      dialogSetter(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update load list status");
    }
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "--";
    return format(new Date(dateString), "MMM dd, yyyy");
  };

  const formatUser = (user?: {
    firstName?: string;
    lastName?: string;
    email?: string;
  }) => {
    if (!user) return "--";
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
    return fullName || user.email || "--";
  };

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Load List</h1>
            <p className="text-muted-foreground">{ll?.llNumber || id}</p>
          </div>
        </div>
        {ll && (
          <div className="flex flex-wrap items-center gap-2">
            {ll.status === "draft" && (
              <>
                <Button variant="outline" onClick={() => router.push(`?edit=true`)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <Button onClick={() => setConfirmDialogOpen(true)}>Confirm</Button>
              </>
            )}
            {(ll.status === "confirmed" ||
              ll.status === "in_transit" ||
              ll.status === "arrived") && (
              <Button variant="outline" onClick={() => setLinkDialogOpen(true)}>
                <LinkIcon className="mr-2 h-4 w-4" />
                Link Stock Requisitions
              </Button>
            )}
            {ll.status === "confirmed" && (
              <Button onClick={() => setInTransitDialogOpen(true)}>Mark In Transit</Button>
            )}
            {ll.status === "in_transit" && (
              <Button onClick={() => setArrivedDialogOpen(true)}>Mark Arrived</Button>
            )}
            {ll.status === "pending_approval" && (
              <Button onClick={() => setReceivedDialogOpen(true)}>Mark Received</Button>
            )}
            {ll.status !== "cancelled" && ll.status !== "received" && (
              <Button
                variant="destructive"
                onClick={() => setCancelDialogOpen(true)}
                disabled={updateStatusMutation.isPending}
              >
                Cancel
              </Button>
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
            Failed to load load list.
          </CardContent>
        </Card>
      ) : !ll ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Load list not found.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Header Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Load List Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-sm">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <div className="mt-1">{getStatusBadge(ll.status)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Supplier:</span>
                    <div className="font-medium">
                      {ll.supplier?.name} ({ll.supplier?.code})
                    </div>
                    {ll.supplier?.contactPerson && (
                      <div className="text-xs text-muted-foreground">
                        Contact: {ll.supplier.contactPerson}
                      </div>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Warehouse:</span>
                    <div className="font-medium">
                      {ll.warehouse?.name} ({ll.warehouse?.code})
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Business Unit:</span>
                    <div className="font-medium">
                      {ll.businessUnit?.name || "--"} ({ll.businessUnit?.code || "--"})
                    </div>
                  </div>
                  {ll.supplierLlNumber && (
                    <div>
                      <span className="text-muted-foreground">Supplier LL Number:</span>
                      <div className="font-medium">{ll.supplierLlNumber}</div>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <span className="text-muted-foreground">Container Number:</span>
                    <div className="font-medium">{ll.containerNumber || "--"}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Seal Number:</span>
                    <div className="font-medium">{ll.sealNumber || "--"}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Batch Number:</span>
                    <div className="font-medium">{ll.batchNumber || "--"}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Load Date:</span>
                    <div className="font-medium">{formatDate(ll.loadDate)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Estimated Arrival:</span>
                    <div className="font-medium">{formatDate(ll.estimatedArrivalDate)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Actual Arrival:</span>
                    <div className="font-medium text-green-600">
                      {formatDate(ll.actualArrivalDate)}
                    </div>
                  </div>
                </div>
              </div>

              {ll.notes && (
                <div>
                  <span className="text-muted-foreground">Notes:</span>
                  <div className="font-medium mt-1">{ll.notes}</div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-6 pt-4 border-t">
                <div className="space-y-2">
                  <div>
                    <span className="text-muted-foreground">Created By:</span>
                    <div className="font-medium">{formatUser(ll.createdByUser)}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(ll.createdAt)}</div>
                  </div>
                  {ll.receivedBy && (
                    <div>
                      <span className="text-muted-foreground">Received By:</span>
                      <div className="font-medium">{formatUser(ll.receivedByUser)}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(ll.receivedDate)}
                      </div>
                    </div>
                  )}
                </div>
                {ll.approvedBy && (
                  <div>
                    <span className="text-muted-foreground">Approved By:</span>
                    <div className="font-medium">{formatUser(ll.approvedByUser)}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(ll.approvedDate)}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item Code</TableHead>
                      <TableHead>Item Name</TableHead>
                      <TableHead className="text-right">Load List Qty</TableHead>
                      <TableHead className="text-right">Received Qty</TableHead>
                      <TableHead className="text-right">Damaged Qty</TableHead>
                      <TableHead className="text-right">Shortage Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ll.items && ll.items.length > 0 ? (
                      ll.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.item?.code}</TableCell>
                          <TableCell>{item.item?.name}</TableCell>
                          <TableCell className="text-right">{item.loadListQty}</TableCell>
                          <TableCell className="text-right">
                            <span
                              className={item.receivedQty > 0 ? "text-green-600 font-medium" : ""}
                            >
                              {item.receivedQty}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={item.damagedQty > 0 ? "text-red-600 font-medium" : ""}>
                              {item.damagedQty}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={item.shortageQty > 0 ? "text-orange-600 font-medium" : ""}
                            >
                              {item.shortageQty}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.unitPrice)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(item.totalPrice)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          No line items found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Confirm Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Load List</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to confirm this load list? Once confirmed, items cannot be
              modified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleStatusChange("confirmed", setConfirmDialogOpen)}
              disabled={updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending ? "Confirming..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* In Transit Dialog */}
      <AlertDialog open={inTransitDialogOpen} onOpenChange={setInTransitDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as In Transit</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the load list as in transit and update inventory in-transit quantities.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleStatusChange("in_transit", setInTransitDialogOpen)}
              disabled={updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending ? "Updating..." : "Mark In Transit"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Arrived Dialog */}
      <AlertDialog open={arrivedDialogOpen} onOpenChange={setArrivedDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as Arrived</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the load list as arrived at the warehouse. You can then proceed with
              receiving.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleStatusChange("arrived", setArrivedDialogOpen)}
              disabled={updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending ? "Updating..." : "Mark Arrived"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Received Dialog */}
      <AlertDialog open={receivedDialogOpen} onOpenChange={setReceivedDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as Received</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the load list as received and update inventory stock levels. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleStatusChange("received", setReceivedDialogOpen)}
              disabled={updateStatusMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {updateStatusMutation.isPending ? "Updating..." : "Mark Received"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Load List</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this load list? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, go back</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleStatusChange("cancelled", setCancelDialogOpen)}
              disabled={updateStatusMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {updateStatusMutation.isPending ? "Cancelling..." : "Yes, cancel"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Link Stock Requisitions Dialog */}
      {ll && (
      <LinkStockRequisitionsDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        loadList={ll}
      />
      )}
    </div>
  );
}
