"use client";

import { useState } from "react";
import { MobileHeader } from "@/components/mobile/MobileHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useUserVanWarehouse } from "@/hooks/useVanWarehouse";
import { useVanInventory } from "@/hooks/useVanInventory";
import {
  Search,
  AlertCircle,
  Package,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Box,
  DollarSign,
} from "lucide-react";

type InventorySummary = {
  totalItems: number;
  itemsInStock: number;
  lowStockItems: number;
  outOfStockItems: number;
};

type InventoryItem = {
  itemId: string;
  itemCode?: string;
  itemName?: string;
  categoryName?: string;
  uomName?: string;
  currentStock: number;
  reorderPoint: number;
  unitPrice: number;
};

type InventoryItemWithStatus = InventoryItem & {
  status: "out" | "low" | "ok";
};

export default function StockLevelsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "low" | "out" | "ok">("all");

  const { data: vanData, isLoading: vanLoading } = useUserVanWarehouse();
  const { data: inventoryData, isLoading: inventoryLoading } = useVanInventory(
    vanData?.vanWarehouseId
  );

  if (vanLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <MobileHeader title="Stock Levels" showBack backHref="/mobile/reports" />
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
        <MobileHeader title="Stock Levels" showBack backHref="/mobile/reports" />
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
  const inventory =
    (inventoryData?.data?.inventory as InventoryItem[] | undefined) ||
    (inventoryData?.inventory as InventoryItem[] | undefined) ||
    [];
  const summary = (inventoryData?.data?.summary as InventorySummary | undefined) ||
    (inventoryData?.summary as InventorySummary | undefined) || {
      totalItems: 0,
      itemsInStock: 0,
      lowStockItems: 0,
      outOfStockItems: 0,
    };

  // Categorize items by stock status
  const categorizedItems: InventoryItemWithStatus[] = inventory.map((item) => {
    let status: "out" | "low" | "ok" = "ok";
    if (item.currentStock === 0) {
      status = "out";
    } else if (item.currentStock <= item.reorderPoint) {
      status = "low";
    }
    return { ...item, status };
  });

  // Filter items by search query first
  const searchFilteredItems = categorizedItems.filter((item) => {
    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase();
    const name = (item.itemName || "").toLowerCase();
    const code = (item.itemCode || "").toLowerCase();
    const matches = name.includes(query) || code.includes(query);

    // Debug search
    if (searchQuery && matches) {
    }

    return matches;
  });

  // Then apply status filter
  let filteredItems = searchFilteredItems;
  if (filterStatus !== "all") {
    filteredItems = searchFilteredItems.filter((item) => item.status === filterStatus);
  }

  // Sort: out of stock first, then low stock, then ok
  filteredItems.sort((a, b) => {
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
    <div className="min-h-screen overflow-x-hidden bg-gray-50 pb-6">
      <MobileHeader
        title="Stock Levels"
        showBack
        backHref="/mobile/reports"
        subtitle={vanData?.vanWarehouse?.name}
      />

      <div className="max-w-full space-y-3 px-3 py-4">
        {/* Summary Overview Card */}
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg">
          <CardContent className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Box className="h-4 w-4" />
                <span className="text-sm font-semibold">Inventory Overview</span>
              </div>
              <Package className="h-5 w-5 opacity-70" />
            </div>
            <div className="grid grid-cols-4 gap-1.5 text-center">
              <div className="min-w-0">
                <div className="truncate text-xl font-bold sm:text-2xl">{summary.totalItems}</div>
                <div className="mt-0.5 text-[10px] opacity-90 sm:text-xs">Total</div>
              </div>
              <div className="min-w-0">
                <div className="truncate text-xl font-bold text-green-200 sm:text-2xl">
                  {summary.itemsInStock}
                </div>
                <div className="mt-0.5 text-[10px] opacity-90 sm:text-xs">In Stock</div>
              </div>
              <div className="min-w-0">
                <div className="truncate text-xl font-bold text-yellow-200 sm:text-2xl">
                  {summary.lowStockItems}
                </div>
                <div className="mt-0.5 text-[10px] opacity-90 sm:text-xs">Low</div>
              </div>
              <div className="min-w-0">
                <div className="truncate text-xl font-bold text-red-200 sm:text-2xl">
                  {summary.outOfStockItems}
                </div>
                <div className="mt-0.5 text-[10px] opacity-90 sm:text-xs">Out</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search Bar */}
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 w-full pl-9 text-sm"
          />
        </div>

        {/* Filter Chips */}
        <div
          className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-2"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          <button
            onClick={() => setFilterStatus("all")}
            className={`flex-shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              filterStatus === "all"
                ? "bg-blue-600 text-white shadow-md"
                : "border border-gray-300 bg-white text-gray-700"
            }`}
          >
            All ({searchFilteredItems.length})
          </button>
          <button
            onClick={() => setFilterStatus("out")}
            className={`flex flex-shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              filterStatus === "out"
                ? "bg-red-600 text-white shadow-md"
                : "border border-gray-300 bg-white text-gray-700"
            }`}
          >
            <XCircle className="h-3 w-3" />
            Out ({searchFilteredItems.filter((i) => i.status === "out").length})
          </button>
          <button
            onClick={() => setFilterStatus("low")}
            className={`flex flex-shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              filterStatus === "low"
                ? "bg-yellow-500 text-white shadow-md"
                : "border border-gray-300 bg-white text-gray-700"
            }`}
          >
            <AlertTriangle className="h-3 w-3" />
            Low ({searchFilteredItems.filter((i) => i.status === "low").length})
          </button>
          <button
            onClick={() => setFilterStatus("ok")}
            className={`flex flex-shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              filterStatus === "ok"
                ? "bg-green-600 text-white shadow-md"
                : "border border-gray-300 bg-white text-gray-700"
            }`}
          >
            <CheckCircle className="h-3 w-3" />
            Good ({searchFilteredItems.filter((i) => i.status === "ok").length})
          </button>
        </div>

        {/* Stock Items List */}
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
          ) : filteredItems.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="mx-auto mb-3 h-12 w-12 text-gray-300" />
                <p className="text-gray-500">
                  {searchQuery
                    ? "No items found matching your search"
                    : "No items in this category"}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredItems.map((item) => {
              const colors = getStatusColor(item.status);
              const stockPercentage =
                item.reorderPoint > 0
                  ? Math.min((item.currentStock / item.reorderPoint) * 100, 100)
                  : 100;

              return (
                <Card
                  key={item.itemId}
                  className={`overflow-hidden border-l-4 ${colors.border} max-w-full transition-all hover:shadow-lg`}
                >
                  <CardContent className="p-0">
                    {/* Header Section with Status */}
                    <div className={`p-3 ${colors.bg}`}>
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="mb-1 break-words text-base font-bold leading-tight text-gray-900">
                            {item.itemName}
                          </h3>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-gray-600">
                              {item.itemCode}
                            </span>
                            {item.categoryName && (
                              <span className="max-w-[120px] truncate rounded bg-white px-1.5 py-0.5 text-[10px] text-gray-500">
                                {item.categoryName}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-shrink-0 flex-col items-end gap-0.5">
                          {getStatusIcon(item.status)}
                          <span
                            className={`text-[10px] font-semibold ${colors.text} whitespace-nowrap`}
                          >
                            {getStatusLabel(item.status)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Stock Level Visual Indicator */}
                    <div className="px-3 pb-2 pt-2.5">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-[10px] font-medium text-gray-600">Stock Level</span>
                        <span className="text-[10px] font-semibold text-gray-700">
                          {item.currentStock.toFixed(2)} / {item.reorderPoint.toFixed(2)}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                        <div
                          className={`h-full transition-all ${
                            item.status === "out"
                              ? "bg-red-500"
                              : item.status === "low"
                                ? "bg-yellow-500"
                                : "bg-green-500"
                          }`}
                          style={{ width: `${stockPercentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Info Grid */}
                    <div className="grid grid-cols-2 gap-2 px-3 pb-3">
                      {/* Unit Price */}
                      <div className="flex min-w-0 items-center gap-1.5 rounded-lg bg-gray-50 p-2">
                        <DollarSign className="h-3.5 w-3.5 flex-shrink-0 text-green-600" />
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] text-gray-600">Unit Price</div>
                          <div className="truncate text-xs font-bold text-gray-900">
                            ₱
                            {item.unitPrice.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Stock Value */}
                      <div className="flex min-w-0 items-center gap-1.5 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 p-2">
                        <Package className="h-3.5 w-3.5 flex-shrink-0 text-blue-600" />
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] text-gray-600">Total Value</div>
                          <div className="truncate text-xs font-bold text-blue-900">
                            ₱
                            {(item.currentStock * item.unitPrice).toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
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
