"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { useItem } from "@/hooks/useItems";
import type { ItemLocation } from "@/types/inventory-location";
import type { WarehouseLocation } from "@/types/inventory-location";

type ItemLocationsResponse = {
  data: ItemLocation[];
};

type LocationsTabProps = {
  itemId: string;
};

const formatQty = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 4 });

export const LocationsTab = ({ itemId }: LocationsTabProps) => {
  const queryClient = useQueryClient();
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");
  const [fromLocationId, setFromLocationId] = useState<string>("");
  const [toLocationId, setToLocationId] = useState<string>("");
  const [moveQty, setMoveQty] = useState<string>("");
  const { data, isLoading, error } = useQuery<ItemLocationsResponse>({
    queryKey: ["item-locations", itemId],
    queryFn: async () => apiClient.get<ItemLocationsResponse>(`/api/items/${itemId}/locations`),
  });
  const { data: itemResponse } = useItem(itemId);
  const item = itemResponse?.data;

  const locations = data?.data || [];
  const warehouses = useMemo(() => {
    const map = new Map<string, { id: string; code: string; name: string }>();
    locations.forEach((loc) => {
      if (!map.has(loc.warehouseId)) {
        map.set(loc.warehouseId, {
          id: loc.warehouseId,
          code: loc.warehouseCode,
          name: loc.warehouseName,
        });
      }
    });
    return Array.from(map.values());
  }, [locations]);

  const fromLocations = useMemo(
    () => locations.filter((loc) => loc.warehouseId === selectedWarehouseId),
    [locations, selectedWarehouseId]
  );

  const { data: warehouseLocations } = useQuery<{ data: WarehouseLocation[] }>({
    queryKey: ["warehouse-locations", selectedWarehouseId],
    queryFn: () => apiClient.get(`/api/warehouses/${selectedWarehouseId}/locations`),
    enabled: !!selectedWarehouseId,
  });

  const toLocations = useMemo(
    () => (warehouseLocations?.data || []).filter((loc) => loc.isActive),
    [warehouseLocations]
  );

  const setDefaultLocation = useMutation({
    mutationFn: async (location: ItemLocation) =>
      apiClient.patch(`/api/items/${itemId}/default-location`, {
        warehouseId: location.warehouseId,
        locationId: location.locationId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item-locations", itemId] });
      toast.success("Default location updated");
    },
    onError: (mutationError) => {
      const message = mutationError instanceof Error ? mutationError.message : "Failed to update default location";
      toast.error(message);
    },
  });

  const moveStock = useMutation({
    mutationFn: async () => {
      const quantity = Number(moveQty);
      if (!selectedWarehouseId || !fromLocationId || !toLocationId) {
        throw new Error("Select warehouse and locations to move stock.");
      }
      if (fromLocationId === toLocationId) {
        throw new Error("Select two different locations.");
      }
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error("Enter a valid quantity to move.");
      }

      return apiClient.post("/api/stock-transactions", {
        transactionType: "transfer",
        warehouseId: selectedWarehouseId,
        toWarehouseId: selectedWarehouseId,
        fromLocationId,
        toLocationId,
        transactionDate: new Date().toISOString().split("T")[0],
        items: [
          {
            itemId,
            quantity,
            unitCost: item?.standardCost ?? 0,
          },
        ],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item-locations", itemId] });
      toast.success("Stock moved successfully");
      setMoveDialogOpen(false);
      setSelectedWarehouseId("");
      setFromLocationId("");
      setToLocationId("");
      setMoveQty("");
    },
    onError: (mutationError) => {
      const message = mutationError instanceof Error ? mutationError.message : "Failed to move stock";
      toast.error(message);
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Locations</CardTitle>
            <CardDescription>Stock by warehouse location</CardDescription>
          </div>
          <Button onClick={() => setMoveDialogOpen(true)} disabled={locations.length === 0}>
            Move Stock
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="text-sm text-destructive">Failed to load item locations.</div>
        ) : locations.length === 0 ? (
          <div className="text-sm text-muted-foreground">No location stock found.</div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">On Hand</TableHead>
                  <TableHead className="text-right">Reserved</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map((location) => (
                  <TableRow key={location.id}>
                    <TableCell>
                      <div className="text-sm font-medium">{location.warehouseCode}</div>
                      <div className="text-xs text-muted-foreground">{location.warehouseName}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm font-medium">
                        {location.locationCode}
                        {location.isDefault && (
                          <Badge variant="secondary" className="text-xs">
                            Default
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{location.locationName}</div>
                    </TableCell>
                    <TableCell className="text-sm capitalize">{location.locationType}</TableCell>
                    <TableCell className="text-right">{formatQty(location.qtyOnHand)}</TableCell>
                    <TableCell className="text-right">{formatQty(location.qtyReserved)}</TableCell>
                    <TableCell className="text-right">{formatQty(location.qtyAvailable)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={location.isDefault || setDefaultLocation.isPending}
                        onClick={() => setDefaultLocation.mutate(location)}
                      >
                        Set Default
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      <Dialog
        open={moveDialogOpen}
        onOpenChange={(open) => {
          setMoveDialogOpen(open);
          if (!open) {
            setSelectedWarehouseId("");
            setFromLocationId("");
            setToLocationId("");
            setMoveQty("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move Stock</DialogTitle>
            <DialogDescription>
              Transfer stock between locations in the same warehouse.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Warehouse</label>
              <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.code} - {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">From Location</label>
              <Select value={fromLocationId} onValueChange={setFromLocationId} disabled={!selectedWarehouseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source location" />
                </SelectTrigger>
                <SelectContent>
                  {fromLocations.map((loc) => (
                    <SelectItem key={loc.locationId} value={loc.locationId}>
                      {loc.locationCode} - {loc.locationName} (Avail {formatQty(loc.qtyAvailable)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">To Location</label>
              <Select value={toLocationId} onValueChange={setToLocationId} disabled={!selectedWarehouseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select destination location" />
                </SelectTrigger>
                <SelectContent>
                  {toLocations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.code} - {loc.name || "Unnamed"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Quantity</label>
              <Input
                type="number"
                min="0"
                step="0.0001"
                value={moveQty}
                onChange={(event) => setMoveQty(event.target.value)}
                placeholder="Enter quantity to move"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => moveStock.mutate()} disabled={moveStock.isPending}>
              {moveStock.isPending ? "Moving..." : "Move Stock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
