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
import { useDeleteItem, useItemsStats, type ItemsWithStockResponse } from "@/hooks/useItems";
import { useInventoryItems } from "@/hooks/useInventoryItems";
import { ItemCategorySelect } from "@/components/items/ItemCategorySelect";
import type { ItemInventoryRow } from "@/types/item-inventory";
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
import { WarehouseSelect } from "@/components/warehouses/WarehouseSelect";
import { ProtectedRoute } from "@/components/permissions/ProtectedRoute";
import { EditGuard, DeleteGuard } from "@/components/permissions/PermissionGuard";
import { ItemImage } from "@/components/items/ItemImage";
import {
  InventoryItemMobileList,
  InventoryItemMobileListSkeleton,
} from "@/components/items/InventoryItemMobileList";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { RESOURCES } from "@/constants/resources";
import type { ItemWithStock } from "@/app/api/items/route";
import type { XlsxCellValue } from "@/lib/export/xlsx-workbook";

const ConfirmDialog = dynamic(
  () => import("@/components/shared/ConfirmDialog").then((mod) => mod.ConfirmDialog),
  { ssr: false }
);

type ItemExportFormat = "csv" | "xlsx" | "pdf";

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
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [exportingFormat, setExportingFormat] = useState<ItemExportFormat | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<ItemInventoryRow | null>(null);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  // Phones get stacked rows and a Filters panel; md and up keep the table and inline filters.
  // The match is unknown in server HTML, so that first paint uses CSS-switched skeletons
  // instead of committing either layout and swapping after hydration.
  const tableLayoutMatch = useMediaQuery("(min-width: 768px)");
  const isLayoutKnown = tableLayoutMatch !== undefined;
  const isTableLayout = tableLayoutMatch === true;

  const { formatCurrency } = useCurrency();
  const deleteItem = useDeleteItem();
  const currentBusinessUnit = useBusinessUnitStore((state) => state.currentBusinessUnit);
  const hasBusinessUnitHydrated = useBusinessUnitStore((state) => state.hasHydrated);
  const isBusinessUnitLoading = useBusinessUnitStore((state) => state.isLoading);
  const areItemQueriesEnabled =
    hasBusinessUnitHydrated && !isBusinessUnitLoading && Boolean(currentBusinessUnit?.id);

  const itemsQueryParams = useMemo<{
    search: string;
    page: number;
    limit: number;
    category: string | undefined;
    warehouseId: string | undefined;
    status: "normal" | "low_stock" | "out_of_stock" | "overstock" | "discontinued" | "all";
  }>(
    () => ({
      search,
      page,
      limit: pageSize,
      category: categoryFilter !== "all" ? categoryFilter : undefined,
      warehouseId: warehouseFilter || undefined,
      status:
        statusFilter !== "all"
          ? (statusFilter as "normal" | "low_stock" | "out_of_stock" | "overstock" | "discontinued")
          : "all",
    }),
    [search, page, pageSize, categoryFilter, warehouseFilter, statusFilter]
  );

  const { data, isLoading, isFetching, error } = useInventoryItems({
    ...itemsQueryParams,
    enabled: areItemQueriesEnabled,
  });
  const {
    data: statsData,
    isLoading: isStatsLoading,
    error: statsError,
  } = useItemsStats({
    warehouseId: warehouseFilter || undefined,
    includeStock: true,
    enabled: areItemQueriesEnabled,
  });

  useEffect(() => {
    if (searchInput.trim() === search) return;
    const timeoutId = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput, search]);

  useEffect(() => {
    setWarehouseFilter("");
    setPage(1);
  }, [currentBusinessUnit?.id]);

  const isInitialLoading = isLoading || !areItemQueriesEnabled;
  const items = data?.data || [];
  const pagination = data?.pagination;
  const statistics = statsData?.statistics;
  const hasStatsError = Boolean(statsError);
  const isStatsPending = isStatsLoading && !statsData;

  // Use statistics from API (calculated from all filtered items, not just current page)
  const lowStockItems = statistics?.lowStockCount;
  const outOfStockItems = statistics?.outOfStockCount;
  const totalValue = statistics?.totalAvailableValue;
  const totalItems = statistics?.totalCount;
  const canViewTotalAvailableValue = statsData?.capabilities?.canViewTotalAvailableValue === true;

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

  const activeFilterCount =
    Number(categoryFilter !== "all") +
    Number(Boolean(warehouseFilter)) +
    Number(statusFilter !== "all");

  const clearFilters = () => {
    setCategoryFilter("all");
    setWarehouseFilter("");
    setStatusFilter("all");
    setPage(1);
  };

  const handleCreateItem = () => {
    router.push("/inventory/items/create");
  };

  const handleViewItem = (itemId: string) => {
    router.push(`/inventory/items/${itemId}`);
  };

  const handleEditItem = (item: ItemInventoryRow) => {
    router.push(`/inventory/items/${item.id}/edit`);
  };

  const handleDeleteItem = (item: ItemInventoryRow) => {
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

  const getExportFileName = (format: ItemExportFormat) =>
    `inventory-items-${new Date().toISOString().split("T")[0]}.${format}`;

  const downloadBlob = (blob: Blob, fileName: string) => {
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getExportColumns = () => [
    t("itemCode"),
    t("itemName"),
    t("category"),
    t("uom"),
    t("onHand"),
    t("allocated"),
    t("putawayQty"),
    t("available"),
    tCommon("status"),
    t("purchasePrice"),
    t("listPrice"),
  ];

  const getStatusLabel = (status?: ItemWithStock["status"]) => {
    if (!status) return t("unknown");
    const statusLabels: Record<ItemWithStock["status"], string> = {
      normal: t("normal"),
      low_stock: t("lowStock"),
      out_of_stock: t("outOfStock"),
      overstock: t("overstock"),
      discontinued: t("discontinued"),
    };
    return statusLabels[status] ?? t("unknown");
  };

  const getExportRows = (exportItems: ItemWithStock[]) =>
    exportItems.map((item) => [
      item.code,
      item.name,
      item.category,
      item.uom || "",
      item.onHand,
      item.allocated,
      item.putawayQty,
      item.available,
      getStatusLabel(item.status),
      item.purchasePrice,
      item.listPrice,
    ]);

  const downloadItemsCsv = (headers: string[], rows: XlsxCellValue[][]) => {
    const csvContent = [
      headers.map(escapeCsvCell).join(","),
      ...rows.map((row) => row.map(escapeCsvCell).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, getExportFileName("csv"));
  };

  const downloadItemsXlsx = async (headers: string[], rows: XlsxCellValue[][]) => {
    const { createXlsxWorkbookBlob } = await import("@/lib/export/xlsx-workbook");
    const blob = createXlsxWorkbookBlob(t("title"), [headers, ...rows]);
    downloadBlob(blob, getExportFileName("xlsx"));
  };

  const downloadItemsPdf = async (headers: string[], rows: XlsxCellValue[][]) => {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const margin = 28;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const tableWidth = pageWidth - margin * 2;
    const columnWidths = [58, 140, 76, 42, 48, 48, 58, 58, 48, 58, 58, 58];
    const scale = tableWidth / columnWidths.reduce((sum, width) => sum + width, 0);
    const widths = columnWidths.map((width) => width * scale);
    const rowHeight = 24;
    let y = margin;

    const drawHeader = () => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(t("title"), margin, y);
      y += 20;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(new Date().toLocaleString(), margin, y);
      y += 18;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      let x = margin;
      headers.forEach((header, index) => {
        doc.text(doc.splitTextToSize(header, widths[index] - 4), x + 2, y);
        x += widths[index];
      });
      y += rowHeight;
      doc.line(margin, y - 8, pageWidth - margin, y - 8);
      doc.setFont("helvetica", "normal");
    };

    drawHeader();

    rows.forEach((row) => {
      if (y + rowHeight > pageHeight - margin) {
        doc.addPage();
        y = margin;
        drawHeader();
      }

      let x = margin;
      row.forEach((value, index) => {
        const text = String(value ?? "");
        const lines = doc.splitTextToSize(text, widths[index] - 4).slice(0, 2);
        doc.text(lines, x + 2, y);
        x += widths[index];
      });
      y += rowHeight;
    });

    doc.save(getExportFileName("pdf"));
  };

  const handleExportItems = async (format: ItemExportFormat) => {
    if (!areItemQueriesEnabled || exportingFormat) return;

    setExportingFormat(format);
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
      params.append("exportMode", format);

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
      const exportItems = exportData.data || [];
      if (exportItems.length === 0) {
        toast.error(t("noDataToExport"));
        return;
      }

      const headers = getExportColumns();
      const rows = getExportRows(exportItems);
      if (format === "csv") {
        downloadItemsCsv(headers, rows);
      } else if (format === "xlsx") {
        await downloadItemsXlsx(headers, rows);
      } else {
        await downloadItemsPdf(headers, rows);
      }
      toast.success(t("exportSuccess"));
    } catch {
      toast.error(t("exportError"));
    } finally {
      setExportingFormat(null);
    }
  };

  const filterControlClassName = isTableLayout ? undefined : "h-11 w-full";
  const searchField = (
    <div className="relative min-w-0 flex-1 md:min-w-[200px]">
      <Search className="absolute left-2 top-3.5 h-4 w-4 text-muted-foreground md:top-2.5" />
      <Input
        placeholder={t("searchPlaceholder")}
        value={searchInput}
        onChange={(e) => {
          setSearchInput(e.target.value);
        }}
        className="h-11 pl-8 md:h-10"
      />
    </div>
  );
  const categoryFilterControl = (
    <ItemCategorySelect
      id="inventory-item-category-filter"
      value={categoryFilter}
      onValueChange={(value) => {
        setCategoryFilter(value);
        setPage(1);
      }}
      allowAll
      buttonClassName={filterControlClassName ?? "w-48"}
    />
  );
  const warehouseFilterControl = (
    <WarehouseSelect
      value={warehouseFilter}
      onValueChange={(value) => {
        setWarehouseFilter(value);
        setPage(1);
      }}
      scope="current_business_unit"
      allowAll
      allOptionLabel={t("buInventory")}
      showCodeInLabel={false}
      disabled={!currentBusinessUnit?.id}
      buttonClassName={filterControlClassName ?? "w-56"}
    />
  );
  const statusFilterControl = (
    <Select
      value={statusFilter}
      onValueChange={(value) => {
        setStatusFilter(value);
        setPage(1);
      }}
    >
      <SelectTrigger
        id="inventory-item-status-filter"
        className={filterControlClassName ?? "w-[180px]"}
      >
        {/* The phone panel labels the field, so the funnel only marks the inline filter. */}
        {isTableLayout ? <Filter className="mr-2 h-4 w-4 shrink-0" /> : null}
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
  );

  const tableSkeleton = (
    <div className="h-full overflow-y-auto overscroll-contain rounded-md border">
      <Table containerClassName="overflow-visible">
        <TableHeader className="sticky top-0 z-10 bg-background shadow-sm [&_th]:bg-background">
          <TableRow>
            <TableHead className="w-[80px]">{t("image")}</TableHead>
            <TableHead>{t("itemCode")}</TableHead>
            <TableHead className="w-72">{t("itemName")}</TableHead>
            <TableHead>{t("category")}</TableHead>
            <TableHead className="text-right">{t("onHand")}</TableHead>
            <TableHead className="text-right">{t("allocated")}</TableHead>
            <TableHead className="text-right">{t("putawayQty")}</TableHead>
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
                <Skeleton className="h-8 w-56" />
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
  );

  return (
    <div className="flex flex-col gap-2 sm:gap-4 md:h-full md:gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="whitespace-nowrap text-lg font-semibold tracking-tight sm:text-xl">
            {t("title")}
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">{t("subtitle")}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                disabled={Boolean(exportingFormat) || !areItemQueriesEnabled}
                className="h-11 w-full flex-shrink-0 sm:h-10 sm:w-auto"
              >
                <Download className="mr-2 h-4 w-4" />
                <span className="sm:inline">{exportingFormat ? t("exporting") : t("export")}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExportItems("csv")}>
                <Download className="h-4 w-4" />
                <span>{t("exportCsv")}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportItems("xlsx")}>
                <Download className="h-4 w-4" />
                <span>{t("exportXlsx")}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportItems("pdf")}>
                <Download className="h-4 w-4" />
                <span>{t("exportPdf")}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            onClick={handleCreateItem}
            className="h-11 w-full flex-shrink-0 sm:h-10 sm:w-auto"
          >
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
              aria-pressed={isFilterCard ? isActiveFilter : undefined}
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
                  ? `cursor-pointer rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hover:-translate-y-0.5 md:hover:shadow-md ${
                      isActiveFilter ? "ring-2 ring-primary" : ""
                    }`
                  : undefined
              }
            >
              <MetricCard
                title={stat.title}
                icon={Icon}
                className="h-full"
                headerClassName="max-md:p-3 max-md:pb-1"
                contentClassName="max-md:min-h-0 max-md:gap-1 max-md:p-3 max-md:pt-0"
                iconClassName={`h-3 w-3 md:h-4 md:w-4 ${stat.iconColor}`}
                value={String(stat.value)}
                caption={
                  isFilterCard ? (
                    <span className="flex items-start gap-1">
                      <Filter
                        aria-hidden="true"
                        className={`mt-0.5 h-3 w-3 shrink-0 ${
                          isActiveFilter ? "fill-primary text-primary" : ""
                        }`}
                      />
                      {stat.description}
                    </span>
                  ) : (
                    stat.description
                  )
                }
                isLoading={!areItemQueriesEnabled || isStatsPending}
                skeletonCaption={false}
                valueClassName="text-lg font-bold max-md:break-all md:text-2xl"
              />
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 sm:gap-3 md:min-h-0 md:flex-1 md:gap-4">
        {/* Filters */}
        {!isLayoutKnown ? (
          <Skeleton className="h-11 w-full md:h-10" />
        ) : isTableLayout ? (
          <div className="flex flex-row flex-wrap gap-3">
            {searchField}
            {categoryFilterControl}
            {warehouseFilterControl}
            {statusFilterControl}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              {searchField}
              <Button
                variant="outline"
                className="h-11 shrink-0"
                aria-expanded={isFilterPanelOpen}
                aria-controls="inventory-item-filters"
                onClick={() => setIsFilterPanelOpen((open) => !open)}
              >
                <Filter className="h-4 w-4" />
                {t("filters")}
                {activeFilterCount > 0 ? (
                  <span className="rounded-full bg-violet-700 px-1.5 text-xs font-semibold tabular-nums text-white">
                    {activeFilterCount}
                  </span>
                ) : null}
              </Button>
            </div>
            {/* Kept mounted while collapsed so the pickers keep their selected labels. */}
            <div
              id="inventory-item-filters"
              hidden={!isFilterPanelOpen}
              className={`${isFilterPanelOpen ? "flex" : "hidden"} flex-col gap-3 rounded-md border p-3`}
            >
              <div className="flex flex-col gap-1.5">
                <label htmlFor="inventory-item-category-filter" className="text-sm font-medium">
                  {t("category")}
                </label>
                {categoryFilterControl}
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">{t("warehouse")}</span>
                {warehouseFilterControl}
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="inventory-item-status-filter" className="text-sm font-medium">
                  {tCommon("status")}
                </label>
                {statusFilterControl}
              </div>
              <Button
                variant="ghost"
                className="h-11"
                onClick={clearFilters}
                disabled={activeFilterCount === 0}
              >
                {t("clearAllFilters")}
              </Button>
            </div>
          </div>
        )}

        <div role="status" aria-live="polite" className="h-4 text-xs text-muted-foreground">
          {isFetching && !isInitialLoading ? t("refreshing") : null}
        </div>
        {/* Table. md:min-h-96 keeps about four rows on short screens: the page scrolls
            instead of the table collapsing to nothing. */}
        <div className="md:min-h-96 md:flex-1">
          {!isLayoutKnown ? (
            <>
              <div className="md:hidden">
                <InventoryItemMobileListSkeleton rows={4} />
              </div>
              <div className="h-full max-md:hidden">{tableSkeleton}</div>
            </>
          ) : isInitialLoading && !isTableLayout ? (
            <InventoryItemMobileListSkeleton rows={4} />
          ) : isInitialLoading ? (
            tableSkeleton
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
          ) : !isTableLayout ? (
            <InventoryItemMobileList
              items={items}
              renderStatus={getStatusBadge}
              formatQuantity={(value) => Math.trunc(toNumber(value))}
              onEditItem={handleEditItem}
              onDeleteItem={handleDeleteItem}
              isDeletePending={deleteItem.isPending}
            />
          ) : (
            <div className="h-full overflow-auto overscroll-contain rounded-md border">
              <Table containerClassName="min-w-[1240px] overflow-visible">
                <TableHeader className="sticky top-0 z-10 bg-background shadow-sm [&_th]:bg-background">
                  <TableRow>
                    <TableHead className="w-[80px]">{t("image")}</TableHead>
                    <TableHead>{t("itemCode")}</TableHead>
                    <TableHead className="w-72">{t("itemName")}</TableHead>
                    <TableHead>{t("category")}</TableHead>
                    <TableHead className="text-right">{t("onHand")}</TableHead>
                    <TableHead className="text-right">{t("allocated")}</TableHead>
                    <TableHead className="text-right">{t("putawayQty")}</TableHead>
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
                      <TableCell className="font-medium tabular-nums">{item.code}</TableCell>
                      <TableCell className="w-72 max-w-72 whitespace-normal break-words text-violet-700 dark:text-violet-300">
                        <div
                          className="font-semibold leading-snug hover:underline"
                          title={item.name}
                        >
                          {item.name}
                        </div>
                        {item.chineseName ? (
                          <div
                            className="mt-1 font-medium leading-snug text-muted-foreground"
                            title={item.chineseName}
                          >
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
                      <TableCell className="text-right text-purple-600">
                        {Math.trunc(toNumber(item.putawayQty))}
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
          <div className="shrink-0 rounded-md border bg-card p-3 md:p-2">
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
