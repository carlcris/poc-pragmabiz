"use client";

import { useState } from "react";
import { MobileHeader } from "@/components/mobile/MobileHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useUserVanWarehouse } from "@/hooks/useVanWarehouse";
import { useVanInventory } from "@/hooks/useVanInventory";
import {
  Search,
  AlertCircle,
  Package,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  Box,
  DollarSign,
} from "lucide-react";

export default function StockLevelsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "low" | "out" | "ok">("all");

  const { data: vanData, isLoading: vanLoading } = useUserVanWarehouse();
  const { data: inventoryData, isLoading: inventoryLoading } = useVanInventory(vanData?.vanWarehouseId);

  if (vanLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <MobileHeader
          title="Stock Levels"
          showBack
          backHref="/mobile/reports"
        />
        <div className="p-4">
          <Skeleton className="h-32 w-full mb-4" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  if (!vanData?.vanWarehouseId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <MobileHeader
          title="Stock Levels"
          showBack
          backHref="/mobile/reports"
        />
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

  // Debug: Check the full data structure

  // FIX: The hook already extracts response.data, so we access directly
  const inventory = inventoryData?.data?.inventory || inventoryData?.inventory || [];
  const summary = inventoryData?.data?.summary || inventoryData?.summary || {
    totalItems: 0,
    itemsInStock: 0,
    lowStockItems: 0,
    outOfStockItems: 0,
  };

  // Categorize items by stock status
  const categorizedItems = inventory.map((item: any) => {
    let status: "out" | "low" | "ok" = "ok";
    if (item.currentStock === 0) {
      status = "out";
    } else if (item.currentStock <= item.reorderPoint) {
      status = "low";
    }
    return { ...item, status };
  });

  // Filter items by search query first
  const searchFilteredItems = categorizedItems.filter((item: any) => {
    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase();
    const name = (item.itemName || '').toLowerCase();
    const code = (item.itemCode || '').toLowerCase();
    const matches = name.includes(query) || code.includes(query);

    // Debug search
    if (searchQuery && matches) {
    }

    return matches;
  });


  // Then apply status filter
  let filteredItems = searchFilteredItems;
  if (filterStatus !== "all") {
    filteredItems = searchFilteredItems.filter((item: any) => item.status === filterStatus);
  }

  // Sort: out of stock first, then low stock, then ok
  filteredItems.sort((a: any, b: any) => {
    const statusOrder = { out: 0, low: 1, ok: 2 };
    return statusOrder[a.status] - statusOrder[b.status];
  });

  const isLoading = inventoryLoading;

  const getStatusColor = (status: "out" | "low" | "ok") => {
    switch (status) {
      case "out":
        return {
          bg: "bg-red-50",
          border: "border-red-200",
          text: "text-red-700",
          icon: "text-red-500",
          badge: "bg-red-100 text-red-700",
        };
      case "low":
        return {
          bg: "bg-yellow-50",
          border: "border-yellow-200",
          text: "text-yellow-700",
          icon: "text-yellow-500",
          badge: "bg-yellow-100 text-yellow-700",
        };
      case "ok":
        return {
          bg: "bg-green-50",
          border: "border-green-200",
          text: "text-green-700",
          icon: "text-green-500",
          badge: "bg-green-100 text-green-700",
        };
    }
  };

  const getStatusIcon = (status: "out" | "low" | "ok") => {
    const colors = getStatusColor(status);
    switch (status) {
      case "out":
        return <XCircle className={`h-5 w-5 ${colors.icon}`} />;
      case "low":
        return <AlertTriangle className={`h-5 w-5 ${colors.icon}`} />;
      case "ok":
        return <CheckCircle className={`h-5 w-5 ${colors.icon}`} />;
    }
  };

  const getStatusLabel = (status: "out" | "low" | "ok") => {
    switch (status) {
      case "out":
        return "Out of Stock";
      case "low":
        return "Low Stock";
      case "ok":
        return "In Stock";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-6 overflow-x-hidden">
      <MobileHeader
        title="Stock Levels"
        showBack
        backHref="/mobile/reports"
        subtitle={vanData?.vanWarehouse?.name}
      />

      <div className="px-3 py-4 space-y-3 max-w-full">
        {/* Summary Overview Card */}
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Box className="h-4 w-4" />
                <span className="font-semibold text-sm">Inventory Overview</span>
              </div>
              <Package className="h-5 w-5 opacity-70" />
            </div>
            <div className="grid grid-cols-4 gap-1.5 text-center">
              <div className="min-w-0">
                <div className="text-xl sm:text-2xl font-bold truncate">{summary.totalItems}</div>
                <div className="text-[10px] sm:text-xs opacity-90 mt-0.5">Total</div>
              </div>
              <div className="min-w-0">
                <div className="text-xl sm:text-2xl font-bold text-green-200 truncate">{summary.itemsInStock}</div>
                <div className="text-[10px] sm:text-xs opacity-90 mt-0.5">In Stock</div>
              </div>
              <div className="min-w-0">
                <div className="text-xl sm:text-2xl font-bold text-yellow-200 truncate">{summary.lowStockItems}</div>
                <div className="text-[10px] sm:text-xs opacity-90 mt-0.5">Low</div>
              </div>
              <div className="min-w-0">
                <div className="text-xl sm:text-2xl font-bold text-red-200 truncate">{summary.outOfStockItems}</div>
                <div className="text-[10px] sm:text-xs opacity-90 mt-0.5">Out</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search Bar */}
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 text-sm w-full"
          />
        </div>

        {/* Filter Chips */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-3 px-3" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <button
            onClick={() => setFilterStatus("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${
              filterStatus === "all"
                ? "bg-blue-600 text-white shadow-md"
                : "bg-white text-gray-700 border border-gray-300"
            }`}
          >
            All ({searchFilteredItems.length})
          </button>
          <button
            onClick={() => setFilterStatus("out")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1 flex-shrink-0 ${
              filterStatus === "out"
                ? "bg-red-600 text-white shadow-md"
                : "bg-white text-gray-700 border border-gray-300"
            }`}
          >
            <XCircle className="h-3 w-3" />
            Out ({searchFilteredItems.filter(i => i.status === "out").length})
          </button>
          <button
            onClick={() => setFilterStatus("low")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1 flex-shrink-0 ${
              filterStatus === "low"
                ? "bg-yellow-500 text-white shadow-md"
                : "bg-white text-gray-700 border border-gray-300"
            }`}
          >
            <AlertTriangle className="h-3 w-3" />
            Low ({searchFilteredItems.filter(i => i.status === "low").length})
          </button>
          <button
            onClick={() => setFilterStatus("ok")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1 flex-shrink-0 ${
              filterStatus === "ok"
                ? "bg-green-600 text-white shadow-md"
                : "bg-white text-gray-700 border border-gray-300"
            }`}
          >
            <CheckCircle className="h-3 w-3" />
            Good ({searchFilteredItems.filter(i => i.status === "ok").length})
          </button>
        </div>

        {/* Stock Items List */}
        <div className="space-y-3">
          {isLoading ? (
            <>
              {[1, 2, 3, 4, 5].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-5 w-48 mb-2" />
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </>
          ) : filteredItems.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">
                  {searchQuery ? "No items found matching your search" : "No items in this category"}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredItems.map((item: any) => {
              const colors = getStatusColor(item.status);
              const stockPercentage = item.reorderPoint > 0
                ? Math.min((item.currentStock / item.reorderPoint) * 100, 100)
                : 100;

              return (
                <Card key={item.itemId} className={`overflow-hidden border-l-4 ${colors.border} hover:shadow-lg transition-all max-w-full`}>
                  <CardContent className="p-0">
                    {/* Header Section with Status */}
                    <div className={`p-3 ${colors.bg}`}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-base text-gray-900 leading-tight mb-1 break-words">
                            {item.itemName}
                          </h3>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-gray-600 font-mono bg-white px-1.5 py-0.5 rounded">
                              {item.itemCode}
                            </span>
                            {item.categoryName && (
                              <span className="text-[10px] text-gray-500 bg-white px-1.5 py-0.5 rounded truncate max-w-[120px]">
                                {item.categoryName}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                          {getStatusIcon(item.status)}
                          <span className={`text-[10px] font-semibold ${colors.text} whitespace-nowrap`}>
                            {getStatusLabel(item.status)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Stock Level Visual Indicator */}
                    <div className="px-3 pt-2.5 pb-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-medium text-gray-600">Stock Level</span>
                        <span className="text-[10px] font-semibold text-gray-700">
                          {item.currentStock.toFixed(2)} / {item.reorderPoint.toFixed(2)}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            item.status === "out" ? "bg-red-500" :
                            item.status === "low" ? "bg-yellow-500" :
                            "bg-green-500"
                          }`}
                          style={{ width: `${stockPercentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Info Grid */}
                    <div className="px-3 pb-3 grid grid-cols-2 gap-2">
                      {/* Unit Price */}
                      <div className="flex items-center gap-1.5 bg-gray-50 p-2 rounded-lg min-w-0">
                        <DollarSign className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] text-gray-600">Unit Price</div>
                          <div className="text-xs font-bold text-gray-900 truncate">
                            ₱{item.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>

                      {/* Stock Value */}
                      <div className="flex items-center gap-1.5 bg-gradient-to-br from-blue-50 to-blue-100 p-2 rounded-lg min-w-0">
                        <Package className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] text-gray-600">Total Value</div>
                          <div className="text-xs font-bold text-blue-900 truncate">
                            ₱{(item.currentStock * item.unitPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Results Count */}
        {!isLoading && filteredItems.length > 0 && (
          <div className="text-center text-sm text-gray-500">
            Showing {filteredItems.length} items
          </div>
        )}
      </div>
    </div>
  );
}
