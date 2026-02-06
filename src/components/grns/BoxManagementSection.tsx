"use client";

import { useState } from "react";
import { Plus, Printer, MapPin, Trash2, Package } from "lucide-react";
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
import { useEffect } from "react";

interface BoxManagementSectionProps {
  grn: GRN;
  isEditable: boolean;
}

export function BoxManagementSection({ grn, isEditable }: BoxManagementSectionProps) {
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<GRNItem | null>(null);
  const [numBoxes, setNumBoxes] = useState(1);
  const [locationId, setLocationId] = useState<string | undefined>(undefined);
  const [boxes, setBoxes] = useState<GRNBox[]>([]);
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);

  // Fetch boxes when component mounts or GRN changes
  const fetchBoxes = async () => {
    try {
      const response = await fetch(`/api/grns/${grn.id}/boxes`);
      if (!response.ok) throw new Error("Failed to fetch boxes");
      const data = await response.json();
      setBoxes(data.data || []);
    } catch (error) {
      console.error("Error fetching boxes:", error);
    }
  };

  useEffect(() => {
    fetchBoxes();
  }, [grn.id]);

  // Fetch warehouse locations for the GRN warehouse
  const fetchLocations = async () => {
    if (!grn.warehouseId) return;

    try {
      setIsLoadingLocations(true);
      const response = await fetch(`/api/warehouses/${grn.warehouseId}/locations`);
      if (!response.ok) throw new Error("Failed to fetch locations");
      const data = await response.json();
      setLocations(data.data || []);
    } catch (error) {
      console.error("Error fetching locations:", error);
      toast.error("Failed to load warehouse locations");
    } finally {
      setIsLoadingLocations(false);
    }
  };

  // Load locations when dialog opens
  useEffect(() => {
    if (generateDialogOpen) {
      fetchLocations();
    }
  }, [generateDialogOpen, grn.warehouseId]);

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
        throw new Error(error.error || "Failed to generate boxes");
      }

      toast.success(`${numBoxes} boxes generated successfully`);
      setGenerateDialogOpen(false);
      fetchBoxes();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate boxes");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrintLabels = async (itemBoxes?: GRNBox[]) => {
    try {
      setIsPrinting(true);

      const boxesToPrint = itemBoxes || boxes;
      if (boxesToPrint.length === 0) {
        toast.error("No boxes to print");
        return;
      }

      // Convert boxes to barcode data
      const barcodeData: BarcodeData[] = boxesToPrint.map((box) => {
        const item = grn.items.find((i) => i.id === box.grnItemId);
        return {
          boxId: box.id,
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
          locationCode: box.warehouseLocation?.code,
        };
      });

      await printBarcodeLabels(barcodeData);
      toast.success("Barcode labels sent to printer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to print labels");
    } finally {
      setIsPrinting(false);
    }
  };

  // Group boxes by item
  const boxesByItem = boxes.reduce((acc, box) => {
    if (!acc[box.grnItemId]) {
      acc[box.grnItemId] = [];
    }
    acc[box.grnItemId].push(box);
    return acc;
  }, {} as Record<string, GRNBox[]>);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-blue-600" />
                Box Management & Barcodes
              </CardTitle>
              <CardDescription>Generate boxes and print barcode labels</CardDescription>
            </div>
            {boxes.length > 0 && (
              <Button onClick={() => handlePrintLabels()} disabled={isPrinting}>
                <Printer className="mr-2 h-4 w-4" />
                {isPrinting ? "Printing..." : "Print All Labels"}
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
                      Received: <span className="font-medium">{item.receivedQty}</span> units
                      {hasBoxes && (
                        <span className="ml-3 text-muted-foreground">
                          • {itemBoxes.length} boxes generated
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
                        Print Labels
                      </Button>
                    )}
                    {isEditable && (
                      <Button
                        variant={hasBoxes ? "outline" : "default"}
                        size="sm"
                        onClick={() => handleOpenDialog(item)}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        {hasBoxes ? "Regenerate" : "Generate"} Box Labels
                      </Button>
                    )}
                  </div>
                </div>

                {hasBoxes && (
                  <div className="ml-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-24">Box #</TableHead>
                          <TableHead>Barcode</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead>Location</TableHead>
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
                                  <span className="text-sm text-muted-foreground">Not assigned</span>
                                )}
                              </div>
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
            <div className="py-8 text-center text-muted-foreground">
              No items to generate boxes for
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generate Boxes Dialog */}
      <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Boxes for Item</DialogTitle>
            <DialogDescription>
              {selectedItem?.item?.code} - {selectedItem?.item?.name}
              <br />
              Received Quantity: {selectedItem?.receivedQty}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="numBoxes">Number of Boxes *</Label>
              <Input
                id="numBoxes"
                type="number"
                min="1"
                value={numBoxes}
                onChange={(e) => setNumBoxes(parseInt(e.target.value) || 1)}
              />
              <p className="mt-1 text-sm text-muted-foreground">
                Qty per box: {selectedItem ? (selectedItem.receivedQty / numBoxes).toFixed(2) : 0}
              </p>
            </div>
            <div>
              <Label htmlFor="location">Warehouse Location (Optional)</Label>
              <Select
                value={locationId}
                onValueChange={(value) => setLocationId(value === "none" ? undefined : value)}
                disabled={isLoadingLocations}
              >
                <SelectTrigger id="location">
                  <SelectValue placeholder={isLoadingLocations ? "Loading locations..." : "Assign location later"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No location</SelectItem>
                  {locations
                    .filter((loc) => loc.isActive && loc.isStorable)
                    .map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.code} - {loc.name || "Unnamed"}
                      </SelectItem>
                    ))}
                  {locations.length === 0 && !isLoadingLocations && (
                    <SelectItem value="no-locations" disabled>
                      No locations available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="mt-1 text-sm text-muted-foreground">
                You can assign locations later using the putaway screen
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerateBoxes} disabled={isGenerating || numBoxes < 1}>
              {isGenerating ? "Generating..." : "Generate Boxes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
