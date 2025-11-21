"use client";

import { MobileHeader } from "@/components/mobile/MobileHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, TrendingUp, AlertCircle, DollarSign } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserVanWarehouse, useVanSalesStats } from "@/hooks/useVanWarehouse";
import { useVanInventory } from "@/hooks/useVanInventory";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useMemo } from "react";

interface VanInventoryItem {
  itemId: string;
  itemCode: string;
  itemName: string;
  description: string | null;
  currentStock: number;
  unitPrice: number;
  reorderPoint: number;
  categoryId: string | null;
  categoryName: string | null;
}

export default function VanSalesDashboardPage() {
  // Fetch user's van warehouse assignment
  const { data: vanData, isLoading: vanLoading, error: vanError } = useUserVanWarehouse();

  // Fetch van inventory
  const { data: inventoryData, isLoading: inventoryLoading } = useVanInventory(
    vanData?.vanWarehouseId
  );

  // Fetch van sales stats
  const { data: salesStats, isLoading: salesLoading } = useVanSalesStats();

  const isLoading = vanLoading || inventoryLoading || salesLoading;

  // Extract van and driver info
  const vanName = vanData?.vanWarehouse?.name || "No Van Assigned";
  const driverName = vanData?.fullName || "Driver";

  // Calculate stats from real data
  const stats = useMemo(() => {
    const summary = inventoryData?.summary;
    const itemsOnHand = summary?.itemsInStock || 0;
    const lowStock = summary?.lowStockItems || 0;

    const todaySales = salesStats?.todaySales || 0;
    const transactions = salesStats?.transactions || 0;
    const itemsSold = salesStats?.itemsSold || 0;

    return [
      {
        title: "Items On-Hand",
        value: itemsOnHand.toString(),
        description: "Items in van",
        icon: Package,
        color: "text-blue-600",
        bgColor: "bg-blue-50",
      },
      {
        title: "Today's Sales",
        value: `₱${todaySales.toFixed(2)}`,
        description: `${transactions} transactions`,
        icon: DollarSign,
        color: "text-green-600",
        bgColor: "bg-green-50",
      },
      {
        title: "Items Sold",
        value: itemsSold.toString(),
        description: "Today",
        icon: TrendingUp,
        color: "text-purple-600",
        bgColor: "bg-purple-50",
      },
      {
        title: "Low Stock",
        value: lowStock.toString(),
        description: "Need restocking",
        icon: AlertCircle,
        color: "text-orange-600",
        bgColor: "bg-orange-50",
      },
    ];
  }, [inventoryData, salesStats]);

  // Get low stock items from inventory
  const lowStockItems = useMemo(() => {
    if (!inventoryData?.inventory) return [];

    return inventoryData.inventory
      .filter((item: VanInventoryItem) => item.currentStock > 0 && item.currentStock <= item.reorderPoint)
      .sort((a: VanInventoryItem, b: VanInventoryItem) => a.currentStock - b.currentStock)
      .slice(0, 5);
  }, [inventoryData]);

  // Show error state if no van assigned
  if (vanError || (!vanLoading && !vanData?.vanWarehouseId)) {
    return (
      <div className="min-h-screen bg-gray-50">
        <MobileHeader title="Dashboard" />
        <div className="p-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No Van Assigned</AlertTitle>
            <AlertDescription>
              You have not been assigned to a van warehouse. Please contact your supervisor to assign you to a van.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileHeader
        title="Dashboard"
        vanName={vanName}
        driverName={driverName}
        showLogout={true}
      />

      <div className="p-4 space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {isLoading ? (
            <>
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <Skeleton className="h-4 w-20" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-16 mb-1" />
                    <Skeleton className="h-3 w-24" />
                  </CardContent>
                </Card>
              ))}
            </>
          ) : (
            stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card
                  key={stat.title}
                  className="shadow-sm hover:shadow-md transition-shadow"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                        <Icon className={`h-4 w-4 ${stat.color}`} />
                      </div>
                    </div>
                    <CardTitle className="text-sm font-medium text-gray-600">
                      {stat.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <p className="text-xs text-gray-500 mt-1">
                      {stat.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Low Stock Alert */}
        {lowStockItems.length > 0 && (
          <Card className="shadow-sm border-orange-200">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-600" />
                Low Stock Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {lowStockItems.map((item: VanInventoryItem) => (
                  <div
                    key={item.itemId}
                    className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.itemName}</p>
                      <p className="text-xs text-gray-500">{item.itemCode}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-orange-600">
                        {item.currentStock}
                      </p>
                      <p className="text-xs text-gray-500">
                        of {item.reorderPoint}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Info */}
        {!isLoading && (
          <Card className="shadow-sm bg-gradient-to-br from-green-50 to-emerald-50">
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <Package className="h-12 w-12 mx-auto text-green-600" />
                <h3 className="font-bold text-lg">
                  {inventoryData?.summary?.itemsInStock ? "Van is Ready!" : "Van is Empty"}
                </h3>
                <p className="text-sm text-gray-600">
                  {inventoryData?.summary?.itemsInStock
                    ? "You have loaded inventory and are ready to make sales."
                    : "Load inventory to start selling."}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
