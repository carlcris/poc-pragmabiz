"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Printer, MapPin, Package } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { GRN, GRNItem, GRNBox } from "@/types/grn";
import type { WarehouseLocation } from "@/types/inventory-location";
import { printBarcodeLabels, type BarcodeData } from "@/lib/barcode";

interface BoxManagementSectionProps {
  grn: GRN;
  isEditable: boolean;
}

export function BoxManagementSection({ grn, isEditable }: BoxManagementSectionProps) {
  const t = useTranslations("grnBoxManagementSection");
  const common = useTranslations("common");
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<GRNItem | null>(null);
  const [numBoxes, setNumBoxes] = useState(1);
  const [locationId, setLocationId] = useState<string | undefined>(undefined);
  const [boxes, setBoxes] = useState<GRNBox[]>([]);
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);

  const fetchBoxes = useCallback(async (): Promise<GRNBox[]> => {
    try {
      const response = await fetch(`/api/grns/${grn.id}/boxes`);
      if (!response.ok) throw new Error(t("generateError"));
      const data = await response.json();
      const nextBoxes = (data.data || []) as GRNBox[];
      setBoxes(nextBoxes);
      return nextBoxes;
    } catch (error) {
      console.error("Error fetching boxes:", error);
      return [];
    }
  }, [grn.id, t]);

  useEffect(() => {
    fetchBoxes();
  }, [fetchBoxes]);

  const fetchLocations = useCallback(async () => {
    if (!grn.warehouseId) return;

    try {
      setIsLoadingLocations(true);
      const response = await fetch(`/api/warehouses/${grn.warehouseId}/locations`);
      if (!response.ok) throw new Error(t("loadLocationsError"));
      const data = await response.json();
      setLocations(data.data || []);
    } catch (error) {
      console.error("Error fetching locations:", error);
      toast.error(t("loadLocationsError"));
    } finally {
      setIsLoadingLocations(false);
    }
  }, [grn.warehouseId, t]);

  useEffect(() => {
    if (generateDialogOpen) {
      fetchLocations();
    }
  }, [generateDialogOpen, fetchLocations]);

  const handleOpenDialog = (item: GRNItem) => {
    setSelectedItem(item);
    setNumBoxes(item.numBoxes || 1);
    setGenerateDialogOpen(true);
  };

  const handleGenerateBoxes = async () => {
    if (!selectedItem) return;

    try {
      setIsGenerating(true);

      const response = await fetch(`/api/grns/${grn.id}/boxes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grnItemId: selectedItem.id,
          numBoxes,
          warehouseLocationId: locationId || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || t("generateError"));
      }

      toast.success(t("generateSuccess", { count: numBoxes }));
      setGenerateDialogOpen(false);
      await fetchBoxes();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("generateError"));
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrintLabels = async (itemBoxes?: GRNBox[]) => {
    try {
      setIsPrinting(true);

      const latestBoxes = await fetchBoxes();
      const boxesToPrint = itemBoxes
        ? latestBoxes.filter((latestBox) => itemBoxes.some((box) => box.id === latestBox.id))
        : latestBoxes;
      if (boxesToPrint.length === 0) {
        toast.error(t("printNoBoxes"));
        return;
      }

      const barcodeData: BarcodeData[] = boxesToPrint.map((box) => {
        const item = grn.items.find((grnItem) => grnItem.id === box.grnItemId);
        return {
          boxId: box.id,
          itemId: box.itemId,
          batchLocationSku: box.batchLocationSku || null,
          batchNumber: grn.batchNumber || "",
          grnNumber: grn.grnNumber,
          itemCode: item?.item?.code || "",
          itemName: item?.item?.name || "",
          boxNumber: box.boxNumber,
          qtyPerBox: box.qtyPerBox,
          deliveryDate: box.deliveryDate,
          containerNumber: box.containerNumber,
          sealNumber: box.sealNumber,
          warehouseCode: grn.warehouse?.code,
          locationId: box.warehouseLocationId ?? null,
          locationCode: box.warehouseLocation?.code,
        };
      });

      await printBarcodeLabels(barcodeData);
      toast.success(t("printSuccess"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("printError"));
    } finally {
      setIsPrinting(false);
    }
  };

  const boxesByItem = boxes.reduce(
    (acc, box) => {
      if (!acc[box.grnItemId]) {
        acc[box.grnItemId] = [];
      }
      acc[box.grnItemId].push(box);
      return acc;
    },
    {} as Record<string, GRNBox[]>
  );

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-blue-600" />
                {t("title")}
              </CardTitle>
              <CardDescription>{t("description")}</CardDescription>
            </div>
            {boxes.length > 0 && (
              <Button onClick={() => handlePrintLabels()} disabled={isPrinting}>
                <Printer className="mr-2 h-4 w-4" />
                {isPrinting ? t("printing") : t("printAllLabels")}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {grn.items.map((item) => {
            const itemBoxes = boxesByItem[item.id] || [];
            const hasBoxes = itemBoxes.length > 0;

            return (
              <div key={item.id} className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex-1">
                    <div className="font-medium">{item.item?.code}</div>
                    <div className="text-sm text-muted-foreground">{item.item?.name}</div>
                    <div className="mt-1 text-sm">
                      {t("receivedUnits", { count: item.receivedQty })}
                      {hasBoxes && (
                        <span className="ml-3 text-muted-foreground">
                          • {t("boxesGenerated", { count: itemBoxes.length })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {hasBoxes && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePrintLabels(itemBoxes)}
                        disabled={isPrinting}
                      >
                        <Printer className="mr-2 h-4 w-4" />
                        {t("printLabels")}
                      </Button>
                    )}
                    {isEditable && (
                      <Button
                        variant={hasBoxes ? "outline" : "default"}
                        size="sm"
                        onClick={() => handleOpenDialog(item)}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        {hasBoxes ? t("regenerate") : t("generate")} {t("generateBoxLabels")}
                      </Button>
                    )}
                  </div>
                </div>

                {hasBoxes && (
                  <div className="ml-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-24">{t("boxNumber")}</TableHead>
                          <TableHead>{t("barcode")}</TableHead>
                          <TableHead className="text-right">{t("qty")}</TableHead>
                          <TableHead>{t("location")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {itemBoxes.map((box) => (
                          <TableRow key={box.id}>
                            <TableCell className="font-medium">#{box.boxNumber}</TableCell>
                            <TableCell className="font-mono text-xs">{box.barcode}</TableCell>
                            <TableCell className="text-right">{box.qtyPerBox}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {box.warehouseLocation ? (
                                  <>
                                    <MapPin className="h-3 w-3 text-green-600" />
                                    <span className="text-sm">
                                      {box.warehouseLocation.code} - {box.warehouseLocation.name}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-sm text-muted-foreground">{t("notAssigned")}</span>
                                )}
                              </div>
                              {box.batchLocationSku ? (
                                <div className="mt-1 text-xs font-mono text-muted-foreground">
                                  {box.batchLocationSku}
                                </div>
                              ) : null}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            );
          })}

          {grn.items.length === 0 && (
            <div className="py-8 text-center text-muted-foreground">{t("empty")}</div>
          )}
        </CardContent>
      </Card>

      <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dialogTitle")}</DialogTitle>
            <DialogDescription>
              {selectedItem?.item?.code} - {selectedItem?.item?.name}
              <br />
              {t("receivedQuantity", { count: selectedItem?.receivedQty ?? 0 })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="numBoxes">{t("numberOfBoxesLabel")}</Label>
              <Input
                id="numBoxes"
                type="number"
                min="1"
                value={numBoxes}
                onChange={(e) => setNumBoxes(parseInt(e.target.value, 10) || 1)}
              />
              <p className="mt-1 text-sm text-muted-foreground">
                {t("qtyPerBox", {
                  count: selectedItem ? (selectedItem.receivedQty / numBoxes).toFixed(2) : 0,
                })}
              </p>
            </div>
            <div>
              <Label htmlFor="location">{t("warehouseLocationOptional")}</Label>
              <Select
                value={locationId}
                onValueChange={(value) => setLocationId(value === "none" ? undefined : value)}
                disabled={isLoadingLocations}
              >
                <SelectTrigger id="location">
                  <SelectValue
                    placeholder={
                      isLoadingLocations ? t("loadingLocations") : t("assignLocationLater")
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("noLocation")}</SelectItem>
                  {locations
                    .filter((loc) => loc.isActive && loc.isStorable)
                    .map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.code} - {loc.name || t("unnamed")}
                      </SelectItem>
                    ))}
                  {locations.length === 0 && !isLoadingLocations && (
                    <SelectItem value="no-locations" disabled>
                      {t("noLocationsAvailable")}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="mt-1 text-sm text-muted-foreground">{t("assignLaterDescription")}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateDialogOpen(false)}>
              {common("cancel")}
            </Button>
            <Button onClick={handleGenerateBoxes} disabled={isGenerating || numBoxes < 1}>
              {isGenerating ? t("generating") : t("generateBoxes")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
