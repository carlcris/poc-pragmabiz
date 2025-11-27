"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Pencil, Trash2, Filter, Download, Package, AlertTriangle, AlertCircle, TrendingUp } from "lucide-react";
import { useDeleteItem, useItems } from "@/hooks/useItems";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useItemCategories } from "@/hooks/useItemCategories";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useCurrency } from "@/hooks/useCurrency";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { ItemDetailsDialog } from "@/components/items/ItemDetailsDialog";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import type { Item } from "@/types/item";
import type { ItemWithStock } from "@/app/api/items-enhanced/route";

export default function ItemsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<ItemWithStock | null>(null);

  const { formatCurrency } = useCurrency();
  const deleteItem = useDeleteItem();

  // Fetch items with stock data
  const { data, isLoading, error } = useItems({
    search,
    page,
    limit: pageSize,
    category: categoryFilter !== "all" ? categoryFilter : undefined,
    supplierId: supplierFilter !== "all" ? supplierFilter : undefined,
    warehouseId: warehouseFilter !== "all" ? warehouseFilter : undefined,
    status: statusFilter !== 'all' ? (statusFilter as 'normal' | 'low_stock' | 'out_of_stock' | 'overstock' | 'discontinued') : 'all',
    includeStock: true,
  });

  // Fetch warehouses for filter
  const { data: warehousesData } = useWarehouses({ limit: 1000 });
  const warehouses = warehousesData?.data?.filter(wh => wh.isActive) || [];

  // Fetch categories for filter
  const { data: categoriesData } = useItemCategories();
  const categories = categoriesData?.data || [];

  // Fetch suppliers for filter
  const { data: suppliersData } = useSuppliers({ limit: 1000 });
  const suppliers = suppliersData?.data?.filter(s => s.status === 'active') || [];

  const items = data?.data || [];
  const pagination = data?.pagination;

  // Calculate statistics
  const lowStockItems = items.filter(i => i.status === 'low_stock').length;
  const outOfStockItems = items.filter(i => i.status === 'out_of_stock').length;
  const totalValue = items.reduce((sum, item) => sum + (item.available * item.listPrice), 0);

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
    },
    {
      title: "Out of Stock",
      value: outOfStockItems,
      description: "No available inventory",
      icon: AlertCircle,
      iconColor: "text-red-600",
    },
  ];

  const getStatusBadge = (status: ItemWithStock['status']) => {
    const variants: Record<ItemWithStock['status'], { label: string; variant: "default" | "secondary" | "outline" | "destructive"; className?: string }> = {
      normal: { label: "Normal", variant: "default", className: "bg-green-600" },
      low_stock: { label: "Low Stock", variant: "outline", className: "text-yellow-600 border-yellow-600" },
      out_of_stock: { label: "Out of Stock", variant: "destructive" },
      overstock: { label: "Overstock", variant: "secondary", className: "bg-blue-600 text-white" },
      discontinued: { label: "Discontinued", variant: "outline", className: "text-gray-500" },
    };

    const config = variants[status];
    return <Badge variant={config.variant} className={config.className}>{config.label}</Badge>;
  };

  const handleCreateItem = () => {
    setSelectedItem(null);
    setDialogOpen(true);
  };

  const handleViewItem = (itemId: string) => {
    setSelectedItemId(itemId);
    setDetailsDialogOpen(true);
  };

  const handleEditItem = (item: ItemWithStock | Item) => {
    // Convert ItemWithStock to Item type if needed
    const itemData: Item = 'onHand' in item ? {
      id: item.id,
      companyId: '',
      code: item.code,
      name: item.name,
      description: '',
      itemType: (item.itemType || 'stock') as 'stock' | 'service' | 'non_stock',
      uom: item.uom,
      uomId: '',
      category: item.category,
      standardCost: item.standardCost,
      listPrice: item.listPrice,
      reorderLevel: item.reorderPoint,
      reorderQty: 0,
      isActive: item.isActive,
      createdAt: '',
      updatedAt: '',
    } : item;
    setSelectedItem(itemData);
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
    } catch (error) {
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
      "Reorder Point",
      "On PO",
      "On SO",
      "Status",
      "Std Cost",
      "List Price",
    ];

    // Create CSV rows
    const rows = items.map(item => [
      item.code,
      item.name,
      item.category,
      item.uom || "",
      item.onHand,
      item.allocated,
      item.available,
      item.reorderPoint,
      item.onPO,
      item.onSO,
      item.status,
      item.standardCost,
      item.listPrice,
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `inventory-items-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Inventory exported to CSV");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory Master</h1>
          <p className="text-muted-foreground">
            Manage items with real-time stock levels
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button onClick={handleCreateItem}>
            <Plus className="mr-2 h-4 w-4" />
            Create Item
          </Button>
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
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-3 w-32" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title}>
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

      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
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
          <Select value={categoryFilter} onValueChange={(value) => { setCategoryFilter(value); setPage(1); }}>
            <SelectTrigger className="w-[180px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={supplierFilter} onValueChange={(value) => { setSupplierFilter(value); setPage(1); }}>
            <SelectTrigger className="w-[180px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Supplier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Suppliers</SelectItem>
              {suppliers.map((sup) => (
                <SelectItem key={sup.id} value={sup.id}>{sup.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={warehouseFilter} onValueChange={(value) => { setWarehouseFilter(value); setPage(1); }}>
            <SelectTrigger className="w-[180px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Warehouse" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Warehouses</SelectItem>
              {warehouses.map((wh) => (
                <SelectItem key={wh.id} value={wh.id}>{wh.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
            <SelectTrigger className="w-[180px]">
              <Filter className="mr-2 h-4 w-4" />
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
        {isLoading ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Code</TableHead>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>UOM</TableHead>
                  <TableHead className="text-right">On Hand</TableHead>
                  <TableHead className="text-right">Allocated</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Reorder Point</TableHead>
                  <TableHead className="text-right">On PO</TableHead>
                  <TableHead className="text-right">On SO</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(10)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-destructive mb-2">Error Loading Items</h3>
            <p className="text-muted-foreground mb-4">
              {error instanceof Error && error.message.includes('Unauthorized')
                ? 'Please log in to view inventory items.'
                : 'Unable to load inventory data. Please try again.'}
            </p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No items found. Create your first item to get started.
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Code</TableHead>
                    <TableHead>Item Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>UOM</TableHead>
                    <TableHead className="text-right">On Hand</TableHead>
                    <TableHead className="text-right">Allocated</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead className="text-right">Reorder Point</TableHead>
                    <TableHead className="text-right">On PO</TableHead>
                    <TableHead className="text-right">On SO</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleViewItem(item.id)}>
                      <TableCell className="font-mono font-medium">{item.code}</TableCell>
                      <TableCell className="font-medium text-primary hover:underline">{item.name}</TableCell>
                      <TableCell>{item.category}</TableCell>
                      <TableCell className="text-muted-foreground">{item.uom || '-'}</TableCell>
                      <TableCell className="text-right">{item.onHand.toFixed(2)}</TableCell>
                      <TableCell className="text-right text-orange-600">{item.allocated.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-semibold">
                        <span className={item.available <= 0 ? 'text-red-600' : item.available <= item.reorderPoint ? 'text-yellow-600' : 'text-green-600'}>
                          {item.available.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{item.reorderPoint.toFixed(2)}</TableCell>
                      <TableCell className="text-right text-blue-600">{item.onPO.toFixed(2)}</TableCell>
                      <TableCell className="text-right text-purple-600">{item.onSO.toFixed(2)}</TableCell>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditItem(item)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteItem(item)}
                            disabled={deleteItem.isPending}
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

      <ItemFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        item={selectedItem}
      />

      {selectedItemId && (
        <ItemDetailsDialog
          open={detailsDialogOpen}
          onOpenChange={setDetailsDialogOpen}
          itemId={selectedItemId}
          onEdit={handleEditItem}
        />
      )}

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
