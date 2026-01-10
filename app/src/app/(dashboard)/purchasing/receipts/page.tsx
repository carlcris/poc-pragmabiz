"use client";

import { useState } from "react";
import { Search, Eye, Filter, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { usePurchaseReceipts, useDeletePurchaseReceipt } from "@/hooks/usePurchaseReceipts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { PurchaseReceiptViewDialog } from "@/components/purchase-receipts/PurchaseReceiptViewDialog";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { useCurrency } from "@/hooks/useCurrency";
import type { PurchaseReceipt, PurchaseReceiptStatus } from "@/types/purchase-receipt";
import { format } from "date-fns";

export default function PurchaseReceiptsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState<PurchaseReceiptStatus | "all">("all");
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<PurchaseReceipt | null>(null);

  // Action dialogs
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [receiptForAction, setReceiptForAction] = useState<PurchaseReceipt | null>(null);

  const { formatCurrency } = useCurrency();
  const deleteMutation = useDeletePurchaseReceipt();

  const { data, isLoading, error } = usePurchaseReceipts({
    search,
    status: statusFilter !== "all" ? statusFilter : undefined,
    page: 1,
    limit: 1000,
  });

  // Apply client-side filtering
  const filteredReceipts = data?.data || [];

  // Calculate pagination
  const total = filteredReceipts.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const receipts = filteredReceipts.slice(start, end);

  const pagination = {
    total,
    page,
    limit: pageSize,
    totalPages,
  };

  const getErrorMessage = (err: unknown, fallback: string) =>
    err instanceof Error ? err.message : fallback;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "received":
        return <Badge variant="default" className="bg-green-600">Received</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleViewReceipt = (receipt: PurchaseReceipt) => {
    setSelectedReceipt(receipt);
    setViewDialogOpen(true);
  };

  const handleDeleteReceipt = (receipt: PurchaseReceipt) => {
    setReceiptForAction(receipt);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!receiptForAction) return;
    try {
      await deleteMutation.mutateAsync(receiptForAction.id);
      toast.success("Receipt deleted successfully");
      setDeleteDialogOpen(false);
      setReceiptForAction(null);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete receipt"));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Purchase Receipts</h1>
          <p className="text-muted-foreground">
            Receive and manage incoming goods from purchase orders
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="mb-4 flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search receipts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
            <SelectTrigger className="w-[200px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="received">Received</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="text-center py-8 text-destructive">
            Error loading purchase receipts. Please try again.
          </div>
        ) : receipts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No purchase receipts found. Receive goods from approved purchase orders to get started.
          </div>
        ) : (
          <>
            <div className="max-h-[calc(100vh-400px)] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead>Receipt Code</TableHead>
                    <TableHead>Purchase Order</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead>Receipt Date</TableHead>
                    <TableHead className="text-right">Total Value</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receipts.map((receipt) => {
                    const totalValue = receipt.items?.reduce(
                      (sum, item) => {
                        const conversionFactor = item.packaging?.qtyPerPack ?? 1;
                        return sum + item.quantityReceived * conversionFactor * item.rate;
                      },
                      0
                    ) || 0;

                    return (
                      <TableRow key={receipt.id}>
                        <TableCell className="font-medium">
                          {receipt.receiptCode}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-blue-600">
                            {receipt.purchaseOrder?.orderCode}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{receipt.supplier?.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {receipt.supplier?.code}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {receipt.warehouse?.code}
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(new Date(receipt.receiptDate), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(totalValue)}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(receipt.status)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewReceipt(receipt)}
                              title="View"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {receipt.status === "draft" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteReceipt(receipt)}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {pagination && pagination.total > 0 && (
              <div className="mt-4">
                <DataTablePagination
                  currentPage={page}
                  totalPages={pagination.totalPages}
                  pageSize={pageSize}
                  totalItems={pagination.total}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* View Dialog */}
      <PurchaseReceiptViewDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        receipt={selectedReceipt}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Receipt</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {receiptForAction?.receiptCode}? This action cannot be
              undone. The receipt will be permanently removed from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
