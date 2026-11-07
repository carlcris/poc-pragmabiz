"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { apiClient, getApiErrorCode } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronRight, Loader2, MapPinned, Printer } from "lucide-react";
import { toast } from "sonner";
import { useItem } from "@/hooks/useItems";
import { ITEM_LOCATIONS_QUERY_KEY } from "@/hooks/queryKeys";
import { useCanCreate, useCanView } from "@/hooks/usePermissions";
import { useGranularCapabilities } from "@/hooks/useGranularCapabilities";
import { useItemLocationStockNode } from "@/hooks/useItemLocationStockNode";
import { useItemWarehouseStock } from "@/hooks/useItemWarehouseStock";
import { GRANULAR_CAPABILITIES } from "@/constants/granular-permissions";
import { RESOURCES } from "@/constants/resources";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { ItemLocationMapDialog } from "@/components/items/locations/ItemLocationMapDialog";
import { ItemLocationStockPanel } from "@/components/items/locations/ItemLocationStockPanel";
import { ItemLocationStockTree } from "@/components/items/locations/ItemLocationStockTree";
import { MoveStockDialog } from "@/components/items/locations/MoveStockDialog";
import { WarehouseLocationSelect } from "@/components/warehouses/WarehouseLocationSelect";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";
import type { BarcodeData } from "@/lib/barcode";
import { getWarehouseLocationDisplayName } from "@/lib/warehouse-location-form";
import type {
  ItemLocation,
  ItemLocationBatch,
  ItemStockPagination,
  ItemWarehouseStock,
} from "@/types/inventory-location";

type BatchPrintLabelResponse = {
  data: {
    batchLocationId: string;
    itemId: string;
    batchLocationSku: string;
    batchCode: string;
    receivedAt: string;
    qtyOnHand: number;
    itemCode: string;
    itemName: string;
    warehouseCode: string;
    locationId: string;
    locationCode: string;
  };
};

type LocationsTabProps = {
  itemId: string;
};

type SelectedLocation = { warehouseId: string; locationId: string };

const MAX_BATCH_LABEL_COUNT = 100;

const formatQty = (value: number, locale: string) =>
  value.toLocaleString(locale, { maximumFractionDigits: 4 });

