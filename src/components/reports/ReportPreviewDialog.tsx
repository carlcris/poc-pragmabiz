"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Download, Eye, Loader2, Printer } from "lucide-react";
import { useItemCategories } from "@/hooks/useItemCategories";
import { useItemLocationBatchReport } from "@/hooks/useItemLocationBatchReport";
import { useItems } from "@/hooks/useItems";
import {
  usePickingEfficiencyReport,
  type PickingEfficiencyFilters,
} from "@/hooks/usePickingEfficiencyReport";
import {
  useInventoryReport,
  type InventoryReportSortBy,
  type InventoryStockStatus,
} from "@/hooks/useInventoryReport";
import {
  useStockMovement,
  useStockValuation,
  type StockMovementFilters,
  type StockValuationFilters,
} from "@/hooks/useStockReports";
import {
  useShipmentsReport,
  type ShipmentStageFilter,
} from "@/hooks/useShipmentsReport";
import {
  useStockAgingReport,
  type StockAgingAgeBucket,
  type StockAgingReportRow,
} from "@/hooks/useStockAgingReport";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useTransformationEfficiencyReport } from "@/hooks/useTransformationEfficiencyReport";
import { useTransformationTemplates } from "@/hooks/useTransformationTemplates";
import { useUsers } from "@/hooks/useUsers";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type SupportedReportPreviewType =
  | "inventory"
  | "stock-aging"
  | "shipments"
  | "stock"
  | "item-location-batch"
  | "picking-efficiency"
  | "transformation-efficiency";

type ReportPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportName: string;
  reportType: SupportedReportPreviewType | null;
};

type ReportPreviewPanelProps = {
  open: boolean;
  reportName: string;
  onPreviewStateChange: (state: { url: string | null; isGenerating: boolean; fileName: string }) => void;
};

type PreviewFrameProps = {
  url: string | null;
  isGenerating: boolean;
  emptyLabel: string;
  loadingLabel: string;
  title: string;
};

function PreviewFrame({ url, isGenerating, emptyLabel, loadingLabel, title }: PreviewFrameProps) {
  if (isGenerating) {
    return (
      <div className="flex h-full min-h-[560px] items-center justify-center rounded-lg border bg-muted/30">
        <div className="text-center">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{loadingLabel}</p>
        </div>
      </div>
    );
  }

  if (!url) {
    return (
      <div className="flex h-full min-h-[560px] items-center justify-center rounded-lg border border-dashed bg-muted/20 px-6 text-center">
        <div className="max-w-sm space-y-2">
          <Eye className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-[560px] overflow-hidden rounded-lg border bg-white">
      <iframe src={url} title={title} className="h-full min-h-[560px] w-full border-0" />
    </div>
  );
}

function printPdfPreview(url: string | null) {
  if (!url) return;
  const printWindow = window.open(url, "_blank");
  if (!printWindow) return;
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };
}

function downloadPdfPreview(url: string | null, fileName: string) {
  if (!url) return;
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function usePdfPreviewState(open: boolean) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);

  useEffect(() => {
    if (!open && previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  }, [open, previewUrl]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const replacePreviewUrl = useCallback((nextUrl: string | null) => {
    setPreviewUrl((currentUrl) => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
      return nextUrl;
    });
  }, []);

  return {
    previewUrl,
    isGeneratingPreview,
    setIsGeneratingPreview,
    replacePreviewUrl,
  };
}

