"use client";

import { useState } from "react";
import { Plus, Search, Pencil, Filter, Package, DollarSign, AlertTriangle, AlertCircle } from "lucide-react";
import { useItems } from "@/hooks/useItems";
import { useReorderStatistics } from "@/hooks/useReorder";
import { useCurrency } from "@/hooks/useCurrency";
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
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import type { Item } from "@/types/item";

export default function ItemsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { formatCurrency } = useCurrency();

  // Fetch paginated items with filters
  const { data, isLoading, error } = useItems({
    search,
    page,
    limit: pageSize,
    itemType: typeFilter !== "all" ? typeFilter : undefined,
    isActive: statusFilter === "all" ? undefined : statusFilter === "active",
  });

  // Fetch all items for statistics (with higher staleTime this will be cached)
  const { data: statsData } = useItems({ limit: 1000 });
  const { data: reorderStats, isLoading: reorderLoading } = useReorderStatistics();

  const items = data?.data || [];
  const pagination = data?.pagination;

  // Calculate statistics from all items
  const allItems = statsData?.data || [];
  const totalItems = allItems.filter(item => item.isActive).length;
  const totalValue = allItems
    .filter(item => item.isActive)
    .reduce((sum, item) => sum + (item.listPrice * 1), 0);
  const lowStockItems = reorderStats?.itemsLowStock || 0;
  const criticalStockItems = reorderStats?.itemsCritical || 0;

  const stats = [
    {
      title: "Total Items",
      value: totalItems,
      description: "Active inventory items",
      icon: Package,
      iconColor: "text-blue-600",
    },
    {
      title: "Total Value",
      value: formatCurrency(totalValue),
      description: "Current stock value",
      icon: DollarSign,
      iconColor: "text-green-600",
    },
    {
      title: "Low Stock Items",
      value: lowStockItems,
      description: "Need reordering soon",
      icon: AlertTriangle,
      iconColor: "text-yellow-600",
    },
    {
      title: "Critical Stock",
      value: criticalStockItems,
      description: "Below minimum level",
      icon: AlertCircle,
      iconColor: "text-red-600",
    },
  ];

  const statsLoading = isLoading || reorderLoading;

  const getItemTypeBadge = (type: Item["itemType"]) => {
    const variants: Record<Item["itemType"], { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
      goods: { label: "Goods", variant: "default" },
      service: { label: "Service", variant: "secondary" },
      raw_material: { label: "Raw Material", variant: "outline" },
      finished_goods: { label: "Finished Goods", variant: "default" },
    };

    const config = variants[type];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleCreateItem = () => {
    setSelectedItem(null);
    setDialogOpen(true);
  };

  const handleEditItem = (item: Item) => {
    setSelectedItem(item);
    setDialogOpen(true);
  };

  const handleTypeFilterChange = (value: string) => {
    setTypeFilter(value);
    setPage(1);
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Item Master</h1>
          <p className="text-muted-foreground">
            Manage your inventory items
          </p>
        </div>
        <Button onClick={handleCreateItem}>
          <Plus className="mr-2 h-4 w-4" />
          Create Item
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsLoading ? (
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
        <div className="mb-4 flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={typeFilter} onValueChange={handleTypeFilterChange}>
              <SelectTrigger className="w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="goods">Goods</SelectItem>
                <SelectItem value="service">Service</SelectItem>
                <SelectItem value="raw_material">Raw Material</SelectItem>
                <SelectItem value="finished_goods">Finished Goods</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
              <SelectTrigger className="w-[150px]">
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

          {isLoading ? (
            <div className="max-h-[calc(100vh-400px)] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>UOM</TableHead>
                    <TableHead className="text-right">Std Cost</TableHead>
                    <TableHead className="text-right">List Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...Array(10)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              Error loading items. Please try again.
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No items found. Create your first item to get started.
            </div>
          ) : (
            <>
              <div className="max-h-[calc(100vh-400px)] overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>UOM</TableHead>
                      <TableHead className="text-right">Std Cost</TableHead>
                      <TableHead className="text-right">List Price</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.code}</TableCell>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>{getItemTypeBadge(item.itemType)}</TableCell>
                        <TableCell>{item.category}</TableCell>
                        <TableCell>{item.uom}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.standardCost)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.listPrice)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.isActive ? "default" : "secondary"}>
                            {item.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditItem(item)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
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
    </div>
  );
}
