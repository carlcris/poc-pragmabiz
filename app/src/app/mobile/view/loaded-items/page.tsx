"use client";

import { useState } from "react";
import { MobileHeader } from "@/components/mobile/MobileHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";
import { useUserVanWarehouse } from "@/hooks/useVanWarehouse";
import { Package, Search, AlertCircle, Box } from "lucide-react";

interface LoadedItem {
  itemId: string;
  itemCode: string;
  itemName: string;
  currentStock: number;
  uomCode: string;
  uomName: string;
}

export default function MobileLoadedItemsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: vanData, isLoading: vanLoading } = useUserVanWarehouse();

  const { data: stockData, isLoading: stockLoading } = useQuery({
    queryKey: ["van-stock", vanData?.vanWarehouseId],
    queryFn: async () => {
      if (!vanData?.vanWarehouseId) return { data: { inventory: [] } };

      const response = await fetch(
        `/api/warehouses/${vanData.vanWarehouseId}/inventory`
      );
      if (!response.ok) throw new Error("Failed to fetch stock");
      return response.json();
    },
    enabled: !!vanData?.vanWarehouseId,
  });

  const items: LoadedItem[] = stockData?.data?.inventory || [];
  const filteredItems = items.filter(
    (item) =>
      item.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.itemCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (vanLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <MobileHeader title="Loaded Items" showBack backHref="/mobile/view" />
        <div className="p-4">
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  if (!vanData?.vanWarehouseId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <MobileHeader title="Loaded Items" showBack backHref="/mobile/view" />
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

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileHeader
        title="Loaded Items"
        showBack
        backHref="/mobile/view"
        subtitle={vanData?.vanWarehouse?.name}
      />

      {/* Search Bar */}
      <div className="sticky top-0 bg-white border-b z-10 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Stats Card */}
      <div className="p-4">
        <Card className="bg-gradient-to-br from-primary to-primary/80 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm opacity-90 mb-1">Total Items Loaded</div>
                <div className="text-3xl font-bold">
                  {stockLoading ? "..." : filteredItems.length}
                </div>
              </div>
              <Box className="h-12 w-12 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Item List */}
      <div className="px-4 pb-4 space-y-3">
        {stockLoading ? (
          <>
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-5 w-48 mb-2" />
                  <Skeleton className="h-4 w-24" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">
              {searchQuery ? "No items found matching your search" : "No items loaded in your van"}
            </p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <Card key={item.itemId} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-semibold text-base mb-1">{item.itemName}</div>
                    <div className="text-sm text-gray-500">{item.itemCode}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge
                      variant={item.currentStock > 0 ? "default" : "secondary"}
                      className="text-base px-3 py-1"
                    >
                      {item.currentStock}
                    </Badge>
                    <span className="text-xs text-gray-500">{item.uomName}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