const createBatchLabelId = (batchLocationId: string, labelNumber: number) => {
  const uniquePart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${labelNumber}`;

  return `batch-${batchLocationId}-${uniquePart}`;
};

export const LocationsTab = ({ itemId }: LocationsTabProps) => {
  const t = useTranslations("itemLocationsTab");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [warehousePage, setWarehousePage] = useState(1);
  const [searchPage, setSearchPage] = useState(1);
  const [locationSearch, setLocationSearch] = useState("");
  const debouncedLocationSearch = useDebouncedValue(locationSearch.trim(), 300);
  const [collapsedWarehouses, setCollapsedWarehouses] = useState<ReadonlySet<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(new Set());
  const [selected, setSelected] = useState<SelectedLocation | null>(null);
  const [moveDialogSource, setMoveDialogSource] = useState<{
    warehouseId: string;
    locationId: string;
  } | null>(null);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [locationMapDialogOpen, setLocationMapDialogOpen] = useState(false);
  const [maxStockWarehouse, setMaxStockWarehouse] = useState<ItemWarehouseStock | null>(null);
  const [maxStockInput, setMaxStockInput] = useState("");
  const [preferredWarehouse, setPreferredWarehouse] = useState<ItemWarehouseStock | null>(null);
  const [preferredDraftId, setPreferredDraftId] = useState("");
  const [printingBatchLocationId, setPrintingBatchLocationId] = useState<string | null>(null);
  const [batchToPrint, setBatchToPrint] = useState<ItemLocationBatch | null>(null);
  const [batchLabelCount, setBatchLabelCount] = useState("1");
  const [batchPrintUnitId, setBatchPrintUnitId] = useState("");
  const currentBusinessUnitId = useBusinessUnitStore((state) => state.currentBusinessUnit?.id);
  const canCreateStockTransactions = useCanCreate(RESOURCES.STOCK_TRANSACTIONS);
  const canTransferStock = useCanCreate(RESOURCES.TRANSFER_BETWEEN_LOCATIONS);
  const canMoveStock =
    canCreateStockTransactions && canTransferStock && Boolean(currentBusinessUnitId);
  const canViewItems = useCanView(RESOURCES.ITEMS);
  const canViewWarehouses = useCanView(RESOURCES.WAREHOUSES);
  const { data: granularCapabilities = {} } = useGranularCapabilities([
    GRANULAR_CAPABILITIES.ITEM_BATCH_QR_PRINT,
  ]);
  const canPrintBatchQr =
    canViewItems && granularCapabilities[GRANULAR_CAPABILITIES.ITEM_BATCH_QR_PRINT] === true;

  const selectedStock = useItemLocationStockNode(
    itemId,
    selected?.warehouseId,
    selected?.locationId
  );
  const selectedNode = selectedStock.data?.data[0];
  const warehouseStock = useItemWarehouseStock(itemId, warehousePage);
  const warehouses = useMemo(() => warehouseStock.data?.data ?? [], [warehouseStock.data]);
  const isSearching = Boolean(debouncedLocationSearch);
  const searchQuery = useQuery({
    queryKey: [
      ITEM_LOCATIONS_QUERY_KEY,
      itemId,
      currentBusinessUnitId ?? null,
      "search",
      debouncedLocationSearch,
      searchPage,
    ],
    queryFn: () =>
      apiClient.get<{ data: ItemLocation[]; pagination: ItemStockPagination }>(
        `/api/items/${itemId}/locations`,
        { params: { page: searchPage, limit: 20, search: debouncedLocationSearch } }
      ),
    enabled: isSearching,
  });

  const { data: itemResponse } = useItem(itemId);
  const item = itemResponse?.data;
  const batchPrintUnitOptions = useMemo(
    () =>
      (item?.unitOptions || []).filter(
        (option) => option.isActive && Number.isFinite(option.qtyPerUnit) && option.qtyPerUnit > 0
      ),
    [item?.unitOptions]
  );
  const defaultBatchPrintUnit = useMemo(
    () =>
      batchPrintUnitOptions.find((option) => option.isDefault) ||
      batchPrintUnitOptions.find((option) => option.isBase) ||
      batchPrintUnitOptions[0] ||
      null,
    [batchPrintUnitOptions]
  );
  const selectedBatchPrintUnit =
    batchPrintUnitOptions.find((option) => option.id === batchPrintUnitId) || null;
  const printDisabled = batchPrintUnitOptions.length === 0 || printingBatchLocationId !== null;

  const toggleSet = (current: ReadonlySet<string>, id: string) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  const invalidateItemLocations = () =>
    queryClient.invalidateQueries({ queryKey: [ITEM_LOCATIONS_QUERY_KEY, itemId] });

  const setDefaultLocation = useMutation({
    mutationFn: async ({ warehouseId, locationId }: { warehouseId: string; locationId: string }) =>
      apiClient.patch(`/api/items/${itemId}/default-location`, { warehouseId, locationId }),
    onSuccess: () => {
      invalidateItemLocations();
      setPreferredWarehouse(null);
      toast.success(t("preferredRackUpdated"));
    },
    onError: (mutationError) => {
      if (getApiErrorCode(mutationError, ["LOCATION_STORAGE_UNAVAILABLE"] as const)) {
        toast.error(t("preferredLocationUnavailable"));
        return;
      }
      const message =
        mutationError instanceof Error ? mutationError.message : t("updatePreferredRackError");
      toast.error(message);
    },
  });

  const updateMaxStock = useMutation({
    mutationFn: async () => {
      if (!maxStockWarehouse) {
        throw new Error(t("selectWarehouseForMaxStock"));
      }

      const trimmedValue = maxStockInput.trim();
      const maxQuantity = trimmedValue === "" ? null : Number(trimmedValue);
      if (maxQuantity !== null && (!Number.isFinite(maxQuantity) || maxQuantity < 0)) {
        throw new Error(t("enterValidMaxStock"));
      }

      return apiClient.patch(`/api/items/${itemId}/warehouse-settings`, {
        warehouseId: maxStockWarehouse.warehouseId,
        maxQuantity,
      });
    },
    onSuccess: () => {
      invalidateItemLocations();
      queryClient.invalidateQueries({ queryKey: ["items", itemId] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
      toast.success(t("maxStockUpdated"));
      setMaxStockWarehouse(null);
      setMaxStockInput("");
    },
    onError: (mutationError) => {
      const message = mutationError instanceof Error ? mutationError.message : t("maxStockError");
      toast.error(message);
    },
  });

  const openMaxStockDialog = (warehouse: ItemWarehouseStock) => {
    setMaxStockWarehouse(warehouse);
    setMaxStockInput(warehouse.maxQuantity == null ? "" : String(warehouse.maxQuantity));
  };

  const openPreferredDialog = (warehouse: ItemWarehouseStock) => {
    setPreferredWarehouse(warehouse);
    setPreferredDraftId(warehouse.defaultLocationId ?? "");
  };

  const openMoveDialog = (source: { warehouseId: string; locationId: string } | null) => {
    setMoveDialogSource(source);
    setMoveDialogOpen(true);
  };

  const openBatchPrintDialog = (batch: ItemLocationBatch) => {
    setBatchToPrint(batch);
    setBatchLabelCount("1");
    setBatchPrintUnitId(defaultBatchPrintUnit?.id || "");
  };

  const closeBatchPrintDialog = () => {
    if (printingBatchLocationId) return;
    setBatchToPrint(null);
    setBatchLabelCount("1");
    setBatchPrintUnitId("");
  };

  const parsedBatchLabelCount = Number(batchLabelCount);
  const isBatchLabelCountValid =
    Number.isInteger(parsedBatchLabelCount) &&
    parsedBatchLabelCount >= 1 &&
    parsedBatchLabelCount <= MAX_BATCH_LABEL_COUNT;

  const handlePrintBatchQr = async () => {
    if (!batchToPrint || !isBatchLabelCountValid) {
      toast.error(t("invalidBatchLabelCount", { max: MAX_BATCH_LABEL_COUNT }));
      return;
    }
    if (!selectedBatchPrintUnit) {
      toast.error(t("selectBatchPrintUnit"));
      return;
    }

    try {
      setPrintingBatchLocationId(batchToPrint.id);
      const response = await apiClient.get<BatchPrintLabelResponse>(
        `/api/item-batch-locations/${batchToPrint.id}/print-label`
      );
      const label = response.data;
      const barcodeData: BarcodeData[] = Array.from(
        { length: parsedBatchLabelCount },
        (_, index) => ({
          boxId: createBatchLabelId(label.batchLocationId, index + 1),
          itemId: label.itemId,
          batchLocationSku: label.batchLocationSku,
          batchNumber: label.batchCode,
          grnNumber: t("batchLabelReference"),
          itemCode: label.itemCode,
          itemName: label.itemName,
          boxNumber: index + 1,
          qtyPerBox: selectedBatchPrintUnit.qtyPerUnit,
          deliveryDate: label.receivedAt,
          warehouseCode: label.warehouseCode,
          locationId: label.locationId,
          locationCode: label.locationCode,
        })
      );
      const { printBarcodeLabels } = await import("@/lib/barcode");
      await printBarcodeLabels(barcodeData);
      toast.success(t("printBatchQrSuccess", { count: parsedBatchLabelCount }));
      setBatchToPrint(null);
      setBatchLabelCount("1");
      setBatchPrintUnitId("");
    } catch (printError) {
      console.error("Failed to print item batch QR label", printError);
      toast.error(t("printBatchQrError"));
    } finally {
      setPrintingBatchLocationId(null);
    }
  };

  const renderPanel = (warehouse: ItemWarehouseStock) =>
    selected?.warehouseId === warehouse.warehouseId ? (
      selectedStock.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : selectedStock.isError ? (
        <p className="text-sm text-destructive">{t("loadError")}</p>
      ) : !selectedNode ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ItemLocationStockPanel
          key={selected.locationId}
          itemId={itemId}
          warehouseName={warehouse.warehouseName}
          node={selectedNode}
          canMoveStock={canMoveStock && Boolean(item)}
          canPrint={canPrintBatchQr}
          printDisabled={printDisabled}
          isSettingPreferred={setDefaultLocation.isPending}
          onPrint={openBatchPrintDialog}
          onSelect={(node) => {
            setSelected({ warehouseId: warehouse.warehouseId, locationId: node.locationId });
            setExpandedIds((current) => new Set([...current, node.locationId]));
          }}
          onSetPreferred={(node) =>
            setDefaultLocation.mutate({
              warehouseId: node.warehouseId,
              locationId: node.locationId,
            })
          }
          onMoveFromHere={(node) =>
            openMoveDialog({ warehouseId: node.warehouseId, locationId: node.locationId })
          }
        />
      )
    ) : (
      <p className="py-10 text-center text-sm text-muted-foreground">{t("selectLocationHint")}</p>
    );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription>{t("description")}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {canViewWarehouses ? (
              <Button
                variant="outline"
                onClick={() => setLocationMapDialogOpen(true)}
                disabled={!item || !currentBusinessUnitId}
              >
                <MapPinned className="mr-2 h-4 w-4" />
                {t("locationMap")}
              </Button>
            ) : null}
            {canMoveStock ? (
              <Button
                onClick={() => openMoveDialog(null)}
                disabled={warehouses.length === 0 || !item}
              >
                {t("moveStock")}
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          value={locationSearch}
          placeholder={t("searchLocations")}
          aria-label={t("searchLocations")}
          onChange={(event) => {
            setLocationSearch(event.target.value);
            setSearchPage(1);
          }}
        />

        {isSearching ? (
          searchQuery.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : searchQuery.error ? (
            <p className="text-sm text-destructive">{t("loadError")}</p>
          ) : (searchQuery.data?.data.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <div className="space-y-3">
              <ul className="divide-y rounded-md border">
                {searchQuery.data?.data.map((location) => (
                  <li key={location.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => {
                        setSelected({
                          warehouseId: location.warehouseId,
                          locationId: location.locationId,
                        });
                        setCollapsedWarehouses((current) => {
                          const next = new Set(current);
                          next.delete(location.warehouseId);
                          return next;
                        });
                        setLocationSearch("");
                      }}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {getWarehouseLocationDisplayName({
                            code: location.locationCode,
                            name: location.locationName,
                          })}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {location.warehouseName} / {location.locationNamePath}
                        </span>
                      </span>
                      <span className="text-sm tabular-nums">
                        {formatQty(location.qtyOnHand, locale)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {searchQuery.data && searchQuery.data.pagination.totalPages > 1 ? (
                <DataTablePagination
                  currentPage={searchPage}
                  totalPages={searchQuery.data.pagination.totalPages}
                  pageSize={20}
                  totalItems={searchQuery.data.pagination.total}
                  onPageChange={setSearchPage}
                />
              ) : null}
            </div>
          )
        ) : warehouseStock.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : warehouseStock.error ? (
          <p className="text-sm text-destructive">{t("loadError")}</p>
        ) : warehouses.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="space-y-4">
            {warehouses.map((warehouse) => {
              const isCollapsed = collapsedWarehouses.has(warehouse.warehouseId);
              return (
                <section
                  key={warehouse.warehouseId}
                  aria-labelledby={`item-warehouse-${warehouse.warehouseId}`}
                  className="overflow-hidden rounded-md border"
                >
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b bg-muted/30 px-4 py-3">
                    <button
                      type="button"
                      aria-expanded={!isCollapsed}
                      className="flex min-w-48 flex-1 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() =>
                        setCollapsedWarehouses((current) =>
                          toggleSet(current, warehouse.warehouseId)
                        )
                      }
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <span>
                        <span
                          id={`item-warehouse-${warehouse.warehouseId}`}
                          className="block font-semibold"
                        >
                          {warehouse.warehouseName}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {warehouse.warehouseCode} ·{" "}
                          {t("locationsHoldingItem", { count: warehouse.locationCount })}
                        </span>
                      </span>
                    </button>
                    <div>
                      <div className="text-xs text-muted-foreground">{t("preferredLocation")}</div>
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <span
                          className="max-w-48 truncate"
                          title={warehouse.defaultLocationNamePath ?? undefined}
                        >
                          {warehouse.defaultLocationName ?? t("preferredNotSet")}
                        </span>
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0"
                          onClick={() => openPreferredDialog(warehouse)}
                        >
                          {t("changePreferredLocation")}
                        </Button>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">{t("onHand")}</div>
                      <div className="text-sm font-semibold tabular-nums">
                        {formatQty(warehouse.qtyOnHand, locale)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">{t("reserved")}</div>
                      <div className="text-sm font-semibold tabular-nums">
                        {formatQty(warehouse.qtyReserved, locale)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">{t("maxStock")}</div>
                      <div className="text-sm font-semibold tabular-nums">
                        {warehouse.maxQuantity == null
                          ? "--"
                          : formatQty(warehouse.maxQuantity, locale)}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openMaxStockDialog(warehouse)}
                    >
                      {t("editMaxStock")}
                    </Button>
                  </div>
                  {isCollapsed ? null : (
                    <div className="flex flex-col lg:flex-row">
                      <div className="border-b lg:w-96 lg:shrink-0 lg:border-b-0 lg:border-r">
                        <ItemLocationStockTree
                          itemId={itemId}
                          warehouseId={warehouse.warehouseId}
                          warehouseLabel={warehouse.warehouseName}
                          selectedLocationId={
                            selected?.warehouseId === warehouse.warehouseId
                              ? selected.locationId
                              : null
                          }
                          expandedIds={expandedIds}
                          onToggle={(locationId) =>
                            setExpandedIds((current) => toggleSet(current, locationId))
                          }
                          onSelect={(node) =>
                            setSelected({
                              warehouseId: warehouse.warehouseId,
                              locationId: node.locationId,
                            })
                          }
                        />
                      </div>
                      <div className="min-w-0 flex-1 p-4">{renderPanel(warehouse)}</div>
                    </div>
                  )}
                </section>
              );
            })}
            {warehouseStock.data && warehouseStock.data.pagination.totalPages > 1 ? (
              <DataTablePagination
                currentPage={warehousePage}
                totalPages={warehouseStock.data.pagination.totalPages}
                pageSize={20}
                totalItems={warehouseStock.data.pagination.total}
                onPageChange={setWarehousePage}
              />
            ) : null}
          </div>
        )}
      </CardContent>
      <ItemLocationMapDialog
        open={locationMapDialogOpen}
        onOpenChange={setLocationMapDialogOpen}
        warehouses={warehouses.map((warehouse) => ({
          id: warehouse.warehouseId,
          code: warehouse.warehouseCode,
          name: warehouse.warehouseName,
        }))}
        itemId={itemId}
        itemCode={item?.code ?? ""}
        itemName={item?.name ?? ""}
      />
      <Dialog
        open={batchToPrint !== null}
        onOpenChange={(open) => {
          if (!open) closeBatchPrintDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("batchPrintDialogTitle")}</DialogTitle>
            <DialogDescription>
              {batchToPrint
                ? t("batchPrintDialogDescription", {
                    batch: batchToPrint.batchCode,
                    quantity: formatQty(batchToPrint.qtyOnHand, locale),
                  })
                : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="batch-label-count" className="text-sm font-medium">
              {t("batchLabelCount")}
            </label>
            <Input
              id="batch-label-count"
              type="number"
              min="1"
              max={MAX_BATCH_LABEL_COUNT}
              step="1"
              value={batchLabelCount}
              disabled={printingBatchLocationId !== null}
              onChange={(event) => setBatchLabelCount(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t("batchLabelCountHelp", { max: MAX_BATCH_LABEL_COUNT })}
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("batchPrintUnit")}</label>
            <Select
              value={batchPrintUnitId}
              disabled={printingBatchLocationId !== null}
              onValueChange={setBatchPrintUnitId}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("selectBatchPrintUnit")} />
              </SelectTrigger>
              <SelectContent>
                {batchPrintUnitOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.displayLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t("batchPrintUnitHelp")}</p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={printingBatchLocationId !== null}
              onClick={closeBatchPrintDialog}
            >
              {t("cancel")}
            </Button>
            <Button
              disabled={
                !isBatchLabelCountValid ||
                !selectedBatchPrintUnit ||
                printingBatchLocationId !== null
              }
              onClick={handlePrintBatchQr}
            >
              {printingBatchLocationId ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Printer className="mr-2 h-4 w-4" />
              )}
              {printingBatchLocationId ? t("printingBatchQr") : t("printBatchLabels")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {moveDialogOpen && canMoveStock && item ? (
        <MoveStockDialog
          key={`${itemId}:${currentBusinessUnitId}:${moveDialogSource?.locationId ?? "any"}`}
          itemId={itemId}
          baseUnit={item.uom}
          unitOptions={item.unitOptions ?? []}
          sourceLocations={undefined}
          initialSource={moveDialogSource ?? undefined}
          onOpenChange={setMoveDialogOpen}
        />
      ) : null}
      <Dialog
        open={preferredWarehouse !== null}
        onOpenChange={(open) => {
          if (!open) setPreferredWarehouse(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("preferredDialogTitle")}</DialogTitle>
            <DialogDescription>
              {preferredWarehouse
                ? t("preferredDialogDescription", { warehouse: preferredWarehouse.warehouseName })
                : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="preferred-location" className="text-sm font-medium">
              {t("preferredLocation")}
            </label>
            <WarehouseLocationSelect
              warehouseId={preferredWarehouse?.warehouseId}
              value={preferredDraftId}
              onValueChange={setPreferredDraftId}
              storableOnly
              triggerId="preferred-location"
              buttonClassName="w-full"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreferredWarehouse(null)}>
              {t("cancel")}
            </Button>
            <Button
              disabled={
                !preferredWarehouse ||
                !preferredDraftId ||
                preferredDraftId === preferredWarehouse.defaultLocationId ||
                setDefaultLocation.isPending
              }
              onClick={() =>
                preferredWarehouse &&
                setDefaultLocation.mutate({
                  warehouseId: preferredWarehouse.warehouseId,
                  locationId: preferredDraftId,
                })
              }
            >
              {setDefaultLocation.isPending ? t("saving") : t("savePreferred")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={maxStockWarehouse !== null}
        onOpenChange={(open) => {
          if (!open) {
            setMaxStockWarehouse(null);
            setMaxStockInput("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("maxStockDialogTitle")}</DialogTitle>
            <DialogDescription>
              {maxStockWarehouse
                ? t("maxStockDialogDescription", {
                    warehouse: `${maxStockWarehouse.warehouseCode} - ${maxStockWarehouse.warehouseName}`,
                  })
                : t("maxStockDialogDescriptionFallback")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("maxStock")}</label>
            <Input
              type="number"
              min="0"
              step="0.0001"
              value={maxStockInput}
              onChange={(event) => setMaxStockInput(event.target.value)}
              placeholder={t("maxStockPlaceholder")}
            />
            <p className="text-xs text-muted-foreground">{t("maxStockHelp")}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMaxStockWarehouse(null)}>
              {t("cancel")}
            </Button>
            <Button onClick={() => updateMaxStock.mutate()} disabled={updateMaxStock.isPending}>
              {updateMaxStock.isPending ? t("saving") : t("saveMaxStock")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
