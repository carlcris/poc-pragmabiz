"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Filter,
  Download,
  Package,
  AlertTriangle,
  AlertCircle,
  TrendingUp,
  Image as ImageIcon,
} from "lucide-react";
import Image from "next/image";
import { useDeleteItem, useItems } from "@/hooks/useItems";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useItemCategories } from "@/hooks/useItemCategories";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useCurrency } from "@/hooks/useCurrency";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ItemFormDialog } from "@/components/items/ItemFormDialog";
import type { ItemDialogMode } from "@/components/items/ItemFormDialog";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ProtectedRoute } from "@/components/permissions/ProtectedRoute";
import { CreateGuard, EditGuard, DeleteGuard } from "@/components/permissions/PermissionGuard";
import { RESOURCES } from "@/constants/resources";
import type { ItemWithStock } from "@/app/api/items-enhanced/route";
import type { Item } from "@/types/item";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";

function ItemsPageContent() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [itemDialogMode, setItemDialogMode] = useState<ItemDialogMode>("create");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<ItemWithStock | null>(null);

  const { formatCurrency } = useCurrency();
  const deleteItem = useDeleteItem();
  const { currentBusinessUnit } = useBusinessUnitStore();
  const lastAutoSetBuId = useRef<string | null>(null);

  // Fetch items with stock data
  const { data, isLoading, error } = useItems({
    search,
    page,
    limit: pageSize,
    category: categoryFilter !== "all" ? categoryFilter : undefined,
    supplierId: supplierFilter !== "all" ? supplierFilter : undefined,
    warehouseId: warehouseFilter !== "all" ? warehouseFilter : undefined,
    status:
      statusFilter !== "all"
        ? (statusFilter as "normal" | "low_stock" | "out_of_stock" | "overstock" | "discontinued")
        : "all",
    includeStock: true,
  });

  // Fetch warehouses for filter
  const { data: warehousesData } = useWarehouses({ limit: 1000 });
  const warehouses = useMemo(
    () => warehousesData?.data?.filter((wh) => wh.isActive) || [],
    [warehousesData?.data]
  );

  useEffect(() => {
    if (!currentBusinessUnit || warehouseFilter !== "all" || warehouses.length === 0) {
      return;
    }

    if (lastAutoSetBuId.current === currentBusinessUnit.id) {
      return;
    }

    const matchedWarehouse = warehouses.find(
      (warehouse) => warehouse.businessUnitId === currentBusinessUnit.id
    );

    if (matchedWarehouse) {
      setWarehouseFilter(matchedWarehouse.id);
      setPage(1);
      lastAutoSetBuId.current = currentBusinessUnit.id;
    }
  }, [currentBusinessUnit, warehouseFilter, warehouses]);

  // Fetch categories for filter
  const { data: categoriesData } = useItemCategories();
  const categories = categoriesData?.data || [];

  // Fetch suppliers for filter
  const { data: suppliersData } = useSuppliers({ limit: 1000 });
  const suppliers = suppliersData?.data?.filter((s) => s.status === "active") || [];

  const items = (data?.data || []) as ItemWithStock[];
  const pagination = data?.pagination;
  const statistics =
    data && typeof data === "object" && "statistics" in data ? data.statistics : undefined;

  // Use statistics from API (calculated from all filtered items, not just current page)
  const lowStockItems = statistics?.lowStockCount ?? 0;
  const outOfStockItems = statistics?.outOfStockCount ?? 0;
  const totalValue = statistics?.totalAvailableValue ?? 0;

  const stats = [
    {
      title: "Total Items",
      value: pagination?.total || 0,
      description: "In inventory",
      icon: Package,
      iconColor: "text-blue-600",
    },
    {
      title: "Total Available Value",
      value: formatCurrency(totalValue),
      description: "Current sellable stock",
      icon: TrendingUp,
      iconColor: "text-green-600",
    },
    {
      title: "Low Stock",
      value: lowStockItems,
      description: "At or below reorder point",
      icon: AlertTriangle,
      iconColor: "text-yellow-600",
      filterValue: "low_stock" as const,
    },
    {
      title: "Out of Stock",
      value: outOfStockItems,
      description: "No available inventory",
      icon: AlertCircle,
      iconColor: "text-red-600",
      filterValue: "out_of_stock" as const,
    },
  ];

  const getStatusBadge = (status: ItemWithStock["status"]) => {
    const variants: Record<ItemWithStock["status"], { label: string; className: string }> = {
      normal: { label: "Normal", className: "text-emerald-700" },
      low_stock: { label: "Low Stock", className: "text-amber-700" },
      out_of_stock: { label: "Out of Stock", className: "text-red-700" },
      overstock: { label: "Overstock", className: "text-blue-700" },
      discontinued: { label: "Discontinued", className: "text-slate-500" },
    };

    const config = variants[status];
    return (
      <span className={`text-xs font-semibold tracking-wide ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const handleCreateItem = () => {
    setSelectedItemId(null);
    setItemDialogMode("create");
    setDialogOpen(true);
  };

  const handleViewItem = (itemId: string) => {
    setSelectedItemId(itemId);
    setItemDialogMode("view");
    setDialogOpen(true);
  };

  const handleEditItem = (item: ItemWithStock | Item) => {
    setSelectedItemId(item.id);
    setItemDialogMode("edit");
    setDialogOpen(true);
  };

  const handleDeleteItem = (item: ItemWithStock) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;

    try {
      await deleteItem.mutateAsync(itemToDelete.id);
      toast.success("Item deleted successfully");
      setItemToDelete(null);
    } catch {
      toast.error("Failed to delete item");
    }
  };

  const handleExportCSV = () => {
    if (!items || items.length === 0) {
      toast.error("No data to export");
      return;
    }

    // Create CSV header
    const headers = [
      "Item Code",
      "Item Name",
      "Category",
      "UOM",
      "On Hand",
      "Allocated",
      "Available",
      "Status",
      "Std Cost",
      "List Price",
    ];

    // Create CSV rows
    const rows = items.map((item) => [
      item.code,
      item.name,
      item.category,
      item.uom || "",
      item.onHand,
      item.allocated,
      item.available,
      item.status,
      item.standardCost,
      item.listPrice,
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `inventory-items-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Inventory exported to CSV");
  };

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory Master</h1>
          <p className="text-muted-foreground">Manage items with real-time stock levels</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <CreateGuard resource={RESOURCES.ITEMS}>
            <Button onClick={handleCreateItem}>
              <Plus className="mr-2 h-4 w-4" />
              Create Item
            </Button>
          </CreateGuard>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="mb-2 h-8 w-16" />
                  <Skeleton className="h-3 w-32" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          stats.map((stat) => {
            const Icon = stat.icon;
            const isFilterCard = !!stat.filterValue;
            const isActiveFilter = isFilterCard && statusFilter === stat.filterValue;
            return (
              <Card
                key={stat.title}
                role={isFilterCard ? "button" : undefined}
                tabIndex={isFilterCard ? 0 : undefined}
                onClick={
                  isFilterCard
                    ? () => {
                        const nextFilter =
                          statusFilter === stat.filterValue ? "all" : stat.filterValue;
                        setStatusFilter(nextFilter);
                        setPage(1);
                      }
                    : undefined
                }
                onKeyDown={
                  isFilterCard
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          const nextFilter =
                            statusFilter === stat.filterValue ? "all" : stat.filterValue;
                          setStatusFilter(nextFilter);
                          setPage(1);
                        }
                      }
                    : undefined
                }
                className={
                  isFilterCard
                    ? `cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md ${
                        isActiveFilter ? "ring-2 ring-primary/40" : ""
                      }`
                    : undefined
                }
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                  <Icon className={`h-4 w-4 ${stat.iconColor}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground">{stat.description}</p>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 lg:flex-nowrap">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by item code or name..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-8"
            />
          </div>
          <Select
            value={categoryFilter}
            onValueChange={(value) => {
              setCategoryFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <Filter className="mr-2 h-4 w-4 shrink-0" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={supplierFilter}
            onValueChange={(value) => {
              setSupplierFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <Filter className="mr-2 h-4 w-4 shrink-0" />
              <SelectValue placeholder="Supplier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Suppliers</SelectItem>
              {suppliers.map((sup) => (
                <SelectItem key={sup.id} value={sup.id}>
                  {sup.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={warehouseFilter}
            onValueChange={(value) => {
              setWarehouseFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <Filter className="mr-2 h-4 w-4 shrink-0" />
              <SelectValue placeholder="Warehouse" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Warehouses</SelectItem>
              {warehouses.map((wh) => (
                <SelectItem key={wh.id} value={wh.id}>
                  {wh.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <Filter className="mr-2 h-4 w-4 shrink-0" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="low_stock">Low Stock</SelectItem>
              <SelectItem value="out_of_stock">Out of Stock</SelectItem>
              <SelectItem value="overstock">Overstock</SelectItem>
              <SelectItem value="discontinued">Discontinued</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="min-h-0 flex-1">
          {isLoading ? (
            <div className="h-full overflow-y-auto overscroll-contain rounded-md border">
              <Table containerClassName="overflow-visible">
                <TableHeader className="sticky top-0 z-10 bg-background shadow-sm [&_th]:bg-background">
                  <TableRow>
                    <TableHead className="w-[80px]">Image</TableHead>
                    <TableHead>Item Code</TableHead>
                    <TableHead>Item Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>UOM</TableHead>
                    <TableHead className="text-right">On Hand</TableHead>
                    <TableHead className="text-right">Allocated</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...Array(10)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-12 w-12 rounded" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-40" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="ml-auto h-4 w-16" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="ml-auto h-4 w-16" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="ml-auto h-4 w-16" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="ml-auto h-8 w-16" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center text-center">
              <div>
                <AlertCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
                <h3 className="mb-2 text-lg font-semibold text-destructive">Error Loading Items</h3>
                <p className="mb-4 text-muted-foreground">
                  {error instanceof Error && error.message.includes("Unauthorized")
                    ? "Please log in to view inventory items."
                    : "Unable to load inventory data. Please try again."}
                </p>
                <Button variant="outline" onClick={() => window.location.reload()}>
                  Retry
                </Button>
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              No items found. Create your first item to get started.
            </div>
          ) : (
            <div className="h-full overflow-y-auto overscroll-contain rounded-md border">
              <Table containerClassName="overflow-visible">
                <TableHeader className="sticky top-0 z-10 bg-background shadow-sm [&_th]:bg-background">
                  <TableRow>
                    <TableHead className="w-[80px]">Image</TableHead>
                    <TableHead>Item Code</TableHead>
                    <TableHead>Item Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>UOM</TableHead>
                    <TableHead className="text-right">On Hand</TableHead>
                    <TableHead className="text-right">Allocated</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleViewItem(item.id)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {item.imageUrl ? (
                          <div className="relative h-12 w-12 overflow-hidden rounded border bg-muted">
                            <Image
                              src={item.imageUrl}
                              alt={item.name}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded border bg-muted">
                            <ImageIcon className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono font-medium">{item.code}</TableCell>
                      <TableCell className="text-primary">
                        <div className="font-medium hover:underline">{item.name}</div>
                        {item.chineseName ? (
                          <div className="text-xs text-muted-foreground">{item.chineseName}</div>
                        ) : null}
                      </TableCell>
                      <TableCell>{item.category}</TableCell>
                      <TableCell className="text-muted-foreground">{item.uom || "-"}</TableCell>
                      <TableCell className="text-right">{Math.trunc(item.onHand)}</TableCell>
                      <TableCell className="text-right text-orange-600">
                        {Math.trunc(item.allocated)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        <span
                          className={
                            item.available <= 0
                              ? "text-red-600"
                              : item.available <= item.reorderPoint
                                ? "text-yellow-600"
                                : "text-green-600"
                          }
                        >
                          {Math.trunc(item.available)}
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                      <TableCell className="text-right">
                        <div
                          className="flex justify-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <EditGuard resource={RESOURCES.ITEMS}>
                            <Button variant="ghost" size="sm" onClick={() => handleEditItem(item)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </EditGuard>
                          <DeleteGuard resource={RESOURCES.ITEMS}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteItem(item)}
                              disabled={deleteItem.isPending}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </DeleteGuard>
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

      <ItemFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        itemId={selectedItemId}
        mode={itemDialogMode}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Delete Item"
        description={
          itemToDelete
            ? `Are you sure you want to delete "${itemToDelete.name}"? This action cannot be undone.`
            : "Are you sure you want to delete this item?"
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        isLoading={deleteItem.isPending}
      />
    </div>
  );
}

export default function ItemsPage() {
  return (
    <ProtectedRoute resource={RESOURCES.ITEMS}>
      <ItemsPageContent />
    </ProtectedRoute>
  );
}
