"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, FileText, Pencil, Download } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { generateStockRequisitionPDF } from "@/lib/pdf-generator";
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
import {
  useStockRequisition,
  useUpdateStockRequisitionStatus,
} from "@/hooks/useStockRequisitions";
import { useCurrency } from "@/hooks/useCurrency";
import type { StockRequisitionStatus } from "@/types/stock-requisition";

export default function StockRequisitionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: sr, isLoading, error } = useStockRequisition(id);
  const updateStatusMutation = useUpdateStockRequisitionStatus();
  const { formatCurrency } = useCurrency();

  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const getStatusBadge = (status: StockRequisitionStatus) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "submitted":
        return (
          <Badge
            variant="outline"
            className="border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-400"
          >
            Submitted
          </Badge>
        );
      case "partially_fulfilled":
        return (
          <Badge
            variant="outline"
            className="border-yellow-600 text-yellow-700 dark:border-yellow-400 dark:text-yellow-400"
          >
            Partially Fulfilled
          </Badge>
        );
      case "fulfilled":
        return (
          <Badge
            variant="outline"
            className="border-green-600 text-green-700 dark:border-green-400 dark:text-green-400"
          >
            Fulfilled
          </Badge>
        );
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleSubmit = async () => {
    try {
      await updateStatusMutation.mutateAsync({ id, status: "submitted" });
      toast.success("Stock Requisition submitted successfully");
      setSubmitDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit stock requisition");
    }
  };

  const handleCancel = async () => {
    try {
      await updateStatusMutation.mutateAsync({ id, status: "cancelled" });
      toast.success("Stock Requisition cancelled successfully");
      setCancelDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel stock requisition");
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

  const handleDownloadPDF = async () => {
    if (!sr) return;

    try {
      await generateStockRequisitionPDF({
        srNumber: sr.srNumber,
        supplierName: sr.supplier?.name || "Unknown Supplier",
        requisitionDate: formatDate(sr.requisitionDate),
        requiredByDate: sr.requiredByDate ? formatDate(sr.requiredByDate) : undefined,
        totalAmount: formatCurrency(sr.totalAmount),
        items: (sr.items || []).map((item) => ({
          itemCode: item.item?.code || "N/A",
          itemName: item.item?.name || "Unknown Item",
          requestedQty: item.requestedQty,
          unitPrice: formatCurrency(item.unitPrice),
          totalPrice: formatCurrency(item.totalPrice),
        })),
        notes: sr.notes || undefined,
        createdBy: formatUser(sr.createdByUser),
        businessUnit: sr.businessUnit?.name
          ? `${sr.businessUnit.name} (${sr.businessUnit.code || ""})`
          : undefined,
      });
      toast.success("PDF downloaded successfully");
    } catch (error) {
      console.error("Failed to generate PDF:", error);
      toast.error("Failed to generate PDF");
    }
  };

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Stock Requisition</h1>
            <p className="text-muted-foreground">{sr?.srNumber || id}</p>
          </div>
        </div>
        {sr && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={handleDownloadPDF}>
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
            {sr.status === "draft" && (
              <>
                <Button variant="outline" onClick={() => router.push(`?edit=true`)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <Button onClick={() => setSubmitDialogOpen(true)}>Send</Button>
              </>
            )}
            {sr.status !== "cancelled" && sr.status !== "fulfilled" && (
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
            Failed to load stock requisition.
          </CardContent>
        </Card>
      ) : !sr ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Stock requisition not found.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Header Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Requisition Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-sm">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <div className="mt-1">{getStatusBadge(sr.status)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Supplier:</span>
                    <div className="font-medium">
                      {sr.supplier?.name} ({sr.supplier?.code})
                    </div>
                    {sr.supplier?.contactPerson && (
                      <div className="text-xs text-muted-foreground">
                        Contact: {sr.supplier.contactPerson}
                      </div>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Business Unit:</span>
                    <div className="font-medium">
                      {sr.businessUnit?.name || "--"} ({sr.businessUnit?.code || "--"})
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Created By:</span>
                    <div className="font-medium">{formatUser(sr.createdByUser)}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(sr.createdAt)}</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <span className="text-muted-foreground">Requisition Date:</span>
                    <div className="font-medium">{formatDate(sr.requisitionDate)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Required By Date:</span>
                    <div className="font-medium">{formatDate(sr.requiredByDate)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Amount:</span>
                    <div className="text-lg font-bold text-primary">
                      {formatCurrency(sr.totalAmount)}
                    </div>
                  </div>
                  {sr.notes && (
                    <div>
                      <span className="text-muted-foreground">Notes:</span>
                      <div className="font-medium">{sr.notes}</div>
                    </div>
                  )}
                </div>
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
                      <TableHead className="text-right">Requested Qty</TableHead>
                      <TableHead className="text-right">Fulfilled Qty</TableHead>
                      <TableHead className="text-right">Outstanding Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sr.items && sr.items.length > 0 ? (
                      sr.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.item?.code}</TableCell>
                          <TableCell>{item.item?.name}</TableCell>
                          <TableCell className="text-right">{item.requestedQty}</TableCell>
                          <TableCell className="text-right">
                            <span
                              className={item.fulfilledQty > 0 ? "text-green-600 font-medium" : ""}
                            >
                              {item.fulfilledQty}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={
                                item.outstandingQty > 0 ? "text-orange-600 font-medium" : ""
                              }
                            >
                              {item.outstandingQty}
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
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
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

      {/* Submit Confirmation Dialog */}
      <AlertDialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Stock Requisition</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to send this stock requisition? Once sent, it cannot
              be edited.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button onClick={handleSubmit} disabled={updateStatusMutation.isPending}>
              {updateStatusMutation.isPending ? "Sending..." : "Send"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Stock Requisition</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this stock requisition? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, go back</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={updateStatusMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {updateStatusMutation.isPending ? "Cancelling..." : "Yes, cancel"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
