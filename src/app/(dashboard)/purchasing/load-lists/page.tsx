"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Plus, Search, Pencil, Filter, Package, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { useLoadLists, useDeleteLoadList } from "@/hooks/useLoadLists";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useWarehouses } from "@/hooks/useWarehouses";
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
import { EmptyStatePanel } from "@/components/shared/EmptyStatePanel";
import type { LoadList, LoadListStatus } from "@/types/load-list";

const LoadListFormDialog = dynamic(
  () => import("@/components/load-lists/LoadListFormDialog").then((mod) => mod.LoadListFormDialog),
  { ssr: false }
);

export default function LoadListsPage() {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedLL, setSelectedLL] = useState<LoadList | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [llToDelete, setLLToDelete] = useState<LoadList | null>(null);

  const deleteMutation = useDeleteLoadList();

  const { data, isLoading, error } = useLoadLists({
    search,
    status: statusFilter !== "all" ? (statusFilter as LoadListStatus) : undefined,
    supplierId: supplierFilter !== "all" ? supplierFilter : undefined,
    warehouseId: warehouseFilter !== "all" ? warehouseFilter : undefined,
    page,
    limit: pageSize,
  });

  const { data: suppliersData } = useSuppliers({ page: 1, limit: 50 });
  const suppliers = suppliersData?.data || [];

  const { data: warehousesData } = useWarehouses({ page: 1, limit: 50 });
  const warehouses = warehousesData?.data || [];

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

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

  const handleCreateLL = () => {
    setSelectedLL(null);
    setDialogOpen(true);
  };

  const handleEditLL = (ll: LoadList) => {
    setSelectedLL(ll);
    setDialogOpen(true);
  };

  const handleViewLL = (ll: LoadList) => {
    router.push(`/purchasing/load-lists/${ll.id}`);
  };

  const handleDeleteLL = (ll: LoadList) => {
    setLLToDelete(ll);
    setDeleteDialogOpen(true);
  };

  const getErrorMessage = (err: unknown, fallback: string) =>
    err instanceof Error ? err.message : fallback;

  const confirmDelete = async () => {
    if (!llToDelete) return;

    try {
      await deleteMutation.mutateAsync(llToDelete.id);
      toast.success("Load List deleted successfully");
      setDeleteDialogOpen(false);
      setLLToDelete(null);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete load list"));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight whitespace-nowrap">Load Lists</h1>
          <p className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">Manage supplier shipments and deliveries</p>
        </div>
        <Button onClick={handleCreateLL} className="w-full sm:w-auto flex-shrink-0">
          <Plus className="mr-2 h-4 w-4" />
          Create Load List
        </Button>
      </div>

      <div className="space-y-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative w-full sm:flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by LL number, container, seal, batch..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-8"
            />
          </div>
          <ClientOnly fallback={<Skeleton className="h-10 w-full sm:w-[200px]" />}>
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="in_transit">In Transit</SelectItem>
                <SelectItem value="arrived">Arrived</SelectItem>
                <SelectItem value="receiving">Receiving</SelectItem>
                <SelectItem value="pending_approval">Pending Approval</SelectItem>
                <SelectItem value="received">Received</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </ClientOnly>
          <ClientOnly fallback={<Skeleton className="h-10 w-full sm:w-[200px]" />}>
            <Select
              value={supplierFilter}
              onValueChange={(value) => {
                setSupplierFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
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
          <ClientOnly fallback={<Skeleton className="h-10 w-full sm:w-[200px]" />}>
            <Select
              value={warehouseFilter}
              onValueChange={(value) => {
                setWarehouseFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
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
          </ClientOnly>
        </div>

        {isLoading ? (
          <div className="max-h-[calc(100vh-400px)] overflow-y-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead>LL Number</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Container / Seal</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Arrival Date</TableHead>
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
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
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
            Error loading load lists. Please try again.
          </div>
        ) : !data?.data || data.data.length === 0 ? (
          <EmptyStatePanel
            icon={Package}
            title="No load lists found"
            description="Create your first load list to get started."
          />
        ) : (
          <>
            <div className="max-h-[calc(100vh-400px)] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead>LL Number</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead>Container / Seal</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Arrival Date</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((ll) => (
                    <TableRow key={ll.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-blue-600" />
                          <div>
                            <div className="font-medium">{ll.llNumber}</div>
                            {ll.supplierLlNumber && (
                              <div className="text-xs text-muted-foreground">
                                Supplier: {ll.supplierLlNumber}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{ll.supplier?.name}</div>
                          <div className="text-xs text-muted-foreground">{ll.supplier?.code}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{ll.warehouse?.name}</div>
                          <div className="text-xs text-muted-foreground">{ll.warehouse?.code}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {(!ll.containerNumber && !ll.sealNumber) ? (
                            "-"
                          ) : (
                            <div>{ll.containerNumber ?? "-"} / {ll.sealNumber ?? "-"}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{ll.batchNumber || "-"}</div>
                      </TableCell>
                      <TableCell>
                        <div>
                          {ll.estimatedArrivalDate && (
                            <div className="text-sm">
                              Est: {format(new Date(ll.estimatedArrivalDate), "MMM dd, yyyy")}
                            </div>
                          )}
                          {ll.actualArrivalDate && (
                            <div className="text-sm font-medium text-green-600">
                              Act: {format(new Date(ll.actualArrivalDate), "MMM dd, yyyy")}
                            </div>
                          )}
                          {!ll.estimatedArrivalDate && !ll.actualArrivalDate && "-"}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{getStatusBadge(ll.status)}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {ll.createdByUser
                            ? `${ll.createdByUser.firstName} ${ll.createdByUser.lastName}`
                            : "-"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(ll.createdAt), "MMM dd, yyyy")}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleViewLL(ll)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {(ll.status === "draft" || ll.status === "confirmed") && (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => handleEditLL(ll)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDeleteLL(ll)}>
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

      {dialogOpen && (
        <LoadListFormDialog open={dialogOpen} onOpenChange={setDialogOpen} loadList={selectedLL} />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Load List</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {llToDelete?.llNumber}? This action cannot be undone.
              The load list will be permanently removed from the system.
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
