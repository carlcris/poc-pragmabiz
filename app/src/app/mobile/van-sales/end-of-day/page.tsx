"use client";

import { useState } from "react";
import { MobileHeader } from "@/components/mobile/MobileHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MobileAlert } from "@/components/mobile/MobileAlert";
import { MobileConfirmDialog } from "@/components/mobile/MobileConfirmDialog";
import { useUserVanWarehouse } from "@/hooks/useVanWarehouse";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle,
  AlertCircle,
  Search,
  Minus,
  Plus,
  Save,
  Trash2,
  Package,
  ClipboardList,
} from "lucide-react";
import { format } from "date-fns";

interface InventoryItem {
  itemId: string;
  itemCode: string;
  itemName: string;
  currentStock: number;
  uomId: string;
  uomName: string;
  unitCost: number;
}

interface AdjustmentItem extends InventoryItem {
  countedQty: number;
}

export default function EndOfDayPage() {
  const { data: vanData, isLoading: vanLoading } = useUserVanWarehouse();
  const queryClient = useQueryClient();
  const [adjustmentItems, setAdjustmentItems] = useState<AdjustmentItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [alertState, setAlertState] = useState<{
    open: boolean;
    title: string;
    description: string;
    variant: "default" | "destructive" | "warning" | "success";
  }>({
    open: false,
    title: "",
    description: "",
    variant: "default",
  });

  const { data: inventoryData, isLoading: inventoryLoading } = useQuery({
    queryKey: ["van-inventory", vanData?.vanWarehouseId],
    queryFn: async () => {
      if (!vanData?.vanWarehouseId) return null;
      const response = await fetch(`/api/warehouses/${vanData.vanWarehouseId}/inventory`);
      if (!response.ok) throw new Error("Failed to fetch inventory");
      return response.json();
    },
    enabled: !!vanData?.vanWarehouseId,
  });

  const createAdjustmentMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/stock-adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create adjustment");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["van-inventory"] });
      setAlertState({
        open: true,
        title: "Success",
        description: "End-of-day count saved successfully!",
        variant: "success",
      });
      // Reset form
      setAdjustmentItems([]);
      setReason("");
      setNotes("");
      setSearchTerm("");
    },
    onError: (error: Error) => {
      setAlertState({
        open: true,
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const allInventory: InventoryItem[] = inventoryData?.data?.inventory || [];

  const filteredItems = searchTerm
    ? allInventory.filter(item => {
        const alreadyAdded = adjustmentItems.some(adj => adj.itemId === item.itemId);
        if (alreadyAdded) return false;

        const query = searchTerm.toLowerCase();
        return (
          item.itemName.toLowerCase().includes(query) ||
          item.itemCode.toLowerCase().includes(query)
        );
      })
    : [];

  const addItem = (item: InventoryItem) => {
    setAdjustmentItems([...adjustmentItems, {
      ...item,
      countedQty: item.currentStock,
    }]);
    setSearchTerm("");
  };

  const updateCount = (itemId: string, countedQty: number) => {
    setAdjustmentItems(adjustmentItems.map(item =>
      item.itemId === itemId ? { ...item, countedQty } : item
    ));
  };

  const removeItem = (itemId: string) => {
    setAdjustmentItems(adjustmentItems.filter(item => item.itemId !== itemId));
  };

  const handleSubmit = () => {
    if (!reason.trim()) {
      setAlertState({
        open: true,
        title: "Validation Error",
        description: "Please provide a reason for the adjustment",
        variant: "warning",
      });
      return;
    }

    if (adjustmentItems.length === 0) {
      setAlertState({
        open: true,
        title: "No Items",
        description: "Please add at least one item to count",
        variant: "warning",
      });
      return;
    }

    const itemsWithDifferences = adjustmentItems.filter(
      item => item.countedQty !== item.currentStock
    );

    if (itemsWithDifferences.length === 0) {
      setAlertState({
        open: true,
        title: "No Changes",
        description: "No adjustments needed. All counts match current stock.",
        variant: "warning",
      });
      return;
    }

    setShowConfirm(true);
  };

  const handleConfirmSubmit = () => {
    const itemsToSubmit = adjustmentItems
      .filter(item => item.countedQty !== item.currentStock)
      .map(item => ({
        itemId: item.itemId,
        currentQty: item.currentStock,
        adjustedQty: item.countedQty,
        unitCost: item.unitCost,
        uomId: item.uomId,
        reason: reason,
      }));

    createAdjustmentMutation.mutate({
      warehouseId: vanData?.vanWarehouseId,
      adjustmentType: "physical_count",
      adjustmentDate: format(new Date(), "yyyy-MM-dd"),
      reason: reason,
      notes: notes || null,
      items: itemsToSubmit,
    });
    setShowConfirm(false);
  };

  const differencesCount = adjustmentItems.filter(
    item => item.countedQty !== item.currentStock
  ).length;

  if (!vanLoading && !vanData?.vanWarehouseId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <MobileHeader title="End-of-Day Count" />
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
    <div className="min-h-screen bg-gray-50 pb-24">
      <MobileHeader
        title="End-of-Day Count"
        subtitle="Physical inventory count"
        vanName={vanData?.vanWarehouse?.name}
        driverName={vanData?.fullName}
      />

      <div className="p-4 space-y-4">
        {/* Item Search */}
        <Card>
          <CardContent className="pt-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>

        {/* Item List */}
        {inventoryLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Skeleton className="h-12 w-12 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-8 w-24" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredItems.length > 0 ? (
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <Card key={item.itemId} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => addItem(item)}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Package className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.itemName}</p>
                      <p className="text-xs text-gray-500">{item.itemCode}</p>
                      <p className="text-xs text-gray-600 mt-1">
                        Stock: {item.currentStock} {item.uomName}
                      </p>
                    </div>
                    <Plus className="h-5 w-5 text-primary flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}

        {/* Count List */}
        {adjustmentItems.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Count List ({adjustmentItems.length} items)</CardTitle>
                <ClipboardList className="h-5 w-5 text-gray-400" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {adjustmentItems.map((item) => {
                const difference = item.countedQty - item.currentStock;
                const hasDifference = difference !== 0;

                return (
                  <div
                    key={item.itemId}
                    className={`flex items-center gap-3 p-3 rounded-lg ${
                      hasDifference ? "bg-orange-50 border-2 border-orange-500" : "bg-gray-50"
                    }`}
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.itemName}</p>
                      <p className="text-xs text-gray-500">System: {item.currentStock} {item.uomName}</p>
                      {hasDifference && (
                        <p className={`text-xs font-semibold mt-1 ${
                          difference > 0 ? "text-green-600" : "text-red-600"
                        }`}>
                          {difference > 0 ? "+" : ""}{difference} {item.uomName}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => updateCount(item.itemId, Math.max(0, item.countedQty - 1))}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Input
                        type="number"
                        min="0"
                        value={item.countedQty}
                        onChange={(e) => updateCount(item.itemId, parseFloat(e.target.value) || 0)}
                        className="w-16 text-center font-bold h-8 p-0"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => updateCount(item.itemId, item.countedQty + 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-red-500"
                        onClick={() => removeItem(item.itemId)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}

              {/* Adjustment Details */}
              <div className="border-t pt-3 space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Reason <span className="text-red-500">*</span>
                  </label>
                  <Input
                    placeholder="e.g., End of day physical count"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Notes (Optional)
                  </label>
                  <Textarea
                    placeholder="Additional notes..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>

              {/* Summary */}
              <div className="border-t pt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Total Items</span>
                  <span className="font-semibold">{adjustmentItems.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>With Differences</span>
                  <span className="font-semibold text-orange-600">{differencesCount}</span>
                </div>
              </div>

              {/* Save Button */}
              <Button
                className="w-full"
                size="lg"
                onClick={handleSubmit}
                disabled={createAdjustmentMutation.isPending}
              >
                <Save className="h-5 w-5 mr-2" />
                {createAdjustmentMutation.isPending ? "Saving..." : "Save Count"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {adjustmentItems.length === 0 && filteredItems.length === 0 && !inventoryLoading && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-3">
                <CheckCircle className="h-16 w-16 mx-auto text-gray-300" />
                <h3 className="font-semibold text-lg text-gray-700">
                  {searchTerm ? "No Items Found" : "Search for Items"}
                </h3>
                <p className="text-sm text-gray-500">
                  {searchTerm ? "No items match your search" : "Use the search box above to find items to count"}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Confirm Dialog */}
      <MobileConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        title="Confirm Count"
        description={`Save end-of-day count with ${differencesCount} adjustment(s)?`}
        confirmText="Confirm"
        cancelText="Cancel"
        onConfirm={handleConfirmSubmit}
        variant="default"
        isLoading={createAdjustmentMutation.isPending}
      />

      {/* Alert */}
      <MobileAlert
        open={alertState.open}
        onOpenChange={(open) => setAlertState({ ...alertState, open })}
        title={alertState.title}
        description={alertState.description}
        variant={alertState.variant}
        duration={alertState.variant === "success" ? 5000 : 4000}
      />
    </div>
  );
}
