"use client";

import { useState } from "react";
import { Plus, Search, Pencil, Filter, Package, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useSuppliers, useDeleteSupplier } from "@/hooks/useSuppliers";
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
import { SupplierFormDialog } from "@/components/suppliers/SupplierFormDialog";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { useCurrency } from "@/hooks/useCurrency";
import type { Supplier } from "@/types/supplier";

export default function SuppliersPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);

  const { formatCurrency } = useCurrency();
  const deleteMutation = useDeleteSupplier();

  const { data, isLoading, error } = useSuppliers({
    search,
    page: 1,
    limit: 1000, // Get all for client-side filtering
  });

  // Apply client-side filters
  let filteredSuppliers = data?.data || [];

  if (statusFilter !== "all") {
    filteredSuppliers = filteredSuppliers.filter((s) => s.status === statusFilter);
  }

  // Calculate pagination
  const total = filteredSuppliers.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const suppliers = filteredSuppliers.slice(start, end);

  const pagination = {
    total,
    page,
    limit: pageSize,
    totalPages,
  };

  const getStatusBadge = (status: Supplier["status"]) => {
    switch (status) {
      case "active":
        return (
          <Badge
            variant="outline"
            className="border-green-600 text-green-700 dark:border-green-400 dark:text-green-400"
          >
            Active
          </Badge>
        );
      case "inactive":
        return <Badge variant="secondary">Inactive</Badge>;
      case "blacklisted":
        return <Badge variant="destructive">Blacklisted</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPaymentTermsLabel = (terms: string) => {
    const labels: Record<string, string> = {
      cod: "COD",
      net_7: "Net 7",
      net_15: "Net 15",
      net_30: "Net 30",
      net_45: "Net 45",
      net_60: "Net 60",
      net_90: "Net 90",
    };
    return labels[terms] || terms;
  };

  const handleCreateSupplier = () => {
    setSelectedSupplier(null);
    setDialogOpen(true);
  };

  const handleEditSupplier = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setDialogOpen(true);
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleDeleteSupplier = (supplier: Supplier) => {
    setSupplierToDelete(supplier);
    setDeleteDialogOpen(true);
  };

  const getErrorMessage = (err: unknown, fallback: string) =>
    err instanceof Error ? err.message : fallback;

  const confirmDelete = async () => {
    if (!supplierToDelete) return;

    try {
      await deleteMutation.mutateAsync(supplierToDelete.id);
      toast.success("Supplier deleted successfully");
      setDeleteDialogOpen(false);
      setSupplierToDelete(null);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete supplier"));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Supplier Master</h1>
          <p className="text-muted-foreground">
            Manage your supplier accounts and vendor relationships
          </p>
        </div>
        <Button onClick={handleCreateSupplier}>
          <Plus className="mr-2 h-4 w-4" />
          Create Supplier
        </Button>
      </div>

      <div className="space-y-4">
        <div className="mb-4 flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search suppliers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
            <SelectTrigger className="w-[180px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="blacklisted">Blacklisted</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="py-8 text-center text-destructive">
            Error loading suppliers. Please try again.
          </div>
        ) : suppliers.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No suppliers found. Create your first supplier to get started.
          </div>
        ) : (
          <>
            <div className="max-h-[calc(100vh-400px)] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Contact Person</TableHead>
                    <TableHead>Contact Info</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Payment Terms</TableHead>
                    <TableHead className="text-right">Credit Limit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((supplier) => (
                    <TableRow key={supplier.id}>
                      <TableCell className="font-medium">{supplier.code}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-blue-600" />
                          <div>
                            <div className="font-medium">{supplier.name}</div>
                            <div className="text-xs text-muted-foreground">{supplier.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{supplier.contactPerson}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{supplier.phone}</div>
                        {supplier.mobile && (
                          <div className="text-xs text-muted-foreground">{supplier.mobile}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {supplier.billingCity}, {supplier.billingState}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {supplier.billingCountry}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getPaymentTermsLabel(supplier.paymentTerms)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {supplier.creditLimit ? formatCurrency(supplier.creditLimit) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            supplier.currentBalance > 0 ? "font-medium text-orange-600" : ""
                          }
                        >
                          {formatCurrency(supplier.currentBalance)}
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(supplier.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditSupplier(supplier)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteSupplier(supplier)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
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

      <SupplierFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        supplier={selectedSupplier}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Supplier</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {supplierToDelete?.name}? This action cannot be
              undone. The supplier will be permanently removed from the system.
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
