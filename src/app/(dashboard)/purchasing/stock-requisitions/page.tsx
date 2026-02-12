"use client";

import { useState } from "react";
import { Plus, Search, Pencil, Filter, FileText, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import {
  useStockRequisitions,
  useDeleteStockRequisition,
} from "@/hooks/useStockRequisitions";
import { useSuppliers } from "@/hooks/useSuppliers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientOnly } from "@/components/shared/ClientOnly";
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
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { StockRequisitionFormDialog } from "@/components/stock-requisitions/StockRequisitionFormDialog";
import { useCurrency } from "@/hooks/useCurrency";
import type { StockRequisition, StockRequisitionStatus } from "@/types/stock-requisition";

export default function StockRequisitionsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSR, setSelectedSR] = useState<StockRequisition | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [srToDelete, setSRToDelete] = useState<StockRequisition | null>(null);

  const { formatCurrency } = useCurrency();
  const deleteMutation = useDeleteStockRequisition();

  const { data, isLoading, error } = useStockRequisitions({
    search,
    status: statusFilter !== "all" ? (statusFilter as StockRequisitionStatus) : undefined,
    supplierId: supplierFilter !== "all" ? supplierFilter : undefined,
    page,
    limit: pageSize,
  });

  const { data: suppliersData } = useSuppliers({ page: 1, limit: 1000 });
  const suppliers = suppliersData?.data || [];

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

  const handleCreateSR = () => {
    setSelectedSR(null);
    setDialogOpen(true);
  };

  const handleEditSR = (sr: StockRequisition) => {
    setSelectedSR(sr);
    setDialogOpen(true);
  };

  const handleViewSR = (sr: StockRequisition) => {
    router.push(`/purchasing/stock-requisitions/${sr.id}`);
  };

  const handleDeleteSR = (sr: StockRequisition) => {
    setSRToDelete(sr);
    setDeleteDialogOpen(true);
  };

  const getErrorMessage = (err: unknown, fallback: string) =>
    err instanceof Error ? err.message : fallback;

  const confirmDelete = async () => {
    if (!srToDelete) return;

    try {
      await deleteMutation.mutateAsync(srToDelete.id);
      toast.success("Stock Requisition deleted successfully");
      setDeleteDialogOpen(false);
      setSRToDelete(null);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete stock requisition"));
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl md:text-3xl whitespace-nowrap">
            Stock Requisitions
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base whitespace-nowrap">
            Manage stock requisitions for your suppliers
          </p>
        </div>
        <Button onClick={handleCreateSR} className="w-full sm:w-auto flex-shrink-0">
          <Plus className="mr-2 h-4 w-4" />
          <span className="sm:inline">Create Stock Requisition</span>
        </Button>
      </div>

      <div className="space-y-3 sm:space-y-4">
        <div className="mb-3 flex flex-col gap-2 sm:mb-4 sm:flex-row sm:gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by SR number or notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <ClientOnly fallback={<Skeleton className="h-10 w-full sm:w-[180px]" />}>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="partially_fulfilled">Partially Fulfilled</SelectItem>
                <SelectItem value="fulfilled">Fulfilled</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </ClientOnly>
          <ClientOnly fallback={<Skeleton className="h-10 w-full sm:w-[180px]" />}>
            <Select value={supplierFilter} onValueChange={(value) => setSupplierFilter(value)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Supplier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Suppliers</SelectItem>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ClientOnly>
        </div>

        {isLoading ? (
          <div className="max-h-[calc(100vh-400px)] overflow-auto rounded-md border">
            <Table className="min-w-[800px]">
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead>SR Number</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Requisition Date</TableHead>
                  <TableHead>Required By</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(8)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="ml-auto h-4 w-20" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Skeleton className="mx-auto h-5 w-20 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Skeleton className="h-8 w-8" />
                        <Skeleton className="h-8 w-8" />
                        <Skeleton className="h-8 w-8" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : error ? (
          <div className="py-8 text-center text-destructive">
            Error loading stock requisitions. Please try again.
          </div>
        ) : !data?.data || data.data.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No stock requisitions found. Create your first stock requisition to get started.
          </div>
        ) : (
          <>
            <div className="max-h-[calc(100vh-400px)] overflow-auto rounded-md border">
              <Table className="min-w-[800px]">
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead>SR Number</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Requisition Date</TableHead>
                    <TableHead>Required By</TableHead>
                    <TableHead className="text-right">Total Amount</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((sr) => (
                    <TableRow key={sr.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-blue-600" />
                          <div>
                            <div className="font-medium">{sr.srNumber}</div>
                            <div className="text-xs text-muted-foreground">
                              {sr.businessUnit?.code}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{sr.supplier?.name}</div>
                          <div className="text-xs text-muted-foreground">{sr.supplier?.code}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(sr.requisitionDate), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell>
                        {sr.requiredByDate
                          ? format(new Date(sr.requiredByDate), "MMM dd, yyyy")
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(sr.totalAmount)}
                      </TableCell>
                      <TableCell className="text-center">{getStatusBadge(sr.status)}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {sr.createdByUser
                            ? `${sr.createdByUser.firstName} ${sr.createdByUser.lastName}`
                            : "-"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(sr.createdAt), "MMM dd, yyyy")}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewSR(sr)}
                            className="h-8 w-8 p-0"
                            aria-label="View"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {sr.status === "draft" && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditSR(sr)}
                                className="h-8 w-8 p-0"
                                aria-label="Edit"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteSR(sr)}
                                className="h-8 w-8 p-0"
                                aria-label="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {data.pagination && data.pagination.total > 0 && (
              <div className="mt-4">
                <DataTablePagination
                  currentPage={page}
                  totalPages={data.pagination.totalPages}
                  pageSize={pageSize}
                  totalItems={data.pagination.total}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                />
              </div>
            )}
          </>
        )}
      </div>

      <StockRequisitionFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        stockRequisition={selectedSR}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Stock Requisition</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {srToDelete?.srNumber}? This action cannot be undone.
              The stock requisition will be permanently removed from the system.
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
