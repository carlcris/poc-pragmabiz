"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Scan, MapPin, CheckCircle, Package, ArrowLeft } from "lucide-react";
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
import { useWarehouses } from "@/hooks/useWarehouses";
import {
  WarehouseLocationSelect,
  type WarehouseLocationOption,
} from "@/components/warehouses/WarehouseLocationSelect";

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
  const t = useTranslations("grnPutawayPage");
  const router = useRouter();
  const [barcodeInput, setBarcodeInput] = useState("");
  const [scannedBox, setScannedBox] = useState<ScannedBox | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<WarehouseLocationOption | null>(null);
  const [warehouseId, setWarehouseId] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [completedBoxes, setCompletedBoxes] = useState<ScannedBox[]>([]);

  const { data: warehousesData } = useWarehouses({ page: 1, limit: 50 });
  const warehouses = warehousesData?.data || [];

  const handleScanBarcode = async () => {
    if (!barcodeInput.trim()) {
      toast.error(t("enterBarcodeError"));
      return;
    }

    try {
      setIsScanning(true);

      try {
        const qrData = JSON.parse(barcodeInput);
        const response = await fetch(`/api/grn-boxes/${qrData.id}`);
        if (!response.ok) throw new Error(t("boxNotFound"));

        const boxData = await response.json();

        setScannedBox({
          id: boxData.id,
          barcode: barcodeInput,
          grnNumber: qrData.grn,
          itemCode: qrData.item,
          itemName: "",
          boxNumber: qrData.box,
          qtyPerBox: qrData.qty,
          deliveryDate: qrData.date,
          currentLocation: boxData.warehouseLocation,
        });

        if (boxData.warehouseLocation) {
          toast.info(t("alreadyAssignedTo", { code: boxData.warehouseLocation.code }));
        }
      } catch {
        const response = await fetch(`/api/grn-boxes?barcode=${encodeURIComponent(barcodeInput)}`);
        if (!response.ok) throw new Error(t("boxNotFound"));

        const data = await response.json();
        if (!data.data || data.data.length === 0) {
          throw new Error(t("boxNotFound"));
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

      toast.success(t("scanSuccess"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("scanError"));
      setScannedBox(null);
    } finally {
      setIsScanning(false);
    }
  };

  const handleAssignLocation = async () => {
    if (!scannedBox) return;
    if (!selectedLocationId) {
      toast.error(t("selectLocationError"));
      return;
    }
    if (!warehouseId) {
      toast.error(t("selectWarehouseError"));
      return;
    }

    try {
      setIsAssigning(true);

      const location = selectedLocation?.id === selectedLocationId ? selectedLocation : null;
      if (!location) {
        toast.error(t("invalidLocationSelected"));
        return;
      }

      if (location.warehouseId !== warehouseId) {
        toast.error(t("locationWarehouseMismatch"));
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
        throw new Error(error.error || t("assignError"));
      }

      const locationDisplayName = `${location.code}${location.name ? ` - ${location.name}` : ""}`;
      toast.success(t("assignSuccess", { location: locationDisplayName }));

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

      setScannedBox(null);
      setBarcodeInput("");
      setSelectedLocationId("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("assignError"));
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
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("back")}
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("selectWarehouseTitle")}</CardTitle>
          <CardDescription>{t("selectWarehouseDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={warehouseId}
            onValueChange={(nextWarehouseId) => {
              setWarehouseId(nextWarehouseId);
              setSelectedLocationId("");
              setSelectedLocation(null);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("selectWarehousePlaceholder")} />
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scan className="h-5 w-5 text-blue-600" />
            {t("scanTitle")}
          </CardTitle>
          <CardDescription>{t("scanDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                id="barcode"
                placeholder={t("barcodePlaceholder")}
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={handleKeyPress}
                autoFocus
                className="text-lg"
              />
            </div>
            <Button onClick={handleScanBarcode} disabled={isScanning || !barcodeInput.trim()}>
              <Scan className="mr-2 h-4 w-4" />
              {isScanning ? t("scanning") : t("scan")}
            </Button>
          </div>

          {scannedBox && (
            <div className="rounded-lg border-2 border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
              <div className="mb-2 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-900 dark:text-green-100">
                  {t("boxScanned")}
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-muted-foreground">{t("grn")}:</span>{" "}
                    <span className="font-medium">{scannedBox.grnNumber}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("box")}:</span>{" "}
                    <span className="font-medium">#{scannedBox.boxNumber}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("item")}:</span>{" "}
                    <span className="font-medium">{scannedBox.itemCode}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("qty")}:</span>{" "}
                    <span className="font-medium">{scannedBox.qtyPerBox}</span>
                  </div>
                </div>
                {scannedBox.currentLocation && (
                  <div className="mt-2 rounded bg-yellow-100 p-2 dark:bg-yellow-900">
                    <span className="text-xs text-yellow-900 dark:text-yellow-100">
                      {t("currentlyAssignedTo", { code: scannedBox.currentLocation.code })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {scannedBox && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-orange-600" />
              {t("assignLocationTitle")}
            </CardTitle>
            <CardDescription>{t("assignLocationDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!warehouseId ? (
              <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
                {t("selectWarehouseFirstNotice")}
              </div>
            ) : (
              <>
                <div>
                  <Label htmlFor="location">{t("locationLabel")}</Label>
                  <WarehouseLocationSelect
                    warehouseId={warehouseId}
                    value={selectedLocationId}
                    onValueChange={setSelectedLocationId}
                    selectedOption={selectedLocation}
                    onOptionChange={setSelectedLocation}
                    storableOnly
                    buttonClassName="text-lg"
                  />
                </div>
                <Button
                  onClick={handleAssignLocation}
                  disabled={isAssigning || !selectedLocationId}
                  className="w-full"
                  size="lg"
                >
                  <CheckCircle className="mr-2 h-5 w-5" />
                  {isAssigning ? t("assigning") : t("confirmLocation")}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {completedBoxes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-green-600" />
              {t("completedTitle", { count: completedBoxes.length })}
            </CardTitle>
            <CardDescription>{t("completedDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {completedBoxes
                .slice()
                .reverse()
                .map((box, index) => (
                  <div
                    key={`${box.id}-${index}`}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <div className="font-medium">
                        {box.grnNumber} - #{box.boxNumber}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {box.itemCode} • {t("qty")}: {box.qtyPerBox}
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
