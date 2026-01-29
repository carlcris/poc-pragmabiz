"use client";

import { useState } from "react";
import { MobileHeader } from "@/components/mobile/MobileHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";
import { useUserVanWarehouse } from "@/hooks/useVanWarehouse";
import { Search, AlertCircle, Calendar, Package, TrendingUp, TrendingDown } from "lucide-react";

type ItemMovement = {
  itemId: string;
  itemCode: string;
  itemName: string;
  uomName: string;
  beginningQty: number;
  itemsIn: number;
  itemsOut: number;
  endingQty: number;
};

type CurrentStockItem = {
  itemId: string;
  itemCode: string;
  itemName: string;
  uomName: string;
  currentStock?: number;
};

type MovementEntry = {
  itemId: string;
  totalIn?: number;
  totalOut?: number;
  openingBalance?: number;
};

export default function InventoryMovementPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);

  const { data: vanData, isLoading: vanLoading } = useUserVanWarehouse();

  // Fetch current stock
  const { data: currentStockData, isLoading: currentStockLoading } = useQuery({
    queryKey: ["current-stock", vanData?.vanWarehouseId],
    queryFn: async () => {
      if (!vanData?.vanWarehouseId) return { data: { inventory: [] } };
      const response = await fetch(`/api/warehouses/${vanData.vanWarehouseId}/inventory`);
      if (!response.ok) throw new Error("Failed to fetch stock");
      return response.json();
    },
    enabled: !!vanData?.vanWarehouseId,
  });

  // Fetch stock movement for the selected date
  const { data: movementData, isLoading: movementLoading } = useQuery({
    queryKey: ["stock-movement-summary", vanData?.vanWarehouseId, selectedDate],
    queryFn: async () => {
      if (!vanData?.vanWarehouseId) return { data: [] };

      const params = new URLSearchParams({
        warehouseId: vanData.vanWarehouseId,
        startDate: selectedDate,
        endDate: selectedDate,
        groupBy: "item",
      });

      const response = await fetch(`/api/reports/stock-movement?${params}`);
      if (!response.ok) throw new Error("Failed to fetch movement data");
      return response.json();
    },
    enabled: !!vanData?.vanWarehouseId && !!selectedDate,
  });

  const currentStock = (currentStockData?.data?.inventory as CurrentStockItem[] | undefined) || [];
  const movementReport = (movementData?.data as MovementEntry[] | undefined) || [];

  // Calculate movements per item from the movement report
  const itemMovements: ItemMovement[] = currentStock.map((item) => {
    // Find the movement report entry for this item
    const movement = movementReport.find((entry) => entry.itemId === item.itemId);

    const itemsIn = movement?.totalIn || 0;
    const itemsOut = movement?.totalOut || 0;
    const endingQty = item.currentStock || 0;
    const beginningQty = movement?.openingBalance || endingQty - itemsIn + itemsOut;

    return {
      itemId: item.itemId,
      itemCode: item.itemCode,
      itemName: item.itemName,
      uomName: item.uomName,
      beginningQty,
      itemsIn,
      itemsOut,
      endingQty,
    };
  });

  const filteredMovements = itemMovements.filter(
    (movement) =>
      movement.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      movement.itemCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (vanLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <MobileHeader title="Inventory Movement" showBack backHref="/mobile/reports" />
        <div className="p-4">
          <Skeleton className="mb-4 h-32 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  if (!vanData?.vanWarehouseId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <MobileHeader title="Inventory Movement" showBack backHref="/mobile/reports" />
        <div className="p-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You have not been assigned to a van warehouse. Please contact your supervisor.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const isLoading = currentStockLoading || movementLoading;

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      <MobileHeader
        title="Inventory Movement"
        showBack
        backHref="/mobile/reports"
        subtitle={vanData?.vanWarehouse?.name}
      />

      <div className="space-y-4 p-4">
        {/* Date Filter */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4" />
              Select Date
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
            />
          </CardContent>
        </Card>

        {/* Search Bar */}
        <Card>
          <CardContent className="pt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Movement List */}
        <div className="space-y-3">
          {isLoading ? (
            <>
              {[1, 2, 3, 4, 5].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="mb-2 h-5 w-48" />
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </>
          ) : filteredMovements.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="mx-auto mb-3 h-12 w-12 text-gray-300" />
                <p className="text-gray-500">
                  {searchQuery ? "No items found matching your search" : "No items in inventory"}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredMovements.map((movement) => (
              <Card key={movement.itemId} className="transition-shadow hover:shadow-md">
                <CardContent className="p-4">
                  {/* Item Header */}
                  <div className="mb-1 text-base font-semibold">{movement.itemName}</div>
                  <div className="mb-3 text-xs text-gray-500">{movement.itemCode}</div>

                  {/* Movement Flow */}
                  <div className="space-y-2">
                    {/* Beginning */}
                    <div className="flex items-center justify-between border-b py-2">
                      <span className="text-sm text-gray-600">Beginning Inventory</span>
                      <span className="font-semibold">
                        {movement.beginningQty.toFixed(2)} {movement.uomName}
                      </span>
                    </div>

                    {/* Items In */}
                    {movement.itemsIn > 0 && (
                      <div className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-green-600" />
                          <span className="text-sm text-green-600">Items In</span>
                        </div>
                        <span className="font-semibold text-green-600">
                          +{movement.itemsIn.toFixed(2)} {movement.uomName}
                        </span>
                      </div>
                    )}

                    {/* Items Out */}
                    {movement.itemsOut > 0 && (
                      <div className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-2">
                          <TrendingDown className="h-4 w-4 text-red-600" />
                          <span className="text-sm text-red-600">Items Out (Sold)</span>
                        </div>
                        <span className="font-semibold text-red-600">
                          -{movement.itemsOut.toFixed(2)} {movement.uomName}
                        </span>
                      </div>
                    )}

                    {/* No movement indicator */}
                    {movement.itemsIn === 0 && movement.itemsOut === 0 && (
                      <div className="py-2 text-center">
                        <span className="text-sm italic text-gray-400">
                          No movement on this date
                        </span>
                      </div>
                    )}

                    {/* Ending */}
                    <div className="-mx-4 flex items-center justify-between rounded border-t bg-blue-50 px-4 py-2">
                      <span className="text-sm font-semibold text-blue-900">Ending Inventory</span>
                      <span className="font-bold text-blue-900">
                        {movement.endingQty.toFixed(2)} {movement.uomName}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Results Count */}
        {!isLoading && filteredMovements.length > 0 && (
          <div className="text-center text-sm text-gray-500">
            Showing {filteredMovements.length} items
          </div>
        )}
      </div>
    </div>
  );
}
