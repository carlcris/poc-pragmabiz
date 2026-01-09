"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Plus, ArrowLeft, Pencil } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import { ProtectedRoute } from "@/components/permissions/ProtectedRoute";
import { RESOURCES } from "@/constants/resources";
import type { WarehouseLocation } from "@/types/inventory-location";

type WarehouseLocationsResponse = {
  data: WarehouseLocation[];
};

const locationTypes = ["zone", "aisle", "rack", "shelf", "bin", "crate"];

export default function WarehouseLocationsPage() {
  const params = useParams();
  const router = useRouter();
  const warehouseId = params.id as string;
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<WarehouseLocation | null>(null);
  const [formState, setFormState] = useState({
    code: "",
    name: "",
    locationType: "bin",
    isPickable: true,
    isStorable: true,
    isActive: true,
  });

  const { data, isLoading, error } = useQuery<WarehouseLocationsResponse>({
    queryKey: ["warehouse-locations", warehouseId],
    queryFn: () => apiClient.get(`/api/warehouses/${warehouseId}/locations`),
  });

  const locations = useMemo(() => data?.data || [], [data]);

  const createLocation = useMutation({
    mutationFn: () =>
      apiClient.post(`/api/warehouses/${warehouseId}/locations`, {
        code: formState.code,
        name: formState.name,
        locationType: formState.locationType,
        isPickable: formState.isPickable,
        isStorable: formState.isStorable,
        isActive: formState.isActive,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-locations", warehouseId] });
      toast.success("Location created successfully");
      setDialogOpen(false);
      setFormState({
        code: "",
        name: "",
        locationType: "bin",
        isPickable: true,
        isStorable: true,
        isActive: true,
      });
    },
    onError: (mutationError) => {
      const message = mutationError instanceof Error ? mutationError.message : "Failed to create location";
      toast.error(message);
    },
  });

  const updateLocation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: typeof formState }) =>
      apiClient.patch(`/api/warehouse-locations/${id}`, {
        code: payload.code,
        name: payload.name,
        locationType: payload.locationType,
        isPickable: payload.isPickable,
        isStorable: payload.isStorable,
        isActive: payload.isActive,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-locations", warehouseId] });
      toast.success("Location updated");
      setDialogOpen(false);
      setEditingLocation(null);
      setFormState({
        code: "",
        name: "",
        locationType: "bin",
        isPickable: true,
        isStorable: true,
        isActive: true,
      });
    },
    onError: (mutationError) => {
      const message = mutationError instanceof Error ? mutationError.message : "Failed to update location";
      toast.error(message);
    },
  });

  const toggleLocation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiClient.patch(`/api/warehouse-locations/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-locations", warehouseId] });
      toast.success("Location updated");
    },
    onError: (mutationError) => {
      const message = mutationError instanceof Error ? mutationError.message : "Failed to update location";
      toast.error(message);
    },
  });

  const handleSubmit = () => {
    if (!formState.code.trim()) {
      toast.error("Location code is required");
      return;
    }

    if (editingLocation) {
      updateLocation.mutate({ id: editingLocation.id, payload: formState });
      return;
    }

    createLocation.mutate();
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingLocation(null);
      setFormState({
        code: "",
        name: "",
        locationType: "bin",
        isPickable: true,
        isStorable: true,
        isActive: true,
      });
    }
  };

  const handleEditLocation = (location: WarehouseLocation) => {
    setEditingLocation(location);
    setFormState({
      code: location.code || "",
      name: location.name || "",
      locationType: location.locationType || "bin",
      isPickable: Boolean(location.isPickable),
      isStorable: Boolean(location.isStorable),
      isActive: Boolean(location.isActive),
    });
    setDialogOpen(true);
  };

  return (
    <ProtectedRoute resource={RESOURCES.MANAGE_LOCATIONS}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Warehouse Locations</h1>
          <p className="text-muted-foreground">Manage bin and zone setup for this warehouse.</p>
        </div>
        <Button
          onClick={() => {
            setEditingLocation(null);
            setFormState({
              code: "",
              name: "",
              locationType: "bin",
              isPickable: true,
              isStorable: true,
              isActive: true,
            });
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Location
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Location List</CardTitle>
          <CardDescription>Active locations are available for stock movements.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              Failed to load warehouse locations.
            </div>
          ) : locations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No locations found.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Pickable</TableHead>
                    <TableHead>Storable</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locations.map((location) => (
                    <TableRow key={location.id}>
                      <TableCell className="font-medium">{location.code}</TableCell>
                      <TableCell>{location.name || "-"}</TableCell>
                      <TableCell className="capitalize">{location.locationType}</TableCell>
                      <TableCell>{location.isPickable ? "Yes" : "No"}</TableCell>
                      <TableCell>{location.isStorable ? "Yes" : "No"}</TableCell>
                      <TableCell>
                        <Badge variant={location.isActive ? "outline" : "secondary"}>
                          {location.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditLocation(location)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleLocation.mutate({ id: location.id, isActive: !location.isActive })}
                          >
                            {location.isActive ? "Disable" : "Enable"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLocation ? "Edit Location" : "Add Location"}</DialogTitle>
            <DialogDescription>
              {editingLocation
                ? "Update location details for this warehouse."
                : "Define a storage location within this warehouse."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="location-code">Code</Label>
              <Input
                id="location-code"
                placeholder="A1-BIN-01"
                value={formState.code}
                onChange={(event) => setFormState((prev) => ({ ...prev, code: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location-name">Name</Label>
              <Input
                id="location-name"
                placeholder="Main Bin"
                value={formState.name}
                onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Location Type</Label>
              <Select
                value={formState.locationType}
                onValueChange={(value) => setFormState((prev) => ({ ...prev, locationType: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {locationTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Pickable</Label>
                <p className="text-xs text-muted-foreground">Allow picking stock from this location.</p>
              </div>
              <Switch
                checked={formState.isPickable}
                onCheckedChange={(value) => setFormState((prev) => ({ ...prev, isPickable: value }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Storable</Label>
                <p className="text-xs text-muted-foreground">Allow storing stock in this location.</p>
              </div>
              <Switch
                checked={formState.isStorable}
                onCheckedChange={(value) => setFormState((prev) => ({ ...prev, isStorable: value }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Active</Label>
                <p className="text-xs text-muted-foreground">Inactive locations are hidden from selection.</p>
              </div>
              <Switch
                checked={formState.isActive}
                onCheckedChange={(value) => setFormState((prev) => ({ ...prev, isActive: value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createLocation.isPending || updateLocation.isPending}
            >
              {createLocation.isPending || updateLocation.isPending
                ? "Saving..."
                : editingLocation
                ? "Update Location"
                : "Create Location"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </ProtectedRoute>
  );
}