function InventoryReportPreview({
  open,
  reportName,
  onPreviewStateChange,
}: {
  open: boolean;
  reportName: string;
  onPreviewStateChange: ReportPreviewPanelProps["onPreviewStateChange"];
}) {
  const tReports = useTranslations("reportsPage");
  const t = useTranslations("inventoryReportPage");
  const locale = useLocale();
  const currentBusinessUnit = useBusinessUnitStore((state) => state.currentBusinessUnit);
  const { data: warehousesData } = useWarehouses({ limit: 50 });
  const { data: categoriesData } = useItemCategories();
  const warehouses = useMemo(
    () => warehousesData?.data?.filter((warehouse) => warehouse.isActive) || [],
    [warehousesData?.data]
  );
  const categories = categoriesData?.data || [];
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [category, setCategory] = useState("all");
  const [stockStatus, setStockStatus] = useState<InventoryStockStatus>("all");
  const { previewUrl, isGeneratingPreview, setIsGeneratingPreview, replacePreviewUrl } =
    usePdfPreviewState(open);
  const selectedWarehouse = useMemo(
    () => warehouses.find((warehouse) => warehouse.id === warehouseId) ?? null,
    [warehouseId, warehouses]
  );
  const selectedWarehouseLabel = selectedWarehouse
    ? `${selectedWarehouse.code} - ${selectedWarehouse.name}`
    : t("noValue");

  const reportQuery = useInventoryReport({
    enabled: false,
    page: 1,
    limit: 50,
    search: search || undefined,
    warehouseId,
    category: category === "all" ? undefined : category,
    stockStatus,
    sortBy: "updated_at" satisfies InventoryReportSortBy,
    sortOrder: "desc",
  });

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearch(searchInput.trim());
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    if (!open || warehouseId || warehouses.length === 0) return;

    const currentContextWarehouse =
      warehouses.find((warehouse) => warehouse.businessUnitId === currentBusinessUnit?.id) ?? warehouses[0];
    setWarehouseId(currentContextWarehouse.id);
  }, [currentBusinessUnit?.id, open, warehouseId, warehouses]);

  useEffect(() => {
    replacePreviewUrl(null);
  }, [search, warehouseId, category, stockStatus, replacePreviewUrl]);

  useEffect(() => {
    onPreviewStateChange({
      url: previewUrl,
      isGenerating: isGeneratingPreview,
      fileName: `inventory-report-${new Date().toISOString().slice(0, 10)}.pdf`,
    });
  }, [isGeneratingPreview, onPreviewStateChange, previewUrl]);

  const formatNumber = (value: number, digits = 0) =>
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(Number.isFinite(value) ? value : 0);

  const handlePreview = async () => {
    if (!warehouseId) return;

    setIsGeneratingPreview(true);
    try {
      const { data } = await reportQuery.refetch();
      if (!data) return;

      const [{ pdf }, { InventoryReportPDF }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/reports/InventoryReportPDF"),
      ]);

      const blob = await pdf(
        <InventoryReportPDF
          title={t("title")}
          subtitle={t("subtitle")}
          generatedAtLabel={t("generatedAt")}
          warehouseValueLabel={`${t("warehouse")}: ${selectedWarehouseLabel}`}
          itemLabel={t("item")}
          categoryLabel={t("category")}
          qtyOnHandLabel={t("qtyOnHand")}
          qtyReservedLabel={t("qtyReserved")}
          qtyAvailableLabel={t("qtyAvailable")}
          qtyInTransitLabel={t("qtyInTransit")}
          statusLabel={t("status")}
          unitCostLabel={t("unitCost")}
          stockValueLabel={t("stockValue")}
          noValueLabel={t("noValue")}
          pageSummary={t("pageOfTotal", {
            page: formatNumber(data.pagination.page),
            totalPages: formatNumber(data.pagination.totalPages),
            total: formatNumber(data.pagination.total),
          })}
          statusLabels={{
            all: t("allStatuses"),
            on_hand: t("on_hand"),
            available: t("available"),
            allocated: t("allocated"),
            in_transit: t("in_transit"),
            zero: t("zero"),
          }}
          rows={data.data}
        />
      ).toBlob();

      replacePreviewUrl(URL.createObjectURL(blob));
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  return (
    <div className="grid h-full min-h-0 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <div className="flex h-full min-h-0 flex-col rounded-lg border bg-muted/20 p-4">
        <div className="space-y-1">
          <h3 className="font-semibold">{tReports("reportSettings")}</h3>
        </div>
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
          <label className="text-sm font-medium">{t("itemSearch")}</label>
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t("searchPlaceholder")}
          />
          </div>
          <div className="space-y-2">
          <label className="text-sm font-medium">{t("warehouse")}</label>
          <Select value={warehouseId} onValueChange={setWarehouseId}>
            <SelectTrigger>
              <SelectValue placeholder={t("selectWarehouse")} />
            </SelectTrigger>
            <SelectContent>
              {warehouses.map((warehouse) => (
                <SelectItem key={warehouse.id} value={warehouse.id}>
                  {warehouse.code} - {warehouse.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          </div>
          <div className="space-y-2">
          <label className="text-sm font-medium">{t("category")}</label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue placeholder={t("allCategories")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allCategories")}</SelectItem>
              {categories.map((itemCategory) => (
                <SelectItem key={itemCategory.id} value={itemCategory.name}>
                  {itemCategory.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          </div>
          <div className="space-y-2">
          <label className="text-sm font-medium">{t("status")}</label>
          <Select value={stockStatus} onValueChange={(value) => setStockStatus(value as InventoryStockStatus)}>
            <SelectTrigger>
              <SelectValue placeholder={t("allStatuses")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allStatuses")}</SelectItem>
              <SelectItem value="on_hand">{t("on_hand")}</SelectItem>
              <SelectItem value="available">{t("available")}</SelectItem>
              <SelectItem value="allocated">{t("allocated")}</SelectItem>
              <SelectItem value="in_transit">{t("in_transit")}</SelectItem>
              <SelectItem value="zero">{t("zero")}</SelectItem>
            </SelectContent>
          </Select>
          </div>
        </div>
        <div className="mt-auto pt-6">
          <Button
            className="w-full"
            onClick={handlePreview}
            disabled={
              reportQuery.isFetching ||
              isGeneratingPreview ||
              !warehouseId
            }
          >
            {isGeneratingPreview ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Eye className="mr-2 h-4 w-4" />
            )}
            {tReports("preview")}
          </Button>
        </div>
      </div>

      <div className="flex h-full min-h-0 flex-col gap-4">
        <PreviewFrame
          url={previewUrl}
          isGenerating={isGeneratingPreview}
          emptyLabel={tReports("previewPlaceholder")}
          loadingLabel={tReports("generatingPreview")}
          title={tReports("previewFrameTitle", { report: reportName })}
        />
      </div>
    </div>
  );
}

function StockAgingReportPreview({
  open,
  reportName,
  onPreviewStateChange,
}: {
  open: boolean;
  reportName: string;
  onPreviewStateChange: ReportPreviewPanelProps["onPreviewStateChange"];
}) {
  const tReports = useTranslations("reportsPage");
  const t = useTranslations("stockAgingReportPage");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [ageBucket, setAgeBucket] = useState<StockAgingAgeBucket>("90_plus");
  const { data: categoriesData } = useItemCategories();
  const categories = categoriesData?.data || [];
  const { previewUrl, isGeneratingPreview, setIsGeneratingPreview, replacePreviewUrl } =
    usePdfPreviewState(open);

  const reportQuery = useStockAgingReport({
    enabled: false,
    page: 1,
    limit: 50,
    search: search || undefined,
    category: category === "all" ? undefined : category,
    ageBucket,
  });

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearch(searchInput.trim());
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    replacePreviewUrl(null);
  }, [search, category, ageBucket, replacePreviewUrl]);

  useEffect(() => {
    onPreviewStateChange({
      url: previewUrl,
      isGenerating: isGeneratingPreview,
      fileName: `stock-aging-report-${new Date().toISOString().slice(0, 10)}.pdf`,
    });
  }, [isGeneratingPreview, onPreviewStateChange, previewUrl]);

  const handlePreview = async () => {
    setIsGeneratingPreview(true);
    try {
      const { data } = await reportQuery.refetch();
      if (!data) return;

      const previewGroups = data.data.reduce<
        Array<{
          itemId: string;
          itemName: string;
          itemCode: string | null;
          category: string;
          rows: StockAgingReportRow[];
          subtotalQtyOnHand: number;
          subtotalQtyReserved: number;
          subtotalQtyAvailable: number;
          subtotalStockValue: number;
          oldestAgeDays: number;
        }>
      >((groups, row) => {
        const lastGroup = groups[groups.length - 1];
        if (lastGroup && lastGroup.itemId === row.itemId) {
          lastGroup.rows.push(row);
          lastGroup.subtotalQtyOnHand += row.qtyOnHand;
          lastGroup.subtotalQtyReserved += row.qtyReserved;
          lastGroup.subtotalQtyAvailable += row.qtyAvailable;
          lastGroup.subtotalStockValue += row.stockValue;
          lastGroup.oldestAgeDays = Math.max(lastGroup.oldestAgeDays, row.batchAgeDays);
          return groups;
        }

        groups.push({
          itemId: row.itemId,
          itemName: row.itemName || row.itemCode || row.itemId,
          itemCode: row.itemCode,
          category: row.category,
          rows: [row],
          subtotalQtyOnHand: row.qtyOnHand,
          subtotalQtyReserved: row.qtyReserved,
          subtotalQtyAvailable: row.qtyAvailable,
          subtotalStockValue: row.stockValue,
          oldestAgeDays: row.batchAgeDays,
        });

        return groups;
      }, []);

      const [{ pdf }, { StockAgingReportPDF }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/reports/StockAgingReportPDF"),
      ]);

      const blob = await pdf(
        <StockAgingReportPDF
          title={t("title")}
          subtitle={t("subtitle")}
          generatedAtLabel={t("generatedAt")}
          warehouseLocationLabel={t("warehouseLocation")}
          batchLabel={t("batch")}
          ageDaysLabel={t("ageDays")}
          qtyOnHandLabel={t("qtyOnHand")}
          qtyReservedLabel={t("qtyReserved")}
          qtyAvailableLabel={t("qtyAvailable")}
          stockValueLabel={t("stockValue")}
          updatedAtLabel={t("updatedAt")}
          itemSubtotalLabel={t("itemSubtotal")}
          noValueLabel={t("noValue")}
          groups={previewGroups}
          currentPage={data.pagination.page}
          totalPages={data.pagination.totalPages}
          totalRows={data.pagination.total}
        />
      ).toBlob();

      replacePreviewUrl(URL.createObjectURL(blob));
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  return (
    <div className="grid h-full min-h-0 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <div className="flex h-full min-h-0 flex-col rounded-lg border bg-muted/20 p-4">
        <div className="space-y-1">
          <h3 className="font-semibold">{tReports("reportSettings")}</h3>
        </div>
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
          <label className="text-sm font-medium">{t("itemSearch")}</label>
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t("searchPlaceholder")}
          />
          </div>
          <div className="space-y-2">
          <label className="text-sm font-medium">{t("category")}</label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue placeholder={t("allCategories")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allCategories")}</SelectItem>
              {categories.map((itemCategory) => (
                <SelectItem key={itemCategory.id} value={itemCategory.name}>
                  {itemCategory.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          </div>
          <div className="space-y-2">
          <label className="text-sm font-medium">{t("ageBucket")}</label>
          <Select value={ageBucket} onValueChange={(value) => setAgeBucket(value as StockAgingAgeBucket)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="90_plus">{t("bucket90Plus")}</SelectItem>
              <SelectItem value="all">{t("allAges")}</SelectItem>
              <SelectItem value="0_30">{t("bucket0to30")}</SelectItem>
              <SelectItem value="31_60">{t("bucket31to60")}</SelectItem>
              <SelectItem value="61_90">{t("bucket61to90")}</SelectItem>
              <SelectItem value="91_180">{t("bucket91to180")}</SelectItem>
              <SelectItem value="181_plus">{t("bucket181Plus")}</SelectItem>
            </SelectContent>
          </Select>
          </div>
        </div>
        <div className="mt-auto pt-6">
          <Button
            className="w-full"
            onClick={handlePreview}
            disabled={
              reportQuery.isFetching ||
              isGeneratingPreview
            }
          >
            {isGeneratingPreview ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Eye className="mr-2 h-4 w-4" />
            )}
            {tReports("preview")}
          </Button>
        </div>
      </div>

      <div className="flex h-full min-h-0 flex-col gap-4">
        <PreviewFrame
          url={previewUrl}
          isGenerating={isGeneratingPreview}
          emptyLabel={tReports("previewPlaceholder")}
          loadingLabel={tReports("generatingPreview")}
          title={tReports("previewFrameTitle", { report: reportName })}
        />
      </div>
    </div>
  );
}

function ShipmentsReportPreview({
  open,
  reportName,
  onPreviewStateChange,
}: {
  open: boolean;
  reportName: string;
  onPreviewStateChange: ReportPreviewPanelProps["onPreviewStateChange"];
}) {
  const tReports = useTranslations("reportsPage");
  const t = useTranslations("shipmentsReportPage");
  const locale = useLocale();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [supplierId, setSupplierId] = useState("all");
  const [shipmentStage, setShipmentStage] = useState<ShipmentStageFilter>("all");
  const { data: suppliersData } = useSuppliers({ page: 1, limit: 50 });
  const suppliers = suppliersData?.data || [];
  const { previewUrl, isGeneratingPreview, setIsGeneratingPreview, replacePreviewUrl } =
    usePdfPreviewState(open);

  const reportQuery = useShipmentsReport({
    enabled: false,
    page: 1,
    limit: 50,
    search: search || undefined,
    supplierId: supplierId === "all" ? undefined : supplierId,
    shipmentStage,
  });

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearch(searchInput.trim());
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    replacePreviewUrl(null);
  }, [search, supplierId, shipmentStage, replacePreviewUrl]);

  useEffect(() => {
    onPreviewStateChange({
      url: previewUrl,
      isGenerating: isGeneratingPreview,
      fileName: `shipments-report-${new Date().toISOString().slice(0, 10)}.pdf`,
    });
  }, [isGeneratingPreview, onPreviewStateChange, previewUrl]);

  const formatNumber = (value: number, digits = 0) =>
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(Number.isFinite(value) ? value : 0);

  const handlePreview = async () => {
    setIsGeneratingPreview(true);
    try {
      const { data } = await reportQuery.refetch();
      if (!data) return;

      const [{ pdf }, { ShipmentsReportPDF }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/reports/ShipmentsReportPDF"),
      ]);

      const blob = await pdf(
        <ShipmentsReportPDF
          title={t("title")}
          subtitle={t("subtitle")}
          generatedAtLabel={t("generatedAt")}
          loadListLabel={t("loadList")}
          supplierLabel={t("supplier")}
          containerSealLabel={t("containerSeal")}
          shipmentStageLabel={t("shipmentStage")}
          etaLabel={t("eta")}
          actualArrivalLabel={t("actualArrival")}
          quantityLabel={t("quantity")}
          valueLabel={t("value")}
          noValueLabel={t("noValue")}
          loadingLabel={t("incoming")}
          inTransitLabel={t("inTransit")}
          arrivedLabel={t("arrived")}
          pageSummary={t("pageOfTotal", {
            page: formatNumber(data.pagination.page),
            totalPages: formatNumber(data.pagination.totalPages),
            total: formatNumber(data.pagination.total),
          })}
          rows={data.data}
        />
      ).toBlob();

      replacePreviewUrl(URL.createObjectURL(blob));
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  return (
    <div className="grid h-full min-h-0 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <div className="flex h-full min-h-0 flex-col rounded-lg border bg-muted/20 p-4">
        <div className="space-y-1">
          <h3 className="font-semibold">{tReports("reportSettings")}</h3>
        </div>
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
          <label className="text-sm font-medium">{t("search")}</label>
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t("searchPlaceholder")}
          />
          </div>
          <div className="space-y-2">
          <label className="text-sm font-medium">{t("supplier")}</label>
          <Select value={supplierId} onValueChange={setSupplierId}>
            <SelectTrigger>
              <SelectValue placeholder={t("allSuppliers")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allSuppliers")}</SelectItem>
              {suppliers.map((supplier) => (
                <SelectItem key={supplier.id} value={supplier.id}>
                  {supplier.code} - {supplier.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          </div>
          <div className="space-y-2">
          <label className="text-sm font-medium">{t("shipmentStage")}</label>
          <Select value={shipmentStage} onValueChange={(value) => setShipmentStage(value as ShipmentStageFilter)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allStages")}</SelectItem>
              <SelectItem value="incoming">{t("incoming")}</SelectItem>
              <SelectItem value="in_transit">{t("inTransit")}</SelectItem>
              <SelectItem value="arrived">{t("arrived")}</SelectItem>
            </SelectContent>
          </Select>
          </div>
        </div>
        <div className="mt-auto pt-6">
          <Button
            className="w-full"
            onClick={handlePreview}
            disabled={
              reportQuery.isFetching ||
              isGeneratingPreview
            }
          >
            {isGeneratingPreview ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Eye className="mr-2 h-4 w-4" />
            )}
            {tReports("preview")}
          </Button>
        </div>
      </div>

      <div className="flex h-full min-h-0 flex-col gap-4">
        <PreviewFrame
          url={previewUrl}
          isGenerating={isGeneratingPreview}
          emptyLabel={tReports("previewPlaceholder")}
          loadingLabel={tReports("generatingPreview")}
          title={tReports("previewFrameTitle", { report: reportName })}
        />
      </div>
    </div>
  );
}

function StockReportsPreview({
  open,
  reportName,
  onPreviewStateChange,
}: {
  open: boolean;
  reportName: string;
  onPreviewStateChange: ReportPreviewPanelProps["onPreviewStateChange"];
}) {
  const tReports = useTranslations("reportsPage");
  const t = useTranslations("stockReportsPage");
  const locale = useLocale();
  type StockMovementGroupBy = NonNullable<StockMovementFilters["groupBy"]>;
  type StockValuationGroupBy = NonNullable<StockValuationFilters["groupBy"]>;

  const [reportMode, setReportMode] = useState<"movement" | "valuation">("movement");
  const [movementStartDate, setMovementStartDate] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [movementEndDate, setMovementEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [movementWarehouseId, setMovementWarehouseId] = useState("all");
  const [movementItemId, setMovementItemId] = useState("all");
  const [movementGroupBy, setMovementGroupBy] = useState<StockMovementGroupBy>("item");
  const [valuationWarehouseId, setValuationWarehouseId] = useState("all");
  const [valuationItemId, setValuationItemId] = useState("all");
  const [valuationCategory, setValuationCategory] = useState("all");
  const [valuationGroupBy, setValuationGroupBy] = useState<StockValuationGroupBy>("item");
  const { data: itemsData } = useItems({ limit: 50 });
  const { data: warehousesData } = useWarehouses({ limit: 50 });
  const items = itemsData?.data ?? [];
  const warehouses = warehousesData?.data || [];
  const categories = useMemo(
    () => Array.from(new Set((itemsData?.data ?? []).map((item) => item.category).filter(Boolean))),
    [itemsData?.data]
  );
  const { previewUrl, isGeneratingPreview, setIsGeneratingPreview, replacePreviewUrl } =
    usePdfPreviewState(open);

  const movementQuery = useStockMovement({
    enabled: false,
    startDate: movementStartDate,
    endDate: movementEndDate,
    warehouseId: movementWarehouseId === "all" ? undefined : movementWarehouseId,
    itemId: movementItemId === "all" ? undefined : movementItemId,
    groupBy: movementGroupBy,
  });
  const valuationQuery = useStockValuation({
    enabled: false,
    warehouseId: valuationWarehouseId === "all" ? undefined : valuationWarehouseId,
    itemId: valuationItemId === "all" ? undefined : valuationItemId,
    category: valuationCategory === "all" ? undefined : valuationCategory,
    groupBy: valuationGroupBy,
  });

  useEffect(() => {
    replacePreviewUrl(null);
  }, [
    reportMode,
    movementStartDate,
    movementEndDate,
    movementWarehouseId,
    movementItemId,
    movementGroupBy,
    valuationWarehouseId,
    valuationItemId,
    valuationCategory,
    valuationGroupBy,
    replacePreviewUrl,
  ]);

  useEffect(() => {
    onPreviewStateChange({
      url: previewUrl,
      isGenerating: isGeneratingPreview,
      fileName: `stock-report-${reportMode}-${new Date().toISOString().slice(0, 10)}.pdf`,
    });
  }, [isGeneratingPreview, onPreviewStateChange, previewUrl, reportMode]);

  const formatNumber = (value: number, digits = 0) =>
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(Number.isFinite(value) ? value : 0);

  const handlePreview = async () => {
    if (reportMode === "movement") {
      setIsGeneratingPreview(true);
      try {
        const { data } = await movementQuery.refetch();
        if (!data) return;

        const [{ pdf }, { StockMovementReportPDF }] = await Promise.all([
          import("@react-pdf/renderer"),
          import("@/components/reports/StockReportsPDF"),
        ]);

        const blob = await pdf(
          <StockMovementReportPDF
            title={t("movementTab")}
            subtitle={t("subtitle")}
            generatedAtLabel={tReports("generatedAt")}
            itemLabel={t("item")}
            warehouseLabel={t("warehouse")}
            inQtyLabel={t("inQty")}
            outQtyLabel={t("outQty")}
            netLabel={t("net")}
            inValueLabel={t("inValue")}
            outValueLabel={t("outValue")}
            netValueLabel={t("netValue")}
            transactionsLabel={t("transactions")}
            noValueLabel="--"
            pageSummary={tReports("previewRowCount", {
              count: formatNumber(data.data.length),
            })}
            rows={data.data}
          />
        ).toBlob();

        replacePreviewUrl(URL.createObjectURL(blob));
      } finally {
        setIsGeneratingPreview(false);
      }
      return;
    }

    setIsGeneratingPreview(true);
    try {
      const { data } = await valuationQuery.refetch();
      if (!data) return;

      const [{ pdf }, { StockValuationReportPDF }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/reports/StockReportsPDF"),
      ]);

      const blob = await pdf(
          <StockValuationReportPDF
            title={t("valuationTab")}
            subtitle={t("subtitle")}
            generatedAtLabel={tReports("generatedAt")}
          itemLabel={t("item")}
          warehouseLabel={t("warehouse")}
          categoryLabel={t("category")}
            qtyOnHandLabel={t("qtyOnHand")}
            unitCostLabel={t("unitCost")}
            totalValueLabel={t("totalValue")}
            noValueLabel="--"
          pageSummary={tReports("previewRowCount", {
            count: formatNumber(data.data.length),
          })}
          rows={data.data}
        />
      ).toBlob();

      replacePreviewUrl(URL.createObjectURL(blob));
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  const activeQuery = reportMode === "movement" ? movementQuery : valuationQuery;

  return (
    <div className="grid h-full min-h-0 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <div className="flex h-full min-h-0 flex-col rounded-lg border bg-muted/20 p-4">
        <div className="space-y-1">
          <h3 className="font-semibold">{tReports("reportSettings")}</h3>
        </div>
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("title")}</label>
            <Select
              value={reportMode}
              onValueChange={(value) => setReportMode(value as "movement" | "valuation")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="movement">{t("movementTab")}</SelectItem>
                <SelectItem value="valuation">{t("valuationTab")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {reportMode === "movement" ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("startDate")}</label>
                <Input type="date" value={movementStartDate} onChange={(event) => setMovementStartDate(event.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("endDate")}</label>
                <Input type="date" value={movementEndDate} onChange={(event) => setMovementEndDate(event.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("groupBy")}</label>
                <Select value={movementGroupBy} onValueChange={(value) => setMovementGroupBy(value as StockMovementGroupBy)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="item">{t("byItem")}</SelectItem>
                    <SelectItem value="warehouse">{t("byWarehouse")}</SelectItem>
                    <SelectItem value="item-warehouse">{t("byItemWarehouse")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("warehouse")}</label>
                <Select value={movementWarehouseId} onValueChange={setMovementWarehouseId}>
                  <SelectTrigger><SelectValue placeholder={t("allWarehouses")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("allWarehouses")}</SelectItem>
                    {warehouses.map((warehouse) => (
                      <SelectItem key={warehouse.id} value={warehouse.id}>
                        {warehouse.code} - {warehouse.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("item")}</label>
                <Select value={movementItemId} onValueChange={setMovementItemId}>
                  <SelectTrigger><SelectValue placeholder={t("allItems")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("allItems")}</SelectItem>
                    {items.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.code} - {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("groupBy")}</label>
                <Select value={valuationGroupBy} onValueChange={(value) => setValuationGroupBy(value as StockValuationGroupBy)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="item">{t("byItem")}</SelectItem>
                    <SelectItem value="warehouse">{t("byWarehouse")}</SelectItem>
                    <SelectItem value="category">{t("byCategory")}</SelectItem>
                    <SelectItem value="item-warehouse">{t("byItemWarehouse")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("warehouse")}</label>
                <Select value={valuationWarehouseId} onValueChange={setValuationWarehouseId}>
                  <SelectTrigger><SelectValue placeholder={t("allWarehouses")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("allWarehouses")}</SelectItem>
                    {warehouses.map((warehouse) => (
                      <SelectItem key={warehouse.id} value={warehouse.id}>
                        {warehouse.code} - {warehouse.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("item")}</label>
                <Select value={valuationItemId} onValueChange={setValuationItemId}>
                  <SelectTrigger><SelectValue placeholder={t("allItems")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("allItems")}</SelectItem>
                    {items.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.code} - {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("category")}</label>
                <Select value={valuationCategory} onValueChange={setValuationCategory}>
                  <SelectTrigger><SelectValue placeholder={t("allCategories")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("allCategories")}</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>
        <div className="mt-auto pt-6">
          <Button
            className="w-full"
            onClick={handlePreview}
            disabled={
              activeQuery.isFetching ||
              isGeneratingPreview
            }
          >
            {isGeneratingPreview ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Eye className="mr-2 h-4 w-4" />
            )}
            {tReports("preview")}
          </Button>
        </div>
      </div>

      <div className="flex h-full min-h-0 flex-col gap-4">
        <PreviewFrame
          url={previewUrl}
          isGenerating={isGeneratingPreview}
          emptyLabel={tReports("previewPlaceholder")}
          loadingLabel={tReports("generatingPreview")}
          title={tReports("previewFrameTitle", { report: reportName })}
        />
      </div>
    </div>
  );
}

function ItemLocationBatchReportPreview({
  open,
  reportName,
  onPreviewStateChange,
}: {
  open: boolean;
  reportName: string;
  onPreviewStateChange: ReportPreviewPanelProps["onPreviewStateChange"];
}) {
  const tReports = useTranslations("reportsPage");
  const t = useTranslations("itemLocationBatchReportPage");
  const locale = useLocale();
  const [warehouseId, setWarehouseId] = useState("all");
  const [itemId, setItemId] = useState("all");
  const [stockStatus, setStockStatus] = useState<"all" | "zero" | "available_only" | "reserved">("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"updated_at" | "qty_on_hand" | "received_at">("updated_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const { data: itemsData } = useItems({ limit: 50 });
  const { data: warehousesData } = useWarehouses({ limit: 50 });
  const items = itemsData?.data || [];
  const warehouses = warehousesData?.data || [];
  const { previewUrl, isGeneratingPreview, setIsGeneratingPreview, replacePreviewUrl } =
    usePdfPreviewState(open);

  const reportQuery = useItemLocationBatchReport({
    enabled: false,
    page: 1,
    limit: 50,
    warehouseId: warehouseId === "all" ? undefined : warehouseId,
    itemId: itemId === "all" ? undefined : itemId,
    stockStatus,
    search: search || undefined,
    sortBy,
    sortOrder,
  });

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearch(searchInput.trim());
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    replacePreviewUrl(null);
  }, [warehouseId, itemId, stockStatus, search, sortBy, sortOrder, replacePreviewUrl]);

  useEffect(() => {
    onPreviewStateChange({
      url: previewUrl,
      isGenerating: isGeneratingPreview,
      fileName: `item-location-batch-report-${new Date().toISOString().slice(0, 10)}.pdf`,
    });
  }, [isGeneratingPreview, onPreviewStateChange, previewUrl]);

  const formatNumber = (value: number, digits = 0) =>
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(Number.isFinite(value) ? value : 0);

  const handlePreview = async () => {
    setIsGeneratingPreview(true);
    try {
      const { data } = await reportQuery.refetch();
      if (!data) return;

      const [{ pdf }, { ItemLocationBatchReportPDF }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/reports/ItemLocationBatchReportPDF"),
      ]);

      const blob = await pdf(
        <ItemLocationBatchReportPDF
          title={t("title")}
          subtitle={t("subtitle")}
          generatedAtLabel={tReports("generatedAt")}
          itemLabel={t("item")}
          warehouseLocationLabel={t("warehouseLocation")}
          batchLabel={t("batch")}
          locationSkuLabel={t("locationSku")}
          onHandLabel={t("onHand")}
          reservedLabel={t("reserved")}
          availableLabel={t("available")}
          updatedLabel={t("updated")}
          noValueLabel={t("noValue")}
          pageSummary={t("pageOfTotal", {
            page: formatNumber(data.pagination.page),
            totalPages: formatNumber(data.pagination.totalPages),
            total: formatNumber(data.pagination.total),
          })}
          rows={data.data}
        />
      ).toBlob();

      replacePreviewUrl(URL.createObjectURL(blob));
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  return (
    <div className="grid h-full min-h-0 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <div className="flex h-full min-h-0 flex-col rounded-lg border bg-muted/20 p-4">
        <div className="space-y-1">
          <h3 className="font-semibold">{tReports("reportSettings")}</h3>
        </div>
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("warehouse")}</label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger><SelectValue placeholder={t("allWarehouses")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allWarehouses")}</SelectItem>
                {warehouses.map((warehouse) => (
                  <SelectItem key={warehouse.id} value={warehouse.id}>
                    {warehouse.code} - {warehouse.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("item")}</label>
            <Select value={itemId} onValueChange={setItemId}>
              <SelectTrigger><SelectValue placeholder={t("allItems")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allItems")}</SelectItem>
                {items.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.code} - {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("stockStatus")}</label>
            <Select value={stockStatus} onValueChange={(value) => setStockStatus(value as typeof stockStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("all")}</SelectItem>
                <SelectItem value="available_only">{t("availableOnly")}</SelectItem>
                <SelectItem value="reserved">{t("reservedGtZero")}</SelectItem>
                <SelectItem value="zero">{t("zeroOnHand")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("sortBy")}</label>
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="updated_at">{t("updatedAt")}</SelectItem>
                <SelectItem value="qty_on_hand">{t("qtyOnHand")}</SelectItem>
                <SelectItem value="received_at">{t("receivedAt")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("sortOrder")}</label>
            <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as typeof sortOrder)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">{t("descending")}</SelectItem>
                <SelectItem value="asc">{t("ascending")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("search")}</label>
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={t("searchPlaceholder")}
            />
          </div>
        </div>
        <div className="mt-auto pt-6">
          <Button
            className="w-full"
            onClick={handlePreview}
            disabled={
              reportQuery.isFetching ||
              isGeneratingPreview
            }
          >
            {isGeneratingPreview ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Eye className="mr-2 h-4 w-4" />
            )}
            {tReports("preview")}
          </Button>
        </div>
      </div>
      <div className="flex h-full min-h-0 flex-col gap-4">
        <PreviewFrame
          url={previewUrl}
          isGenerating={isGeneratingPreview}
          emptyLabel={tReports("previewPlaceholder")}
          loadingLabel={tReports("generatingPreview")}
          title={tReports("previewFrameTitle", { report: reportName })}
        />
      </div>
    </div>
  );
}

function PickingEfficiencyReportPreview({
  open,
  reportName,
  onPreviewStateChange,
}: {
  open: boolean;
  reportName: string;
  onPreviewStateChange: ReportPreviewPanelProps["onPreviewStateChange"];
}) {
  const tReports = useTranslations("reportsPage");
  const t = useTranslations("pickingEfficiencyReportPage");
  const locale = useLocale();
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [warehouseId, setWarehouseId] = useState("all");
  const [pickerUserId, setPickerUserId] = useState("all");
  const [groupBy, setGroupBy] = useState<NonNullable<PickingEfficiencyFilters["groupBy"]>>("picker");
  const { data: warehousesData } = useWarehouses({ limit: 50 });
  const { data: usersData } = useUsers({ page: 1, limit: 50, isActive: true });
  const warehouses = warehousesData?.data || [];
  const users = usersData?.data || [];
  const { previewUrl, isGeneratingPreview, setIsGeneratingPreview, replacePreviewUrl } =
    usePdfPreviewState(open);

  const reportQuery = usePickingEfficiencyReport({
    enabled: false,
    startDate,
    endDate,
    warehouseId: warehouseId === "all" ? undefined : warehouseId,
    pickerUserId: pickerUserId === "all" ? undefined : pickerUserId,
    groupBy,
  });

  useEffect(() => {
    replacePreviewUrl(null);
  }, [startDate, endDate, warehouseId, pickerUserId, groupBy, replacePreviewUrl]);

  useEffect(() => {
    onPreviewStateChange({
      url: previewUrl,
      isGenerating: isGeneratingPreview,
      fileName: `picking-efficiency-report-${new Date().toISOString().slice(0, 10)}.pdf`,
    });
  }, [isGeneratingPreview, onPreviewStateChange, previewUrl]);

  const formatNumber = (value: number, digits = 0) =>
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(Number.isFinite(value) ? value : 0);

  const handlePreview = async () => {
    setIsGeneratingPreview(true);
    try {
      const { data } = await reportQuery.refetch();
      if (!data) return;

      const [{ pdf }, { PickingEfficiencyReportPDF }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/reports/PickingEfficiencyReportPDF"),
      ]);

      const blob = await pdf(
        <PickingEfficiencyReportPDF
          title={t("title")}
          subtitle={t("subtitle")}
          generatedAtLabel={tReports("generatedAt")}
          groupLabel={groupBy === "picker" ? t("pickerLabel") : t("warehouseLabel")}
          pickListsLabel={t("pickListsLabel")}
          linesLabel={t("lines")}
          linesPerHourLabel={t("linesPerHour")}
          accuracyLabel={t("accuracy")}
          shortRateLabel={t("shortRate")}
          avgTimeLabel={t("avgTime")}
          utilizationLabel={t("utilization")}
          noValueLabel={t("unknown")}
          pageSummary={tReports("previewRowCount", {
            count: formatNumber(data.data.length),
          })}
          rows={data.data}
        />
      ).toBlob();

      replacePreviewUrl(URL.createObjectURL(blob));
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  return (
    <div className="grid h-full min-h-0 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <div className="flex h-full min-h-0 flex-col rounded-lg border bg-muted/20 p-4">
        <div className="space-y-1">
          <h3 className="font-semibold">{tReports("reportSettings")}</h3>
        </div>
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("startDate")}</label>
            <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("endDate")}</label>
            <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("warehouse")}</label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger><SelectValue placeholder={t("allWarehouses")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allWarehouses")}</SelectItem>
                {warehouses.map((warehouse) => (
                  <SelectItem key={warehouse.id} value={warehouse.id}>
                    {warehouse.code} - {warehouse.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("picker")}</label>
            <Select value={pickerUserId} onValueChange={setPickerUserId}>
              <SelectTrigger><SelectValue placeholder={t("allPickers")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allPickers")}</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {[user.first_name, user.last_name].filter(Boolean).join(" ").trim() || user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("primaryTable")}</label>
            <Select value={groupBy} onValueChange={(value) => setGroupBy(value as typeof groupBy)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="picker">{t("byPicker")}</SelectItem>
                <SelectItem value="warehouse">{t("byWarehouse")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-auto pt-6">
          <Button
            className="w-full"
            onClick={handlePreview}
            disabled={
              reportQuery.isFetching ||
              isGeneratingPreview
            }
          >
            {isGeneratingPreview ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Eye className="mr-2 h-4 w-4" />
            )}
            {tReports("preview")}
          </Button>
        </div>
      </div>
      <div className="flex h-full min-h-0 flex-col gap-4">
        <PreviewFrame
          url={previewUrl}
          isGenerating={isGeneratingPreview}
          emptyLabel={tReports("previewPlaceholder")}
          loadingLabel={tReports("generatingPreview")}
          title={tReports("previewFrameTitle", { report: reportName })}
        />
      </div>
    </div>
  );
}

function TransformationEfficiencyReportPreview({
  open,
  reportName,
  onPreviewStateChange,
}: {
  open: boolean;
  reportName: string;
  onPreviewStateChange: ReportPreviewPanelProps["onPreviewStateChange"];
}) {
  const tReports = useTranslations("reportsPage");
  const t = useTranslations("transformationEfficiencyReportPage");
  const locale = useLocale();
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [warehouseId, setWarehouseId] = useState("all");
  const [templateId, setTemplateId] = useState("all");
  const [groupBy, setGroupBy] = useState<"template" | "warehouse">("template");
  const [status, setStatus] = useState<"COMPLETED" | "PREPARING" | "DRAFT" | "CANCELLED" | "ALL">("COMPLETED");
  const { data: warehousesData } = useWarehouses({ limit: 50 });
  const { data: templatesData } = useTransformationTemplates({ page: 1, limit: 50, isActive: true });
  const warehouses = warehousesData?.data || [];
  const templates = templatesData?.data || [];
  const { previewUrl, isGeneratingPreview, setIsGeneratingPreview, replacePreviewUrl } =
    usePdfPreviewState(open);

  const reportQuery = useTransformationEfficiencyReport({
    enabled: false,
    startDate,
    endDate,
    warehouseId: warehouseId === "all" ? undefined : warehouseId,
    templateId: templateId === "all" ? undefined : templateId,
    groupBy,
    status,
  });

  useEffect(() => {
    replacePreviewUrl(null);
  }, [startDate, endDate, warehouseId, templateId, groupBy, status, replacePreviewUrl]);

  useEffect(() => {
    onPreviewStateChange({
      url: previewUrl,
      isGenerating: isGeneratingPreview,
      fileName: `transformation-efficiency-report-${new Date().toISOString().slice(0, 10)}.pdf`,
    });
  }, [isGeneratingPreview, onPreviewStateChange, previewUrl]);

  const formatNumber = (value: number, digits = 0) =>
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(Number.isFinite(value) ? value : 0);

  const handlePreview = async () => {
    setIsGeneratingPreview(true);
    try {
      const { data } = await reportQuery.refetch();
      if (!data) return;

      const [{ pdf }, { TransformationEfficiencyReportPDF }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/reports/TransformationEfficiencyReportPDF"),
      ]);

      const blob = await pdf(
        <TransformationEfficiencyReportPDF
          title={t("title")}
          subtitle={t("subtitle")}
          generatedAtLabel={tReports("generatedAt")}
          groupLabel={groupBy === "template" ? t("templateLabel") : t("warehouseLabel")}
          ordersLabel={t("orders")}
          yieldLabel={t("yield")}
          wasteLabel={t("waste")}
          planLabel={t("plan")}
          avgCycleLabel={t("avgCycle")}
          varianceLabel={t("variance")}
          noValueLabel={t("unknown")}
          pageSummary={tReports("previewRowCount", {
            count: formatNumber(data.data.length),
          })}
          rows={data.data}
        />
      ).toBlob();

      replacePreviewUrl(URL.createObjectURL(blob));
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  return (
    <div className="grid h-full min-h-0 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <div className="flex h-full min-h-0 flex-col rounded-lg border bg-muted/20 p-4">
        <div className="space-y-1">
          <h3 className="font-semibold">{tReports("reportSettings")}</h3>
        </div>
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("startDate")}</label>
            <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("endDate")}</label>
            <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("warehouse")}</label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger><SelectValue placeholder={t("allWarehouses")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allWarehouses")}</SelectItem>
                {warehouses.map((warehouse) => (
                  <SelectItem key={warehouse.id} value={warehouse.id}>
                    {warehouse.code} - {warehouse.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("template")}</label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger><SelectValue placeholder={t("allTemplates")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allTemplates")}</SelectItem>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.template_code} - {template.template_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("status")}</label>
            <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="COMPLETED">{t("completed")}</SelectItem>
                <SelectItem value="PREPARING">{t("preparing")}</SelectItem>
                <SelectItem value="DRAFT">{t("draft")}</SelectItem>
                <SelectItem value="CANCELLED">{t("cancelled")}</SelectItem>
                <SelectItem value="ALL">{t("all")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("primaryTable")}</label>
            <Select value={groupBy} onValueChange={(value) => setGroupBy(value as typeof groupBy)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="template">{t("byTemplate")}</SelectItem>
                <SelectItem value="warehouse">{t("byWarehouse")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-auto pt-6">
          <Button
            className="w-full"
            onClick={handlePreview}
            disabled={
              reportQuery.isFetching ||
              isGeneratingPreview
            }
          >
            {isGeneratingPreview ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Eye className="mr-2 h-4 w-4" />
            )}
            {tReports("preview")}
          </Button>
        </div>
      </div>
      <div className="flex h-full min-h-0 flex-col gap-4">
        <PreviewFrame
          url={previewUrl}
          isGenerating={isGeneratingPreview}
          emptyLabel={tReports("previewPlaceholder")}
          loadingLabel={tReports("generatingPreview")}
          title={tReports("previewFrameTitle", { report: reportName })}
        />
      </div>
    </div>
  );
}

export function ReportPreviewDialog({
  open,
  onOpenChange,
  reportName,
  reportType,
}: ReportPreviewDialogProps) {
  const tReports = useTranslations("reportsPage");
  const [previewState, setPreviewState] = useState({
    url: null as string | null,
    isGenerating: false,
    fileName: "report-preview.pdf",
  });

  useEffect(() => {
    if (!open) {
      setPreviewState({
        url: null,
        isGenerating: false,
        fileName: "report-preview.pdf",
      });
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] max-w-[88vw] flex-col gap-0 overflow-hidden p-0 xl:max-w-[1500px]">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{tReports("previewDialogTitle", { report: reportName })}</DialogTitle>
          <DialogDescription>{tReports("previewDialogDescription")}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-hidden px-6 py-5">
          {reportType === "inventory" && (
            <InventoryReportPreview
              open={open}
              reportName={reportName}
              onPreviewStateChange={setPreviewState}
            />
          )}
          {reportType === "stock-aging" && (
            <StockAgingReportPreview
              open={open}
              reportName={reportName}
              onPreviewStateChange={setPreviewState}
            />
          )}
          {reportType === "shipments" && (
            <ShipmentsReportPreview
              open={open}
              reportName={reportName}
              onPreviewStateChange={setPreviewState}
            />
          )}
          {reportType === "stock" && (
            <StockReportsPreview
              open={open}
              reportName={reportName}
              onPreviewStateChange={setPreviewState}
            />
          )}
          {reportType === "item-location-batch" && (
            <ItemLocationBatchReportPreview
              open={open}
              reportName={reportName}
              onPreviewStateChange={setPreviewState}
            />
          )}
          {reportType === "picking-efficiency" && (
            <PickingEfficiencyReportPreview
              open={open}
              reportName={reportName}
              onPreviewStateChange={setPreviewState}
            />
          )}
          {reportType === "transformation-efficiency" && (
            <TransformationEfficiencyReportPreview
              open={open}
              reportName={reportName}
              onPreviewStateChange={setPreviewState}
            />
          )}
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button
            variant="outline"
            onClick={() => printPdfPreview(previewState.url)}
            disabled={!previewState.url || previewState.isGenerating}
          >
            <Printer className="mr-2 h-4 w-4" />
            {tReports("print")}
          </Button>
          <Button
            variant="outline"
            onClick={() => downloadPdfPreview(previewState.url, previewState.fileName)}
            disabled={!previewState.url || previewState.isGenerating}
          >
            <Download className="mr-2 h-4 w-4" />
            {tReports("downloadPdf")}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tReports("cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
