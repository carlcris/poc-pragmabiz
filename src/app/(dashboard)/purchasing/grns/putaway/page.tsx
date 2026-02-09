"use client";

import { useState, useEffect, useMemo } from "react";
import { Scan, MapPin, CheckCircle, Package, ArrowLeft, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useWarehouses } from "@/hooks/useWarehouses";
import type { WarehouseLocation } from "@/types/inventory-location";
import { cn } from "@/lib/utils";

type ScannedBox = {
  id: string;
  barcode: string;
  grnNumber: string;
  itemCode: string;
  itemName: string;
  boxNumber: number;
  qtyPerBox: number;
  deliveryDate: string;
  currentLocation?: {
    code: string;
    name: string;
  };
};

export default function PutawayPage() {
  const router = useRouter();
  const [barcodeInput, setBarcodeInput] = useState("");
  const [scannedBox, setScannedBox] = useState<ScannedBox | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [locationSearchOpen, setLocationSearchOpen] = useState(false);
  const [warehouseId, setWarehouseId] = useState("");
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [completedBoxes, setCompletedBoxes] = useState<ScannedBox[]>([]);

  const { data: warehousesData } = useWarehouses({ page: 1, limit: 1000 });
  const warehouses = warehousesData?.data || [];

  // Fetch warehouse locations when warehouse is selected
  useEffect(() => {
    const fetchLocations = async () => {
      if (!warehouseId) {
        setLocations([]);
        return;
      }

      try {
        setIsLoadingLocations(true);
        const response = await fetch(`/api/warehouses/${warehouseId}/locations`);
        if (!response.ok) throw new Error("Failed to fetch locations");
        const data = await response.json();
        setLocations(data.data || []);
      } catch (error) {
        console.error("Error fetching locations:", error);
        toast.error("Failed to load warehouse locations");
        setLocations([]);
      } finally {
        setIsLoadingLocations(false);
      }
    };

    fetchLocations();
  }, [warehouseId]);

  // Filter active and storable locations
  const availableLocations = useMemo(
    () => locations.filter((loc) => loc.isActive && loc.isStorable),
    [locations]
  );

  // Get selected location details
  const selectedLocation = availableLocations.find((loc) => loc.id === selectedLocationId);

  const handleScanBarcode = async () => {
    if (!barcodeInput.trim()) {
      toast.error("Please enter or scan a barcode");
      return;
    }

    try {
      setIsScanning(true);

      // Parse QR code data
      try {
        const qrData = JSON.parse(barcodeInput);

        // Fetch box details from API
        const response = await fetch(`/api/grn-boxes/${qrData.id}`);
        if (!response.ok) throw new Error("Box not found");

        const boxData = await response.json();

        setScannedBox({
          id: boxData.id,
          barcode: barcodeInput,
          grnNumber: qrData.grn,
          itemCode: qrData.item,
          itemName: "", // TODO: Fetch from API
          boxNumber: qrData.box,
          qtyPerBox: qrData.qty,
          deliveryDate: qrData.date,
          currentLocation: boxData.warehouseLocation,
        });

        if (boxData.warehouseLocation) {
          toast.info(`Box already assigned to ${boxData.warehouseLocation.code}`);
        }
      } catch {
        // If not JSON, treat as simple barcode
        // Search for box by barcode string
        const response = await fetch(`/api/grn-boxes?barcode=${encodeURIComponent(barcodeInput)}`);
        if (!response.ok) throw new Error("Box not found");

        const data = await response.json();
        if (!data.data || data.data.length === 0) {
          throw new Error("Box not found");
        }

        const boxData = data.data[0];
        setScannedBox({
          id: boxData.id,
          barcode: barcodeInput,
          grnNumber: boxData.grnNumber || "",
          itemCode: boxData.itemCode || "",
          itemName: boxData.itemName || "",
          boxNumber: boxData.boxNumber,
          qtyPerBox: boxData.qtyPerBox,
          deliveryDate: boxData.deliveryDate,
          currentLocation: boxData.warehouseLocation,
        });
      }

      toast.success("Box scanned successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to scan barcode");
      setScannedBox(null);
    } finally {
      setIsScanning(false);
    }
  };

  const handleAssignLocation = async () => {
    if (!scannedBox) return;
    if (!selectedLocationId) {
      toast.error("Please select a warehouse location");
      return;
    }
    if (!warehouseId) {
      toast.error("Please select a warehouse first");
      return;
    }

    try {
      setIsAssigning(true);

      // Validate location exists and belongs to selected warehouse
      const location = availableLocations.find((loc) => loc.id === selectedLocationId);
      if (!location) {
        toast.error("Invalid location selected");
        return;
      }

      if (location.warehouseId !== warehouseId) {
        toast.error("Location does not belong to selected warehouse");
        return;
      }

      const response = await fetch(`/api/grn-boxes/${scannedBox.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouseLocationId: selectedLocationId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to assign location");
      }

      const locationDisplayName = `${location.code}${location.name ? ` - ${location.name}` : ""}`;
      toast.success(`Box assigned to ${locationDisplayName}`);

      // Add to completed list
      setCompletedBoxes([
        ...completedBoxes,
        {
          ...scannedBox,
          currentLocation: {
            code: location.code,
            name: location.name || "",
          },
        },
      ]);

      // Reset for next box
      setScannedBox(null);
      setBarcodeInput("");
      setSelectedLocationId("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to assign location");
    } finally {
      setIsAssigning(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleScanBarcode();
    }
  };

  return (
    <div className="container max-w-4xl space-y-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Putaway Station</h1>
          <p className="text-muted-foreground">Scan boxes and assign warehouse locations</p>
        </div>
      </div>

      {/* Warehouse Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Warehouse</CardTitle>
          <CardDescription>Choose the warehouse you are working in</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={warehouseId} onValueChange={setWarehouseId}>
            <SelectTrigger>
              <SelectValue placeholder="Select warehouse" />
            </SelectTrigger>
            <SelectContent>
              {warehouses.map((wh) => (
                <SelectItem key={wh.id} value={wh.id}>
                  {wh.name} ({wh.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Scan Box */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scan className="h-5 w-5 text-blue-600" />
            Scan Box Barcode
          </CardTitle>
          <CardDescription>Scan QR code or enter barcode manually</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                id="barcode"
                placeholder="Scan or enter barcode..."
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyPress={handleKeyPress}
                autoFocus
                className="text-lg"
              />
            </div>
            <Button onClick={handleScanBarcode} disabled={isScanning || !barcodeInput.trim()}>
              <Scan className="mr-2 h-4 w-4" />
              {isScanning ? "Scanning..." : "Scan"}
            </Button>
          </div>

          {scannedBox && (
            <div className="rounded-lg border-2 border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
              <div className="mb-2 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-900 dark:text-green-100">Box Scanned</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-muted-foreground">GRN:</span>{" "}
                    <span className="font-medium">{scannedBox.grnNumber}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Box:</span>{" "}
                    <span className="font-medium">#{scannedBox.boxNumber}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Item:</span>{" "}
                    <span className="font-medium">{scannedBox.itemCode}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Qty:</span>{" "}
                    <span className="font-medium">{scannedBox.qtyPerBox}</span>
                  </div>
                </div>
                {scannedBox.currentLocation && (
                  <div className="mt-2 rounded bg-yellow-100 p-2 dark:bg-yellow-900">
                    <span className="text-xs text-yellow-900 dark:text-yellow-100">
                      Currently assigned to: {scannedBox.currentLocation.code}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assign Location */}
      {scannedBox && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-orange-600" />
              Assign Storage Location
            </CardTitle>
            <CardDescription>Search and select a warehouse location</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!warehouseId ? (
              <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
                Please select a warehouse first
              </div>
            ) : (
              <>
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Popover open={locationSearchOpen} onOpenChange={setLocationSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="location"
                        variant="outline"
                        role="combobox"
                        aria-expanded={locationSearchOpen}
                        className="w-full justify-between text-lg"
                        disabled={isLoadingLocations || availableLocations.length === 0}
                      >
                        {selectedLocation ? (
                          <span>
                            {selectedLocation.code}
                            {selectedLocation.name && ` - ${selectedLocation.name}`}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            {isLoadingLocations
                              ? "Loading locations..."
                              : availableLocations.length === 0
                              ? "No locations available"
                              : "Search location..."}
                          </span>
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search by code or name..." />
                        <CommandList>
                          <CommandEmpty>No location found.</CommandEmpty>
                          <CommandGroup>
                            {availableLocations.map((location) => (
                              <CommandItem
                                key={location.id}
                                value={`${location.code} ${location.name || ""}`}
                                onSelect={() => {
                                  setSelectedLocationId(location.id);
                                  setLocationSearchOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedLocationId === location.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span className="font-medium">{location.code}</span>
                                  {location.name && (
                                    <span className="text-sm text-muted-foreground">{location.name}</span>
                                  )}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {availableLocations.length} location{availableLocations.length !== 1 ? "s" : ""} available
                  </p>
                </div>
                <Button
                  onClick={handleAssignLocation}
                  disabled={isAssigning || !selectedLocationId}
                  className="w-full"
                  size="lg"
                >
                  <CheckCircle className="mr-2 h-5 w-5" />
                  {isAssigning ? "Assigning..." : "Confirm Location"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Completed Boxes */}
      {completedBoxes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-green-600" />
              Completed ({completedBoxes.length})
            </CardTitle>
            <CardDescription>Boxes processed in this session</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {completedBoxes.slice().reverse().map((box, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <div className="font-medium">
                      {box.grnNumber} - Box #{box.boxNumber}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {box.itemCode} • Qty: {box.qtyPerBox}
                    </div>
                  </div>
                  <Badge variant="outline" className="border-green-600 text-green-700">
                    <MapPin className="mr-1 h-3 w-3" />
                    {box.currentLocation?.code}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
