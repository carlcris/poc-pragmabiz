"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { Plus, Pencil, AlertCircle, MoreVertical, Ban, CheckCircle2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, getApiErrorCode } from "@/lib/api";
import { toast } from "sonner";
import { EmptyStatePanel } from "@/components/shared/EmptyStatePanel";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusText } from "@/components/shared/StatusText";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

const locationTypes = ["zone", "aisle", "rack", "shelf", "bin", "crate"];
const locationMutationErrorCodes = [
  "INVALID_LOCATION",
  "LOCATION_CODE_EXISTS",
  "CAPACITY_REQUIRES_STORABLE_LOCATION",
  "WAREHOUSE_LOCATION_NOT_FOUND",
  "WAREHOUSE_NOT_FOUND",
] as const;

const capacityTone = (status: WarehouseLocation["capacityStatus"]) => {
  switch (status) {
    case "empty":
      return "muted" as const;
    case "partial":
      return "blue" as const;
    case "full":
      return "amber" as const;
    case "over_capacity":
      return "red" as const;
    default:
      return "muted" as const;
  }
};

export default function WarehouseLocationsPage() {
  const t = useTranslations("warehouseLocationsPage");
  const format = useFormatter();
  const params = useParams();
  const warehouseId = params.id as string;
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<WarehouseLocation | null>(null);
  const [formState, setFormState] = useState({
    code: "",
    name: "",
    locationType: "bin",
    isPickable: true,
    isStorable: true,
    isActive: true,
    maxCapacity: "",
  });

  const { data, isLoading, error } = useQuery<WarehouseLocationsResponse>({
    queryKey: ["warehouse-locations", warehouseId, page, pageSize],
    queryFn: () =>
      apiClient.get(`/api/warehouses/${warehouseId}/locations?page=${page}&limit=${pageSize}`),
  });

  const locations = useMemo(() => data?.data || [], [data]);
  const isPending = isLoading && !data;
  const capacityStatusLabel = (status: WarehouseLocation["capacityStatus"]) => {
    switch (status) {
      case "empty":
        return t("capacityEmpty");
      case "partial":
        return t("capacityPartial");
      case "full":
        return t("capacityFull");
      case "over_capacity":
        return t("capacityOver");
      case "not_storable":
        return t("capacityNotStorable");
      default:
        return t("capacityNotConfigured");
    }
  };
  const mutationErrorMessage = (error: unknown, fallback: string) => {
    const code = getApiErrorCode(error, locationMutationErrorCodes);
    switch (code) {
      case "INVALID_LOCATION":
        return t("invalidLocation");
      case "LOCATION_CODE_EXISTS":
        return t("codeExists");
      case "CAPACITY_REQUIRES_STORABLE_LOCATION":
        return t("capacityRequiresStorable");
      case "WAREHOUSE_LOCATION_NOT_FOUND":
      case "WAREHOUSE_NOT_FOUND":
        return t("locationNotFound");
      default:
        return fallback;
    }
  };

  const createLocation = useMutation({
    mutationFn: () =>
      apiClient.post(`/api/warehouses/${warehouseId}/locations`, {
        code: formState.code,
        name: formState.name,
        locationType: formState.locationType,
        isPickable: formState.isPickable,
        isStorable: formState.isStorable,
        isActive: formState.isActive,
        maxCapacity:
          formState.isStorable && formState.maxCapacity
            ? Number(formState.maxCapacity)
            : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-locations", warehouseId] });
      queryClient.invalidateQueries({ queryKey: ["purchasing-dashboard", "warehouseCapacity"] });
      toast.success(t("createdSuccess"));
      setDialogOpen(false);
      setFormState({
        code: "",
        name: "",
        locationType: "bin",
        isPickable: true,
        isStorable: true,
        isActive: true,
        maxCapacity: "",
      });
    },
    onError: (mutationError) => {
      toast.error(mutationErrorMessage(mutationError, t("createError")));
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
        maxCapacity:
          payload.isStorable && payload.maxCapacity ? Number(payload.maxCapacity) : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-locations", warehouseId] });
      queryClient.invalidateQueries({ queryKey: ["purchasing-dashboard", "warehouseCapacity"] });
      toast.success(t("updatedSuccess"));
      setDialogOpen(false);
      setEditingLocation(null);
      setFormState({
        code: "",
        name: "",
        locationType: "bin",
        isPickable: true,
        isStorable: true,
        isActive: true,
        maxCapacity: "",
      });
    },
    onError: (mutationError) => {
      toast.error(mutationErrorMessage(mutationError, t("updateError")));
    },
  });

  const toggleLocation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiClient.patch(`/api/warehouse-locations/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-locations", warehouseId] });
      queryClient.invalidateQueries({ queryKey: ["purchasing-dashboard", "warehouseCapacity"] });
      toast.success(t("updatedSuccess"));
    },
    onError: (mutationError) => {
      toast.error(mutationErrorMessage(mutationError, t("updateError")));
    },
  });

  const handleSubmit = () => {
    if (!formState.code.trim()) {
      toast.error(t("codeRequired"));
      return;
    }
    if (
      formState.isStorable &&
      formState.maxCapacity &&
      (!Number.isFinite(Number(formState.maxCapacity)) || Number(formState.maxCapacity) <= 0)
    ) {
      toast.error(t("capacityPositive"));
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
        maxCapacity: "",
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
      maxCapacity: location.maxCapacity == null ? "" : String(location.maxCapacity),
    });
    setDialogOpen(true);
  };

  return (
    <ProtectedRoute resource={RESOURCES.MANAGE_LOCATIONS}>
      <div className="space-y-6">
        <PageHeader
          title={t("title")}
          subtitle={t("subtitle")}
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
                  maxCapacity: "",
                });
                setDialogOpen(true);
              }}
              className="w-full sm:w-auto"
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("addLocation")}
            </Button>
          }
        />

        <Card>
          <CardHeader></CardHeader>
          <CardContent>
            {error ? (
              <EmptyStatePanel
                icon={AlertCircle}
                title={t("loadErrorTitle")}
                description={t("loadErrorDescription")}
                className="min-h-60"
              />
            ) : locations.length === 0 && !isPending ? (
              <EmptyStatePanel
                icon={Plus}
                title={t("emptyTitle")}
                description={t("emptyDescription")}
                className="min-h-60"
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("code")}</TableHead>
                    <TableHead>{t("name")}</TableHead>
                    <TableHead>{t("type")}</TableHead>
                    <TableHead>{t("pickable")}</TableHead>
                    <TableHead>{t("storable")}</TableHead>
                    <TableHead>{t("capacity")}</TableHead>
                    <TableHead>{t("occupancy")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                    <TableHead className="text-right">{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isPending
                    ? Array.from({ length: 8 }, (_, index) => `skeleton-${index}`).map((rowKey) => (
                        <TableRow key={rowKey}>
                          <TableCell>
                            <Skeleton className="h-4 w-20" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-36" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-20" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-10" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-10" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-6 w-16 rounded-full" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-20" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-20" />
                          </TableCell>
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
                          <TableCell>{location.isPickable ? t("yes") : t("no")}</TableCell>
                          <TableCell>{location.isStorable ? t("yes") : t("no")}</TableCell>
                          <TableCell className="tabular-nums">
                            {location.isStorable && location.maxCapacity != null
                              ? `${format.number(location.usedCapacity ?? 0, { maximumFractionDigits: 2 })} / ${format.number(location.maxCapacity, { maximumFractionDigits: 2 })}`
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <StatusText tone={capacityTone(location.capacityStatus)}>
                              {location.maxCapacity != null
                                ? `${capacityStatusLabel(location.capacityStatus)} · ${format.number(location.utilizationPercent ?? 0, { maximumFractionDigits: 1 })}%`
                                : capacityStatusLabel(location.capacityStatus)}
                            </StatusText>
                          </TableCell>
                          <TableCell>
                            <StatusText tone={location.isActive ? "green" : "muted"}>
                              {location.isActive ? t("active") : t("inactive")}
                            </StatusText>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditLocation(location)}
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                {t("edit")}
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    aria-label={t("actions")}
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
                                    <span>{location.isActive ? t("disable") : t("enable")}</span>
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

        {!isPending && locations.length > 0 && data?.pagination ? (
          <DataTablePagination
            currentPage={page}
            totalPages={data.pagination.totalPages}
            pageSize={pageSize}
            totalItems={data.pagination.total}
            onPageChange={setPage}
            onPageSizeChange={(nextPageSize) => {
              setPage(1);
              setPageSize(nextPageSize);
            }}
          />
        ) : null}

        <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingLocation ? t("editTitle") : t("addTitle")}</DialogTitle>
              <DialogDescription>
                {editingLocation ? t("editDescription") : t("addDescription")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="location-code">{t("code")}</Label>
                <Input
                  id="location-code"
                  placeholder={t("codePlaceholder")}
                  value={formState.code}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, code: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location-name">{t("name")}</Label>
                <Input
                  id="location-name"
                  placeholder={t("namePlaceholder")}
                  value={formState.name}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, name: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t("locationType")}</Label>
                <Select
                  value={formState.locationType}
                  onValueChange={(value) =>
                    setFormState((prev) => ({ ...prev, locationType: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectType")} />
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
              {formState.isStorable ? (
                <div className="space-y-2">
                  <Label htmlFor="location-max-capacity">{t("maxCapacity")}</Label>
                  <Input
                    id="location-max-capacity"
                    type="number"
                    min="0.01"
                    step="0.01"
                    inputMode="decimal"
                    placeholder={t("maxCapacityPlaceholder")}
                    value={formState.maxCapacity}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, maxCapacity: event.target.value }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">{t("maxCapacityHelp")}</p>
                </div>
              ) : null}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label>{t("pickable")}</Label>
                  <p className="text-xs text-muted-foreground">{t("pickableHelp")}</p>
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
                  <Label>{t("storable")}</Label>
                  <p className="text-xs text-muted-foreground">{t("storableHelp")}</p>
                </div>
                <Switch
                  checked={formState.isStorable}
                  onCheckedChange={(value) =>
                    setFormState((prev) => ({
                      ...prev,
                      isStorable: value,
                      maxCapacity: value ? prev.maxCapacity : "",
                    }))
                  }
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label>{t("active")}</Label>
                  <p className="text-xs text-muted-foreground">{t("activeHelp")}</p>
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
                {t("cancel")}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createLocation.isPending || updateLocation.isPending}
              >
                {createLocation.isPending || updateLocation.isPending
                  ? t("saving")
                  : editingLocation
                    ? t("updateLocation")
                    : t("createLocation")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  );
}
