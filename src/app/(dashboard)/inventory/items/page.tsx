"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  MoreVertical,
  Filter,
  Download,
  Package,
  AlertTriangle,
  AlertCircle,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import {
  useDeleteItem,
  useItems,
  useItemsStats,
  type ItemsWithStockResponse,
} from "@/hooks/useItems";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useItemCategories } from "@/hooks/useItemCategories";
import { useCurrency } from "@/hooks/useCurrency";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
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
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { MetricCard } from "@/components/shared/MetricCard";
import { ProtectedRoute } from "@/components/permissions/ProtectedRoute";
import { EditGuard, DeleteGuard } from "@/components/permissions/PermissionGuard";
import { ItemImage } from "@/components/items/ItemImage";
import { RESOURCES } from "@/constants/resources";
import { GRANULAR_CAPABILITIES } from "@/constants/granular-permissions";
import { useGranularCapabilities } from "@/hooks/useGranularCapabilities";
import type { ItemWithStock } from "@/app/api/items/route";
import type { Item } from "@/types/item";

const ConfirmDialog = dynamic(
  () => import("@/components/shared/ConfirmDialog").then((mod) => mod.ConfirmDialog),
  { ssr: false }
);

function ItemsPageContent() {
  const t = useTranslations("itemsPage");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<ItemWithStock | null>(null);

  const { formatCurrency } = useCurrency();
  const deleteItem = useDeleteItem();
  const currentBusinessUnit = useBusinessUnitStore((state) => state.currentBusinessUnit);
  const hasBusinessUnitHydrated = useBusinessUnitStore((state) => state.hasHydrated);
  const isBusinessUnitLoading = useBusinessUnitStore((state) => state.isLoading);
  // Fetch warehouses to resolve the current BU's default warehouse scope.
  const { data: warehousesData, isLoading: isWarehousesLoading } = useWarehouses({ limit: 50 });
  const warehouses = useMemo(
    () => warehousesData?.data?.filter((wh) => wh.isActive) || [],
    [warehousesData?.data]
  );
  const currentBusinessUnitWarehouseId = useMemo(() => {
    if (!currentBusinessUnit?.id) return undefined;
    return warehouses.find((warehouse) => warehouse.businessUnitId === currentBusinessUnit.id)?.id;
  }, [currentBusinessUnit?.id, warehouses]);
  const isBusinessUnitScopeReady = hasBusinessUnitHydrated && !isBusinessUnitLoading;
  const isWarehouseScopeReady =
    !currentBusinessUnit?.id || (!!currentBusinessUnitWarehouseId && !isWarehousesLoading);
  const areItemQueriesEnabled = isBusinessUnitScopeReady && isWarehouseScopeReady;

  const itemsQueryParams = useMemo<{
    search: string;
    page: number;
    limit: number;
    category: string | undefined;
    warehouseId: string | undefined;
    status: "normal" | "low_stock" | "out_of_stock" | "overstock" | "discontinued" | "all";
    includeStock: true;
    includeStats: false;
  }>(
    () => ({
      search,
      page,
      limit: pageSize,
      category: categoryFilter !== "all" ? categoryFilter : undefined,
      warehouseId: currentBusinessUnitWarehouseId,
      status:
        statusFilter !== "all"
          ? (statusFilter as "normal" | "low_stock" | "out_of_stock" | "overstock" | "discontinued")
          : "all",
      includeStock: true,
      includeStats: false,
    }),
    [search, page, pageSize, categoryFilter, currentBusinessUnitWarehouseId, statusFilter]
  );

  const { data, isLoading, isFetching, error } = useItems({
    ...itemsQueryParams,
    enabled: areItemQueriesEnabled,
  });
  const {
    data: statsData,
    isLoading: isStatsLoading,
    error: statsError,
  } = useItemsStats({
    warehouseId: currentBusinessUnitWarehouseId,
    includeStock: true,
    enabled: areItemQueriesEnabled,
  });
  const { data: granularCapabilities = {} } = useGranularCapabilities([
    GRANULAR_CAPABILITIES.ITEM_MASTER_TOTAL_AVAILABLE_VALUE,
  ]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  // Fetch categories for filter
  const { data: categoriesData } = useItemCategories();
  const categories = categoriesData?.data || [];

  const isInitialLoading = isLoading || !areItemQueriesEnabled;
  const items = (data?.data || []) as ItemWithStock[];
  const pagination = data?.pagination;
  const statistics = statsData?.statistics;
  const hasStatsError = Boolean(statsError);
  const isStatsPending = isStatsLoading && !statsData;

  // Use statistics from API (calculated from all filtered items, not just current page)
  const lowStockItems = statistics?.lowStockCount;
  const outOfStockItems = statistics?.outOfStockCount;
  const totalValue = statistics?.totalAvailableValue;
  const totalItems = statistics?.totalCount;
  const canViewTotalAvailableValue =
    granularCapabilities[GRANULAR_CAPABILITIES.ITEM_MASTER_TOTAL_AVAILABLE_VALUE] === true;

  type StatsCardConfig = {
    title: string;
    value: string | number;
    description: string;
    icon: LucideIcon;
    iconColor: string;
    filterValue?: "low_stock" | "out_of_stock";
  };

  const stats = [
    {
      title: t("totalItems"),
      value: hasStatsError ? "—" : (totalItems ?? "—"),
      description: t("totalItemsDescription"),
      icon: Package,
      iconColor: "text-blue-600",
    },
    canViewTotalAvailableValue
      ? {
          title: t("totalAvailableValue"),
          value:
            hasStatsError || totalValue == null
              ? "—"
              : totalValue !== undefined
                ? formatCurrency(totalValue)
                : "—",
          description: t("totalAvailableValueDescription"),
          icon: TrendingUp,
          iconColor: "text-green-600",
        }
      : null,
    {
      title: t("lowStock"),
      value: hasStatsError ? "—" : (lowStockItems ?? "—"),
      description: t("lowStockDescription"),
      icon: AlertTriangle,
      iconColor: "text-yellow-600",
      filterValue: "low_stock" as const,
    },
    {
      title: t("outOfStock"),
      value: hasStatsError ? "—" : (outOfStockItems ?? "—"),
      description: t("outOfStockDescription"),
      icon: AlertCircle,
      iconColor: "text-red-600",
      filterValue: "out_of_stock" as const,
    },
  ].filter((stat): stat is StatsCardConfig => Boolean(stat));

  const getStatusBadge = (status?: ItemWithStock["status"]) => {
    const variants: Record<ItemWithStock["status"], { label: string; className: string }> = {
      normal: { label: t("normal"), className: "text-emerald-700" },
      low_stock: { label: t("lowStock"), className: "text-amber-700" },
      out_of_stock: { label: t("outOfStock"), className: "text-red-700" },
      overstock: { label: t("overstock"), className: "text-blue-700" },
      discontinued: { label: t("discontinued"), className: "text-slate-500" },
    };

    const config = status ? variants[status] : undefined;
    const fallback = { label: t("unknown"), className: "text-slate-500" };
    const resolved = config ?? fallback;
    return (
      <span className={`text-xs font-semibold tracking-wide ${resolved.className}`}>
        {resolved.label}
      </span>
    );
  };

  const toNumber = (value: number | string | null | undefined) => {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const handleCreateItem = () => {
    router.push("/inventory/items/create");
  };

  const handleViewItem = (itemId: string) => {
    router.push(`/inventory/items/${itemId}`);
  };

  const handleEditItem = (item: ItemWithStock | Item) => {
    router.push(`/inventory/items/${item.id}/edit`);
  };

  const handleDeleteItem = (item: ItemWithStock) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;

    try {
      await deleteItem.mutateAsync(itemToDelete.id);
      toast.success(t("deleteSuccess"));
      setItemToDelete(null);
    } catch {
      toast.error(t("deleteError"));
    }
  };

  const escapeCsvCell = (value: string | number | boolean | null | undefined) =>
    `"${String(value ?? "").replaceAll('"', '""')}"`;

  const downloadItemsCsv = (exportItems: ItemWithStock[]) => {
    if (exportItems.length === 0) {
      toast.error(t("noDataToExport"));
      return;
    }

    const headers = [
      "Item Code",
      "Supplier Code",
      "Item Name",
      "Category",
      "UOM",
      "On Hand",
      "Allocated",
      "In Transit Qty",
      "Available",
      "Status",
      "Purchase Price",
      "List Price",
    ];

    const rows = exportItems.map((item) => [
      item.code,
      item.supplierCode || "",
      item.name,
      item.category,
      item.uom || "",
      item.onHand,
      item.allocated,
      item.inTransit,
      item.available,
      item.status,
      item.purchasePrice,
      item.listPrice,
    ]);

    const csvContent = [
      headers.map(escapeCsvCell).join(","),
      ...rows.map((row) => row.map(escapeCsvCell).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `inventory-items-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(t("exportSuccess"));
  };

  const handleExportCSV = async () => {
    if (!areItemQueriesEnabled || isExportingCsv) return;

    setIsExportingCsv(true);
    try {
      const params = new URLSearchParams();
      if (itemsQueryParams.search) params.append("search", itemsQueryParams.search);
      if (itemsQueryParams.category) params.append("category", itemsQueryParams.category);
      if (itemsQueryParams.warehouseId) params.append("warehouseId", itemsQueryParams.warehouseId);
      if (itemsQueryParams.status && itemsQueryParams.status !== "all") {
        params.append("status", itemsQueryParams.status);
      }
      params.append("includeStock", "true");
      params.append("includeStats", "false");
      params.append("exportMode", "csv");

      const response = await fetch(`/api/items?${params.toString()}`, {
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.status === 413) {
        toast.error(t("exportTooLarge"));
        return;
      }

      if (!response.ok) {
        toast.error(t("exportError"));
        return;
      }

      const exportData = (await response.json()) as ItemsWithStockResponse;
      downloadItemsCsv(exportData.data || []);
    } catch {
      toast.error(t("exportError"));
    } finally {
      setIsExportingCsv(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 sm:gap-4 md:h-full md:gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="whitespace-nowrap text-lg font-semibold tracking-tight sm:text-xl">
            {t("title")}
          </h1>
          <p className="whitespace-nowrap text-xs text-muted-foreground sm:text-sm">
            {t("subtitle")}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
          <Button
            variant="outline"
            onClick={handleExportCSV}
            disabled={isExportingCsv || !areItemQueriesEnabled}
            className="w-full flex-shrink-0 sm:w-auto"
          >
            <Download className="mr-2 h-4 w-4" />
            <span className="sm:inline">{isExportingCsv ? t("exportingCsv") : t("exportCsv")}</span>
          </Button>
          <Button onClick={handleCreateItem} className="w-full flex-shrink-0 sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            <span className="sm:inline">{t("createItem")}</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-2 md:gap-4 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const filterValue = stat.filterValue;
          const isFilterCard = Boolean(filterValue);
          const isActiveFilter = filterValue ? statusFilter === filterValue : false;
          const handleToggleFilter = () => {
            if (!filterValue) return;
            const nextFilter = statusFilter === filterValue ? "all" : filterValue;
            setStatusFilter(nextFilter);
            setPage(1);
          };

          return (
            <div
              key={stat.title}
              role={isFilterCard ? "button" : undefined}
              tabIndex={isFilterCard ? 0 : undefined}
              onClick={isFilterCard ? handleToggleFilter : undefined}
              onKeyDown={
                isFilterCard
                  ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleToggleFilter();
                      }
                    }
                  : undefined
              }
              className={
                isFilterCard
                  ? `rounded-lg transition hover:-translate-y-0.5 hover:shadow-md ${
                      isActiveFilter ? "ring-2 ring-primary/40" : ""
                    }`
                  : undefined
              }
            >
              <MetricCard
                title={stat.title}
                icon={Icon}
                iconClassName={`h-3 w-3 md:h-4 md:w-4 ${stat.iconColor}`}
                value={String(stat.value)}
                caption={stat.description}
                isLoading={isInitialLoading || isStatsPending}
                skeletonCaption={false}
                valueClassName="text-lg md:text-2xl font-bold"
              />
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 sm:gap-3 md:min-h-0 md:flex-1 md:gap-4">
        {/* Filters */}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("searchPlaceholder")}
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
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
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="mr-2 h-4 w-4 shrink-0" />
              <SelectValue placeholder={t("categoryPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allCategories")}</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
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
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="mr-2 h-4 w-4 shrink-0" />
              <SelectValue placeholder={tCommon("status")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tCommon("allStatuses")}</SelectItem>
              <SelectItem value="normal">{t("normal")}</SelectItem>
              <SelectItem value="low_stock">{t("lowStock")}</SelectItem>
              <SelectItem value="out_of_stock">{t("outOfStock")}</SelectItem>
              <SelectItem value="overstock">{t("overstock")}</SelectItem>
              <SelectItem value="discontinued">{t("discontinued")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="md:min-h-0 md:flex-1">
          {isInitialLoading || isFetching ? (
            <div className="h-[200px] overflow-y-auto overscroll-contain rounded-md border md:h-full">
              <Table containerClassName="overflow-visible">
                <TableHeader className="sticky top-0 z-10 bg-background shadow-sm [&_th]:bg-background">
                  <TableRow>
                    <TableHead className="w-[80px]">{t("image")}</TableHead>
                    <TableHead>{t("itemCode")}</TableHead>
                    <TableHead>{t("supplierCode")}</TableHead>
                    <TableHead>{t("itemName")}</TableHead>
                    <TableHead>{t("category")}</TableHead>
                    <TableHead className="text-right">{t("onHand")}</TableHead>
                    <TableHead className="text-right">{t("allocated")}</TableHead>
                    <TableHead className="text-right">{t("inTransitQty")}</TableHead>
                    <TableHead className="text-right">{t("available")}</TableHead>
                    <TableHead>{tCommon("status")}</TableHead>
                    <TableHead className="text-right">{tCommon("actions")}</TableHead>
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
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-40" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
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
                        <Skeleton className="ml-auto h-4 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-16" />
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
            <div className="flex h-[200px] items-center justify-center text-center md:h-full">
              <div>
                <AlertCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
                <h3 className="mb-2 text-lg font-semibold text-destructive">
                  {t("errorLoadingTitle")}
                </h3>
                <p className="mb-4 text-muted-foreground">
                  {error instanceof Error && error.message.includes("Unauthorized")
                    ? t("unauthorizedMessage")
                    : t("loadErrorMessage")}
                </p>
                <Button variant="outline" onClick={() => window.location.reload()}>
                  {t("retry")}
                </Button>
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-[200px] items-center justify-center text-muted-foreground md:h-full">
              {t("empty")}
            </div>
          ) : (
            <div className="h-[200px] overflow-auto overscroll-contain rounded-md border md:h-full">
              <Table containerClassName="min-w-[1240px] overflow-visible">
                <TableHeader className="sticky top-0 z-10 bg-background shadow-sm [&_th]:bg-background">
                  <TableRow>
                    <TableHead className="w-[80px]">{t("image")}</TableHead>
                    <TableHead>{t("itemCode")}</TableHead>
                    <TableHead>{t("supplierCode")}</TableHead>
                    <TableHead>{t("itemName")}</TableHead>
                    <TableHead>{t("category")}</TableHead>
                    <TableHead className="text-right">{t("onHand")}</TableHead>
                    <TableHead className="text-right">{t("allocated")}</TableHead>
                    <TableHead className="text-right">{t("inTransitQty")}</TableHead>
                    <TableHead className="text-right">{t("available")}</TableHead>
                    <TableHead>{tCommon("status")}</TableHead>
                    <TableHead className="text-right">{tCommon("actions")}</TableHead>
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
                        <div className="relative h-12 w-12 overflow-hidden rounded border bg-muted">
                          <ItemImage
                            src={item.imageUrl}
                            alt={item.name}
                            className="object-cover"
                            sizes="48px"
                          />
                        </div>
                      </TableCell>
                      <TableCell className="font-mono font-medium">{item.code}</TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        {item.supplierCode || "-"}
                      </TableCell>
                      <TableCell className="text-primary">
                        <div className="font-medium hover:underline">{item.name}</div>
                        {item.chineseName ? (
                          <div className="font-medium text-muted-foreground">
                            {item.chineseName}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>{item.category}</TableCell>
                      <TableCell className="text-right">
                        {Math.trunc(toNumber(item.onHand))}
                      </TableCell>
                      <TableCell className="text-right text-orange-600">
                        {Math.trunc(toNumber(item.allocated))}
                      </TableCell>
                      <TableCell className="text-right text-blue-600">
                        {Math.trunc(toNumber(item.inTransit))}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {(() => {
                          const availableValue = toNumber(item.available);
                          const reorderPointValue = toNumber(item.reorderPoint);
                          return (
                            <span
                              className={
                                availableValue <= 0
                                  ? "text-red-600"
                                  : availableValue <= reorderPointValue
                                    ? "text-yellow-600"
                                    : "text-green-600"
                              }
                            >
                              {Math.trunc(availableValue)}
                            </span>
                          );
                        })()}
                      </TableCell>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                      <TableCell className="text-right">
                        <div
                          className="flex justify-end gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <EditGuard resource={RESOURCES.ITEMS}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2"
                              onClick={() => handleEditItem(item)}
                              aria-label={t("editAriaLabel")}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              <span>{tCommon("edit")}</span>
                            </Button>
                          </EditGuard>
                          <DeleteGuard resource={RESOURCES.ITEMS}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  aria-label={t("moreActions")}
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => handleDeleteItem(item)}
                                  disabled={deleteItem.isPending}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span>{tCommon("delete")}</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
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
          <div className="sticky bottom-0 z-10 shrink-0 rounded-md border bg-card p-2 shadow-lg md:static md:shadow-none">
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
      {deleteDialogOpen && (
        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={confirmDelete}
          title={t("deleteTitle")}
          description={
            itemToDelete
              ? t("deleteDescriptionWithName", { name: itemToDelete.name })
              : t("deleteDescription")
          }
          confirmText={tCommon("delete")}
          cancelText={tCommon("cancel")}
          variant="destructive"
          isLoading={deleteItem.isPending}
        />
      )}
    </div>
  );
}

export default function ItemsPage() {
  return (
    <ProtectedRoute resource={RESOURCES.ITEMS} allowRenderWhileLoading>
      <ItemsPageContent />
    </ProtectedRoute>
  );
}
