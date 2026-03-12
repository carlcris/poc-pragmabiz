"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Plus, Pencil, AlertCircle, MoreVertical, Ban, CheckCircle2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import { EmptyStatePanel } from "@/components/shared/EmptyStatePanel";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  const isPending = isLoading && !data;

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
      const message =
        mutationError instanceof Error ? mutationError.message : "Failed to create location";
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
      const message =
        mutationError instanceof Error ? mutationError.message : "Failed to update location";
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
      const message =
        mutationError instanceof Error ? mutationError.message : "Failed to update location";
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
        <PageHeader
          title="Warehouse Locations"
          subtitle="Manage bin and zone setup for this warehouse."
          actions={
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
              className="w-full sm:w-auto"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Location
            </Button>
          }
        />

        <Card>
          <CardHeader>
          </CardHeader>
          <CardContent>
            {error ? (
              <EmptyStatePanel
                icon={AlertCircle}
                title="Failed to load warehouse locations"
                description="Please refresh the page and try again."
                className="min-h-[240px]"
              />
            ) : locations.length === 0 && !isPending ? (
              <EmptyStatePanel
                icon={Plus}
                title="No locations yet"
                description="Create the first warehouse location to start organizing stock movement and storage."
                className="min-h-[240px]"
              />
            ) : (
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
                  {isPending
                    ? Array.from({ length: 8 }, (_, index) => `skeleton-${index}`).map((rowKey) => (
                        <TableRow key={rowKey}>
                          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-10" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-10" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Skeleton className="h-8 w-16" />
                              <Skeleton className="h-8 w-8" />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    : locations.map((location) => (
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
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    aria-label="Actions"
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() =>
                                      toggleLocation.mutate({
                                        id: location.id,
                                        isActive: !location.isActive,
                                      })
                                    }
                                    className={
                                      location.isActive
                                        ? "text-destructive focus:text-destructive"
                                        : undefined
                                    }
                                  >
                                    {location.isActive ? (
                                      <Ban className="h-4 w-4" />
                                    ) : (
                                      <CheckCircle2 className="h-4 w-4" />
                                    )}
                                    <span>{location.isActive ? "Disable" : "Enable"}</span>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                </TableBody>
              </Table>
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
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, code: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location-name">Name</Label>
                <Input
                  id="location-name"
                  placeholder="Main Bin"
                  value={formState.name}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, name: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Location Type</Label>
                <Select
                  value={formState.locationType}
                  onValueChange={(value) =>
                    setFormState((prev) => ({ ...prev, locationType: value }))
                  }
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
                  <p className="text-xs text-muted-foreground">
                    Allow picking stock from this location.
                  </p>
                </div>
                <Switch
                  checked={formState.isPickable}
                  onCheckedChange={(value) =>
                    setFormState((prev) => ({ ...prev, isPickable: value }))
                  }
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label>Storable</Label>
                  <p className="text-xs text-muted-foreground">
                    Allow storing stock in this location.
                  </p>
                </div>
                <Switch
                  checked={formState.isStorable}
                  onCheckedChange={(value) =>
                    setFormState((prev) => ({ ...prev, isStorable: value }))
                  }
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label>Active</Label>
                  <p className="text-xs text-muted-foreground">
                    Inactive locations are hidden from selection.
                  </p>
                </div>
                <Switch
                  checked={formState.isActive}
                  onCheckedChange={(value) =>
                    setFormState((prev) => ({ ...prev, isActive: value }))
                  }
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
