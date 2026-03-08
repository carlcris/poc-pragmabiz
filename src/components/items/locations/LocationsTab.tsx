"use client";

import { Fragment, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { apiClient } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useItem } from "@/hooks/useItems";
import type { ItemLocation } from "@/types/inventory-location";
import type { WarehouseLocation } from "@/types/inventory-location";

type ItemLocationsResponse = {
  data: ItemLocation[];
};

type LocationsTabProps = {
  itemId: string;
};

const formatQty = (value: number, locale: string) =>
  value.toLocaleString(locale, { maximumFractionDigits: 4 });

export const LocationsTab = ({ itemId }: LocationsTabProps) => {
  const t = useTranslations("itemLocationsTab");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");
  const [fromLocationId, setFromLocationId] = useState<string>("");
  const [toLocationId, setToLocationId] = useState<string>("");
  const [moveQty, setMoveQty] = useState<string>("");
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());
  const { data, isLoading, error } = useQuery<ItemLocationsResponse>({
    queryKey: ["item-locations", itemId],
    queryFn: async () => apiClient.get<ItemLocationsResponse>(`/api/items/${itemId}/locations`),
  });
  const { data: itemResponse } = useItem(itemId);
  const item = itemResponse?.data;

  const toggleLocation = (locationId: string) => {
    setExpandedLocations((prev) => {
      const next = new Set(prev);
      if (next.has(locationId)) {
        next.delete(locationId);
      } else {
        next.add(locationId);
      }
      return next;
    });
  };

  const locations = useMemo(() => data?.data || [], [data]);
  const warehouses = useMemo(() => {
    const map = new Map<string, { id: string; code: string; name: string }>();
    locations.forEach((loc) => {
      if (!map.has(loc.warehouseId)) {
        map.set(loc.warehouseId, {
          id: loc.warehouseId,
          code: loc.warehouseCode,
          name: loc.warehouseName,
        });
      }
    });
    return Array.from(map.values());
  }, [locations]);

  const fromLocations = useMemo(
    () => locations.filter((loc) => loc.warehouseId === selectedWarehouseId),
    [locations, selectedWarehouseId]
  );

  const { data: warehouseLocations } = useQuery<{ data: WarehouseLocation[] }>({
    queryKey: ["warehouse-locations", selectedWarehouseId],
    queryFn: () => apiClient.get(`/api/warehouses/${selectedWarehouseId}/locations`),
    enabled: !!selectedWarehouseId,
  });

  const toLocations = useMemo(
    () => (warehouseLocations?.data || []).filter((loc) => loc.isActive),
    [warehouseLocations]
  );

  const setDefaultLocation = useMutation({
    mutationFn: async (location: ItemLocation) =>
      apiClient.patch(`/api/items/${itemId}/default-location`, {
        warehouseId: location.warehouseId,
        locationId: location.locationId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item-locations", itemId] });
      toast.success(t("defaultUpdated"));
    },
    onError: (mutationError) => {
      const message =
        mutationError instanceof Error
          ? mutationError.message
          : t("updateDefaultError");
      toast.error(message);
    },
  });

  const moveStock = useMutation({
    mutationFn: async () => {
      const quantity = Number(moveQty);
      if (!selectedWarehouseId || !fromLocationId || !toLocationId) {
        throw new Error(t("selectWarehouseAndLocations"));
      }
      if (fromLocationId === toLocationId) {
        throw new Error(t("selectDifferentLocations"));
      }
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error(t("enterValidQuantity"));
      }

      return apiClient.post("/api/stock-transactions", {
        transactionType: "transfer",
        warehouseId: selectedWarehouseId,
        toWarehouseId: selectedWarehouseId,
        fromLocationId,
        toLocationId,
        transactionDate: new Date().toISOString().split("T")[0],
        items: [
          {
            itemId,
            quantity,
            unitCost: item?.standardCost ?? 0,
          },
        ],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item-locations", itemId] });
      toast.success(t("stockMoved"));
      setMoveDialogOpen(false);
      setSelectedWarehouseId("");
      setFromLocationId("");
      setToLocationId("");
      setMoveQty("");
    },
    onError: (mutationError) => {
      const message =
        mutationError instanceof Error ? mutationError.message : t("moveStockError");
      toast.error(message);
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription>{t("description")}</CardDescription>
          </div>
          <Button onClick={() => setMoveDialogOpen(true)} disabled={locations.length === 0}>
            {t("moveStock")}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="text-sm text-destructive">{t("loadError")}</div>
        ) : locations.length === 0 ? (
          <div className="text-sm text-muted-foreground">{t("empty")}</div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>{t("warehouse")}</TableHead>
                  <TableHead>{t("location")}</TableHead>
                  <TableHead>{t("type")}</TableHead>
                  <TableHead className="text-right">{t("onHand")}</TableHead>
                  <TableHead className="text-right">{t("reserved")}</TableHead>
                  <TableHead className="text-right">{t("available")}</TableHead>
                  <TableHead className="text-right">{t("inTransit")}</TableHead>
                  <TableHead>{t("estArrival")}</TableHead>
                  <TableHead className="text-right">{tCommon("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map((location) => {
                  const isExpanded = expandedLocations.has(location.locationId);
                  const hasBatches = (location.batches?.length || 0) > 0;

                  return (
                    <Fragment key={location.id}>
                      <TableRow>
                        <TableCell>
                          {hasBatches && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => toggleLocation(location.locationId)}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{location.warehouseCode}</div>
                          <div className="text-xs text-muted-foreground">
                            {location.warehouseName}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm font-medium">
                            {location.locationCode}
                            {location.isDefault && (
                              <Badge variant="secondary" className="text-xs">
                                {t("defaultBadge")}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">{location.locationName}</div>
                        </TableCell>
                        <TableCell className="text-sm capitalize">{location.locationType}</TableCell>
                        <TableCell className="text-right">
                          {formatQty(location.qtyOnHand, locale)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatQty(location.qtyReserved, locale)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatQty(location.qtyAvailable, locale)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatQty(location.inTransit || 0, locale)}
                        </TableCell>
                        <TableCell>
                          {location.estimatedArrivalDate
                            ? new Date(location.estimatedArrivalDate).toLocaleDateString(locale)
                            : "--"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={location.isDefault || setDefaultLocation.isPending}
                            onClick={() => setDefaultLocation.mutate(location)}
                          >
                            {t("setDefault")}
                          </Button>
                        </TableCell>
                      </TableRow>
                      {hasBatches && isExpanded && (
                        <TableRow>
                          <TableCell colSpan={10} className="bg-muted/50 p-0">
                            <div className="px-4 py-2">
                              <Table>
                                <TableHeader>
                                  <TableRow className="hover:bg-transparent">
                                    <TableHead className="h-8 text-xs">{t("batchCode")}</TableHead>
                                    <TableHead className="h-8 text-xs">{t("receivedDate")}</TableHead>
                                    <TableHead className="h-8 text-right text-xs">
                                      {t("onHand")}
                                    </TableHead>
                                    <TableHead className="h-8 text-right text-xs">
                                      {t("reserved")}
                                    </TableHead>
                                    <TableHead className="h-8 text-right text-xs">
                                      {t("available")}
                                    </TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {location.batches?.map((batch) => (
                                    <TableRow key={batch.id} className="hover:bg-transparent">
                                      <TableCell className="py-2 text-xs font-medium">
                                        {batch.batchCode}
                                      </TableCell>
                                      <TableCell className="py-2 text-xs">
                                        {new Date(batch.receivedAt).toLocaleDateString(locale)}
                                      </TableCell>
                                      <TableCell className="py-2 text-right text-xs">
                                        {formatQty(batch.qtyOnHand, locale)}
                                      </TableCell>
                                      <TableCell className="py-2 text-right text-xs">
                                        {formatQty(batch.qtyReserved, locale)}
                                      </TableCell>
                                      <TableCell className="py-2 text-right text-xs">
                                        {formatQty(batch.qtyAvailable, locale)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      <Dialog
        open={moveDialogOpen}
        onOpenChange={(open) => {
          setMoveDialogOpen(open);
          if (!open) {
            setSelectedWarehouseId("");
            setFromLocationId("");
            setToLocationId("");
            setMoveQty("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("moveDialogTitle")}</DialogTitle>
            <DialogDescription>{t("moveDialogDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t("warehouseLabel")}</label>
              <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
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
            <div>
              <label className="text-sm font-medium">{t("fromLocationLabel")}</label>
              <Select
                value={fromLocationId}
                onValueChange={setFromLocationId}
                disabled={!selectedWarehouseId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("selectSourceLocation")} />
                </SelectTrigger>
                <SelectContent>
                  {fromLocations.map((loc) => (
                    <SelectItem key={loc.locationId} value={loc.locationId}>
                      {loc.locationCode} - {loc.locationName} ({t("availableShort")}{" "}
                      {formatQty(loc.qtyAvailable, locale)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">{t("toLocationLabel")}</label>
              <Select
                value={toLocationId}
                onValueChange={setToLocationId}
                disabled={!selectedWarehouseId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("selectDestinationLocation")} />
                </SelectTrigger>
                <SelectContent>
                  {toLocations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.code} - {loc.name || t("unnamed")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">{t("quantityLabel")}</label>
              <Input
                type="number"
                min="0"
                step="0.0001"
                value={moveQty}
                onChange={(event) => setMoveQty(event.target.value)}
                placeholder={t("quantityPlaceholder")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveDialogOpen(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={() => moveStock.mutate()} disabled={moveStock.isPending}>
              {moveStock.isPending ? t("moving") : t("moveStock")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
