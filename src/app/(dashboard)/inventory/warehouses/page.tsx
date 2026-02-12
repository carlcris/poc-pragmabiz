"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, Pencil, MapPin, Filter, Trash2 } from "lucide-react";
import { useWarehouses, useDeleteWarehouse } from "@/hooks/useWarehouses";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { WarehouseFormDialog } from "@/components/warehouses/WarehouseFormDialog";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ViewGuard } from "@/components/permissions/PermissionGuard";
import { RESOURCES } from "@/constants/resources";
import type { Warehouse } from "@/types/warehouse";

export default function WarehousesPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [warehouseToDelete, setWarehouseToDelete] = useState<Warehouse | null>(null);

  const deleteWarehouse = useDeleteWarehouse();

  const { data, isLoading, error } = useWarehouses({
    search,
    page: 1,
    limit: 1000, // Get all warehouses for client-side filtering
  });

  // Get all warehouses for filtering
  const allWarehouses = data?.data || [];

  // Extract unique countries from actual data
  const uniqueCountries = Array.from(
    new Set(allWarehouses.map((wh) => wh.country).filter(Boolean))
  ).sort();

  // Apply client-side filters
  let filteredWarehouses = allWarehouses;

  if (countryFilter !== "all") {
    filteredWarehouses = filteredWarehouses.filter((wh) => wh.country === countryFilter);
  }

  if (statusFilter === "active") {
    filteredWarehouses = filteredWarehouses.filter((wh) => wh.isActive);
  } else if (statusFilter === "inactive") {
    filteredWarehouses = filteredWarehouses.filter((wh) => !wh.isActive);
  }

  // Calculate pagination
  const total = filteredWarehouses.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const warehouses = filteredWarehouses.slice(start, end);

  const pagination = {
    total,
    page,
    limit: pageSize,
    totalPages,
  };

  const handleCreateWarehouse = () => {
    setSelectedWarehouse(null);
    setDialogOpen(true);
  };

  const handleEditWarehouse = (warehouse: Warehouse) => {
    setSelectedWarehouse(warehouse);
    setDialogOpen(true);
  };

  const handleDeleteWarehouse = (warehouse: Warehouse) => {
    setWarehouseToDelete(warehouse);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!warehouseToDelete) return;

    try {
      await deleteWarehouse.mutateAsync(warehouseToDelete.id);
      toast.success("Warehouse deleted successfully");
      setWarehouseToDelete(null);
    } catch {
      toast.error("Failed to delete warehouse");
    }
  };

  const handleCountryFilterChange = (value: string) => {
    setCountryFilter(value);
    setPage(1);
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  return (
    <div className="flex h-full flex-col gap-4 sm:gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl md:text-3xl whitespace-nowrap">Warehouse Management</h1>
          <p className="text-sm text-muted-foreground sm:text-base whitespace-nowrap">Manage warehouse locations and storage facilities</p>
        </div>
        <Button onClick={handleCreateWarehouse} className="w-full sm:w-auto flex-shrink-0">
          <Plus className="mr-2 h-4 w-4" />
          <span className="sm:inline">Create Warehouse</span>
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 sm:gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search warehouses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={countryFilter} onValueChange={handleCountryFilterChange}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Country" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Countries</SelectItem>
              {uniqueCountries.map((country) => (
                <SelectItem key={country} value={country}>
                  {country}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="min-h-0 flex-1">
          {isLoading ? (
            <div className="h-full overflow-auto overscroll-contain rounded-md border">
              <Table className="min-w-[800px]">
                <TableHeader className="sticky top-0 z-10 bg-background shadow-sm [&_th]:bg-background">
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Manager</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...Array(8)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-4 w-4 rounded-full" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-36" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Skeleton className="h-8 w-20" />
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
            <div className="flex h-full items-center justify-center text-center text-destructive">
              Error loading warehouses. Please try again.
            </div>
          ) : warehouses.length === 0 ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              No warehouses found
            </div>
          ) : (
            <div className="h-full overflow-auto overscroll-contain rounded-md border">
              <Table className="min-w-[800px]">
                <TableHeader className="sticky top-0 z-10 bg-background shadow-sm [&_th]:bg-background">
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Manager</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {warehouses.map((warehouse) => (
                    <TableRow key={warehouse.id}>
                      <TableCell className="font-medium">{warehouse.code}</TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                          {warehouse.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {warehouse.city}, {warehouse.state}
                        </div>
                        <div className="text-xs text-muted-foreground">{warehouse.country}</div>
                      </TableCell>
                      <TableCell>{warehouse.managerName || "-"}</TableCell>
                      <TableCell>
                        <div className="text-sm">{warehouse.phone}</div>
                        <div className="text-xs text-muted-foreground">{warehouse.email}</div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={warehouse.isActive ? "outline" : "secondary"}
                          className={
                            warehouse.isActive
                              ? "border-green-600 text-green-700 dark:border-green-400 dark:text-green-400"
                              : ""
                          }
                        >
                          {warehouse.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <ViewGuard resource={RESOURCES.MANAGE_LOCATIONS}>
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/inventory/warehouses/${warehouse.id}/locations`}>
                                Locations
                              </Link>
                            </Button>
                          </ViewGuard>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditWarehouse(warehouse)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteWarehouse(warehouse)}
                            disabled={deleteWarehouse.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {pagination && pagination.total > 0 && (
          <div className="shrink-0">
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
      </div>

      <WarehouseFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        warehouse={selectedWarehouse}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Delete Warehouse"
        description={
          warehouseToDelete
            ? `Are you sure you want to delete "${warehouseToDelete.name}"? This action cannot be undone.`
            : "Are you sure you want to delete this warehouse?"
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        isLoading={deleteWarehouse.isPending}
      />
    </div>
  );
}
