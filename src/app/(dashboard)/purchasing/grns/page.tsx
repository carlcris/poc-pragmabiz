"use client";

import { useState } from "react";
import { Search, Filter, Package, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { useGRNs, useDeleteGRN } from "@/hooks/useGRNs";
import { useWarehouses } from "@/hooks/useWarehouses";
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
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import type { GRN, GRNStatus } from "@/types/grn";

export default function GRNsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [grnToDelete, setGRNToDelete] = useState<GRN | null>(null);

  const deleteMutation = useDeleteGRN();

  const { data, isLoading, error } = useGRNs({
    search,
    status: statusFilter !== "all" ? (statusFilter as GRNStatus) : undefined,
    warehouseId: warehouseFilter !== "all" ? warehouseFilter : undefined,
    page,
    limit: pageSize,
  });

  const { data: warehousesData } = useWarehouses({ page: 1, limit: 1000 });
  const warehouses = warehousesData?.data || [];

  const getStatusBadge = (status: GRNStatus) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
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
      case "approved":
        return (
          <Badge
            variant="outline"
            className="border-green-600 text-green-700 dark:border-green-400 dark:text-green-400"
          >
            Approved
          </Badge>
        );
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleViewGRN = (grn: GRN) => {
    router.push(`/purchasing/grns/${grn.id}`);
  };

  const handleDeleteGRN = (grn: GRN) => {
    setGRNToDelete(grn);
    setDeleteDialogOpen(true);
  };

  const getErrorMessage = (err: unknown, fallback: string) =>
    err instanceof Error ? err.message : fallback;

  const confirmDelete = async () => {
    if (!grnToDelete) return;

    try {
      await deleteMutation.mutateAsync(grnToDelete.id);
      toast.success("GRN deleted successfully");
      setDeleteDialogOpen(false);
      setGRNToDelete(null);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete GRN"));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Goods Receipt Notes</h1>
          <p className="text-muted-foreground">Manage warehouse receiving and stock entry</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="mb-4 flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by GRN number, container, seal number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value)}>
            <SelectTrigger className="w-[200px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="receiving">Receiving</SelectItem>
              <SelectItem value="pending_approval">Pending Approval</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={warehouseFilter} onValueChange={(value) => setWarehouseFilter(value)}>
            <SelectTrigger className="w-[200px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Warehouse" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Warehouses</SelectItem>
              {warehouses.map((warehouse) => (
                <SelectItem key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="py-8 text-center text-destructive">
            Error loading GRNs. Please try again.
          </div>
        ) : !data?.data || data.data.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No GRNs found. GRNs are automatically created when load lists arrive.
          </div>
        ) : (
          <>
            <div className="max-h-[calc(100vh-400px)] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead>GRN Number</TableHead>
                    <TableHead>Load List</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead>Container / Seal</TableHead>
                    <TableHead>Receiving Date</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead>Received By</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((grn) => (
                    <TableRow key={grn.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-green-600" />
                          <div className="font-medium">{grn.grnNumber}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          {grn.loadList && (
                            <>
                              <div className="font-medium">{grn.loadList.llNumber}</div>
                              {grn.loadList.supplierLlNumber && (
                                <div className="text-xs text-muted-foreground">
                                  Supplier: {grn.loadList.supplierLlNumber}
                                </div>
                              )}
                            </>
                          )}
                          {!grn.loadList && "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        {grn.loadList?.supplier ? (
                          <div>
                            <div className="font-medium">{grn.loadList.supplier.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {grn.loadList.supplier.code}
                            </div>
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {grn.warehouse ? (
                          <div>
                            <div className="font-medium">{grn.warehouse.name}</div>
                            <div className="text-xs text-muted-foreground">{grn.warehouse.code}</div>
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {(!grn.containerNumber && !grn.sealNumber) ? (
                            "-"
                          ) : (
                            <div>{grn.containerNumber ?? "-"} / {grn.sealNumber ?? "-"}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {grn.receivingDate ? (
                          <div className="text-sm">
                            {format(new Date(grn.receivingDate), "MMM dd, yyyy")}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">Not started</div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">{getStatusBadge(grn.status)}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {grn.receivedByUser
                            ? `${grn.receivedByUser.firstName} ${grn.receivedByUser.lastName}`
                            : "-"}
                        </div>
                        {grn.receivingDate && (
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(grn.receivingDate), "MMM dd, yyyy")}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleViewGRN(grn)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {grn.status === "draft" && (
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteGRN(grn)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete GRN</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {grnToDelete?.grnNumber}? This action cannot be
              undone. The GRN will be permanently removed from the system.
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
