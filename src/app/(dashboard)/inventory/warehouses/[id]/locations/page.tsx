"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Copy,
  FolderPlus,
  FolderTree,
  ListPlus,
  ListTree,
  MoreVertical,
  MoveRight,
  Pencil,
  Plus,
  SearchX,
} from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient, getApiErrorCode } from "@/lib/api";
import { toast } from "sonner";
import type { WarehouseLocationOption } from "@/components/warehouses/WarehouseLocationSelect";
import {
  WarehouseLocationFormDialog,
  type WarehouseLocationEditable,
  type WarehouseLocationFormValues,
} from "@/components/warehouses/WarehouseLocationFormDialog";
import {
  AddMultipleWarehouseLocationsDialog,
  type WarehouseLocationBatchRequest,
} from "@/components/warehouses/AddMultipleWarehouseLocationsDialog";
import { CopyWarehouseLocationStructureDialog } from "@/components/warehouses/CopyWarehouseLocationStructureDialog";
import { MoveWarehouseLocationDialog } from "@/components/warehouses/MoveWarehouseLocationDialog";
import { WarehouseLocationSummary } from "@/components/warehouses/WarehouseLocationSummary";
import { WarehouseLocationTree } from "@/components/warehouses/WarehouseLocationTree";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useWarehouse } from "@/hooks/useWarehouses";
import { useInvalidateWarehouseLocations } from "@/hooks/useInvalidateWarehouseLocations";
import { useWarehouseLocationDetail } from "@/hooks/useWarehouseLocationDetail";
import { useWarehouseLocationTreeExpansion } from "@/hooks/useWarehouseLocationTreeExpansion";
import { EmptyStatePanel } from "@/components/shared/EmptyStatePanel";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusText } from "@/components/shared/StatusText";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCanCreate, useCanEdit, useCanView } from "@/hooks/usePermissions";
import { ProtectedRoute } from "@/components/permissions/ProtectedRoute";
import { RESOURCES } from "@/constants/resources";
import {
  getWarehouseLocationDisplayName,
  getWarehouseLocationErrorMessageKey,
  getWarehouseLocationUse,
  isWarehouseLocationType,
  suggestSiblingLocationType,
  warehouseLocationMutationErrorCodes,
  warehouseLocationTypeLabelKeys,
  warehouseLocationUseLabelKeys,
} from "@/lib/warehouse-location-form";
import type {
  WarehouseLocation,
  WarehouseLocationBatchResult,
  WarehouseLocationCopyRequest,
  WarehouseLocationCopyResult,
} from "@/types/inventory-location";

type WarehouseLocationsResponse = {
  data: WarehouseLocation[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type LocationDialogState =
  | { mode: "create"; parent: WarehouseLocationOption | null }
  | { mode: "edit"; location: WarehouseLocationEditable };

type MoveTarget = { id: string; code: string; name?: string | null };
type CopyTarget = MoveTarget & { parentId?: string | null };
type SearchScope = "branch" | "warehouse";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  const canCreate = useCanCreate(RESOURCES.MANAGE_LOCATIONS);
  const canEdit = useCanEdit(RESOURCES.MANAGE_LOCATIONS);
  const canViewWarehouse = useCanView(RESOURCES.WAREHOUSES);
  const format = useFormatter();
  const params = useParams();
  const warehouseId = params.id as string;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // The URL owns the open location so refresh, Back, and shared links restore it.
  const locationParam = searchParams.get("location");
  const selectedId = locationParam && UUID_PATTERN.test(locationParam) ? locationParam : null;
  const isInvalidSelection = Boolean(locationParam) && !selectedId;

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const [searchScope, setSearchScope] = useState<SearchScope>("branch");
  const [pageSize, setPageSize] = useState(20);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogState, setDialogState] = useState<LocationDialogState | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveKey, setMoveKey] = useState(0);
  const [copyTarget, setCopyTarget] = useState<CopyTarget | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyKey, setCopyKey] = useState(0);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchKey, setBatchKey] = useState(0);
  const treeExpansion = useWarehouseLocationTreeExpansion();
  const [structureOpen, setStructureOpen] = useState(false);

  const { data: warehouseResponse } = useWarehouse(canViewWarehouse ? warehouseId : "");
  const warehouseLabel = warehouseResponse?.data.name ?? t("warehouseRoot");
  const detailQuery = useWarehouseLocationDetail(warehouseId, selectedId);
  // The detail read is scoped to the business unit, so a location from another warehouse in it
  // must be treated as missing here rather than shown, or acted on, under this warehouse.
  const isForeignSelection = Boolean(
    detailQuery.data && detailQuery.data.warehouseId !== warehouseId
  );
  const selected = detailQuery.data && !isForeignSelection ? detailQuery.data : null;
  const isSelectionMissing =
    isInvalidSelection || Boolean(selectedId && (detailQuery.error || isForeignSelection));

  const selectedPathKey = selected
    ? [...selected.ancestors.map((ancestor) => ancestor.id), selected.id].join("/")
    : "";
  const { expandPath } = treeExpansion;
  useEffect(() => {
    if (!selectedPathKey) return;
    expandPath(selectedPathKey.split("/"));
  }, [selectedPathKey, expandPath]);
  useEffect(() => {
    setPage(1);
  }, [selectedId]);

  const isSearching = Boolean(debouncedSearch);
  const scopeId = isSearching && selectedId && searchScope === "branch" ? selectedId : undefined;
  const { data, isLoading, error } = useQuery<WarehouseLocationsResponse>({
    queryKey: [
      "warehouse-locations",
      warehouseId,
      page,
      pageSize,
      selectedId,
      debouncedSearch,
      scopeId,
    ],
    queryFn: () =>
      apiClient.get(`/api/warehouses/${warehouseId}/locations`, {
        params: {
          page,
          limit: pageSize,
          parentId: isSearching ? undefined : (selectedId ?? undefined),
          rootsOnly: !isSearching && !selectedId ? "true" : "false",
          search: debouncedSearch || undefined,
          scopeId,
        },
      }),
    enabled: !isSelectionMissing,
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
  const mutationErrorMessage = (mutationError: unknown, fallback: string) => {
    const code = getApiErrorCode(mutationError, warehouseLocationMutationErrorCodes);
    return code ? t(getWarehouseLocationErrorMessageKey(code)) : fallback;
  };
  const locationTypeLabel = (locationType: string) =>
    isWarehouseLocationType(locationType)
      ? t(warehouseLocationTypeLabelKeys[locationType])
      : locationType;

  const invalidateLocationQueries = useInvalidateWarehouseLocations(warehouseId);

  const createLocation = useMutation({
    mutationFn: (payload: WarehouseLocationFormValues & { parentId: string | null }) =>
      apiClient.post(`/api/warehouses/${warehouseId}/locations`, payload),
    onSuccess: () => {
      invalidateLocationQueries();
      toast.success(t("createdSuccess"));
    },
  });

  const updateLocation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: WarehouseLocationFormValues }) =>
      apiClient.patch(`/api/warehouse-locations/${id}`, values),
    onSuccess: () => {
      invalidateLocationQueries();
      toast.success(t("updatedSuccess"));
    },
  });

  const createLocationsBatch = useMutation({
    mutationFn: async (request: WarehouseLocationBatchRequest) => {
      const response = await apiClient.post<{ data: WarehouseLocationBatchResult }>(
        `/api/warehouses/${warehouseId}/locations/batch`,
        request
      );
      return response.data;
    },
    onSuccess: (result) => {
      invalidateLocationQueries();
      toast.success(t("batchCreated", { count: result.createdCount }));
    },
  });

  const copyStructure = useMutation({
    mutationFn: async ({
      sourceId,
      request,
    }: {
      sourceId: string;
      request: WarehouseLocationCopyRequest;
    }) => {
      const response = await apiClient.post<{ data: WarehouseLocationCopyResult }>(
        `/api/warehouse-locations/${sourceId}/copy`,
        request
      );
      return response.data;
    },
    onSuccess: (result) => {
      invalidateLocationQueries();
      toast.success(t("copyCreated", { count: result.createdCount }));
      goToLocation(result.rootId);
    },
  });

  const moveLocation = useMutation({
    mutationFn: ({ id, parentId }: { id: string; parentId: string | null }) =>
      apiClient.patch(`/api/warehouse-locations/${id}`, { parentId }),
    onSuccess: () => {
      invalidateLocationQueries();
      toast.success(t("moveSuccess"));
    },
  });

  const toggleLocation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiClient.patch(`/api/warehouse-locations/${id}`, { isActive }),
    onSuccess: () => {
      invalidateLocationQueries();
      toast.success(t("updatedSuccess"));
    },
    onError: (mutationError) => {
      toast.error(mutationErrorMessage(mutationError, t("updateError")));
    },
  });

  const goToLocation = (locationId: string | null) => {
    const next = new URLSearchParams(searchParams.toString());
    if (locationId) next.set("location", locationId);
    else next.delete("location");
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
    setSearch("");
    setStructureOpen(false);
  };

  const openLocationDialog = (nextState: LocationDialogState) => {
    setDialogState(nextState);
    setDialogKey((key) => key + 1);
    setDialogOpen(true);
  };

  const openCopyDialog = (location: CopyTarget) => {
    setCopyTarget(location);
    setCopyKey((key) => key + 1);
    setCopyOpen(true);
  };

  const openMoveDialog = (location: MoveTarget) => {
    setMoveTarget(location);
    setMoveKey((key) => key + 1);
    setMoveOpen(true);
  };

  const currentParent: WarehouseLocationOption | null = selected
    ? {
        id: selected.id,
        code: selected.code,
        name: selected.name,
        locationPath: selected.locationPath,
      }
    : null;

  // Siblings are only known for the level currently listed.
  const listedSiblingType = isSearching ? null : suggestSiblingLocationType(locations);
  const suggestedType =
    dialogState?.mode === "create" && (dialogState.parent?.id ?? null) === selectedId
      ? listedSiblingType
      : null;

  const structureTree = (
    <WarehouseLocationTree
      warehouseId={warehouseId}
      warehouseLabel={warehouseLabel}
      selectedId={selectedId}
      expansion={treeExpansion}
      onSelect={goToLocation}
      onShowAll={goToLocation}
    />
  );

  return (
    <ProtectedRoute resource={RESOURCES.MANAGE_LOCATIONS}>
      <div className="space-y-6">
        <PageHeader
          title={t("title")}
          subtitle={t("subtitle")}
          actions={
            canCreate && !isSelectionMissing ? (
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Button
                  variant="outline"
                  disabled={Boolean(selectedId && !selected)}
                  onClick={() => {
                    setBatchKey((key) => key + 1);
                    setBatchOpen(true);
                  }}
                >
                  <ListPlus className="mr-2 h-4 w-4" />
                  {t("addMultiple")}
                </Button>
                <Button
                  onClick={() => openLocationDialog({ mode: "create", parent: currentParent })}
                  disabled={Boolean(selectedId && !selected)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {selectedId ? t("addSublocation") : t("addLocation")}
                </Button>
              </div>
            ) : undefined
          }
        />

        <div className="flex items-start gap-6">
          <aside aria-label={t("structureLabel")} className="hidden w-72 shrink-0 2xl:block">
            <Card>
              <CardHeader className="pb-2">
                <p className="text-sm font-semibold">{t("structure")}</p>
              </CardHeader>
              <CardContent className="max-h-screen overflow-y-auto px-2 pb-4">
                {structureTree}
              </CardContent>
            </Card>
          </aside>

          <div className="min-w-0 flex-1 space-y-6">
            {selected ? (
              <WarehouseLocationSummary
                location={selected}
                canEdit={canEdit}
                isToggling={toggleLocation.isPending}
                onEdit={() => openLocationDialog({ mode: "edit", location: selected })}
                onMove={() => openMoveDialog(selected)}
                onCopy={canCreate ? () => openCopyDialog(selected) : undefined}
                onToggleActive={(isActive) => toggleLocation.mutate({ id: selected.id, isActive })}
              />
            ) : null}

            <Card>
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="2xl:hidden"
                    onClick={() => setStructureOpen(true)}
                  >
                    <ListTree className="mr-2 h-4 w-4" />
                    {t("structure")}
                  </Button>
                  <nav
                    className="flex min-w-0 flex-wrap items-center gap-1"
                    aria-label={t("locationPath")}
                  >
                    <Button
                      variant="link"
                      className="h-auto px-1 py-0"
                      aria-current={selectedId ? undefined : "page"}
                      onClick={() => goToLocation(null)}
                    >
                      {warehouseLabel}
                    </Button>
                    {selectedId && detailQuery.isLoading ? <Skeleton className="h-4 w-40" /> : null}
                    {selected?.ancestors.map((ancestor) => (
                      <span key={ancestor.id} className="flex items-center gap-1">
                        <span aria-hidden className="text-muted-foreground">
                          /
                        </span>
                        <Button
                          variant="link"
                          className="h-auto px-1 py-0"
                          onClick={() => goToLocation(ancestor.id)}
                        >
                          {getWarehouseLocationDisplayName(ancestor)}
                        </Button>
                      </span>
                    ))}
                    {selected ? (
                      <span className="flex items-center gap-1">
                        <span aria-hidden className="text-muted-foreground">
                          /
                        </span>
                        <span aria-current="page" className="px-1 text-sm font-semibold">
                          {getWarehouseLocationDisplayName(selected)}
                        </span>
                      </span>
                    ) : null}
                  </nav>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    aria-label={t("searchLocations")}
                    placeholder={
                      selected && searchScope === "branch"
                        ? t("searchInBranch", {
                            location: getWarehouseLocationDisplayName(selected),
                          })
                        : t("searchLocations")
                    }
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                  />
                  {selected ? (
                    <SegmentedControl
                      className="shrink-0 self-start whitespace-nowrap sm:self-auto"
                      aria-label={t("searchScope")}
                      value={searchScope}
                      onChange={(value) => {
                        setSearchScope(value);
                        setPage(1);
                      }}
                      options={[
                        { value: "branch", label: t("searchThisBranch") },
                        { value: "warehouse", label: t("searchWholeWarehouse") },
                      ]}
                    />
                  ) : null}
                </div>
                <p className="text-sm text-muted-foreground">{t("hierarchyHelp")}</p>
              </CardHeader>
              <CardContent>
                {isSelectionMissing ? (
                  <div className="flex flex-col items-center gap-4 pb-6">
                    <EmptyStatePanel
                      icon={AlertCircle}
                      title={t("locationMissingTitle")}
                      description={t("locationMissingDescription")}
                      className="min-h-48"
                    />
                    <Button variant="outline" onClick={() => goToLocation(null)}>
                      {t("backToWarehouseLevel")}
                    </Button>
                  </div>
                ) : error ? (
                  <EmptyStatePanel
                    icon={AlertCircle}
                    title={t("loadErrorTitle")}
                    description={t("loadErrorDescription")}
                    className="min-h-60"
                  />
                ) : locations.length === 0 && !isPending ? (
                  isSearching ? (
                    <EmptyStatePanel
                      icon={SearchX}
                      title={t("emptySearchTitle")}
                      description={t("emptySearchDescription")}
                      className="min-h-60"
                    />
                  ) : (
                    <EmptyStatePanel
                      icon={Plus}
                      title={
                        selected
                          ? t("emptyChildrenTitle", {
                              location: getWarehouseLocationDisplayName(selected),
                            })
                          : t("emptyTitle")
                      }
                      description={
                        selected
                          ? t("emptyChildrenDescription", {
                              location: getWarehouseLocationDisplayName(selected),
                            })
                          : t("emptyDescription")
                      }
                      className="min-h-60"
                    />
                  )
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">{t("code")}</TableHead>
                        <TableHead>{isSearching ? t("locationPath") : t("name")}</TableHead>
                        <TableHead>{t("type")}</TableHead>
                        <TableHead className="whitespace-nowrap">{t("use")}</TableHead>
                        <TableHead className="text-right">{t("capacity")}</TableHead>
                        <TableHead className="text-right">{t("subtreeQuantity")}</TableHead>
                        <TableHead className="text-right">{t("occupancy")}</TableHead>
                        <TableHead>{t("status")}</TableHead>
                        <TableHead className="text-right">{t("actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isPending
                        ? Array.from({ length: 8 }, (_, index) => `skeleton-${index}`).map(
                            (rowKey) => (
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
                                  <Skeleton className="h-4 w-24" />
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
                                <TableCell>
                                  <Skeleton className="h-4 w-16" />
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Skeleton className="h-8 w-16" />
                                    <Skeleton className="h-8 w-8" />
                                  </div>
                                </TableCell>
                              </TableRow>
                            )
                          )
                        : locations.map((location) => (
                            <TableRow
                              key={location.id}
                              className="cursor-pointer"
                              onClick={() => goToLocation(location.id)}
                            >
                              <TableCell className="whitespace-nowrap font-medium">
                                {/* The row is clickable; this button gives keyboard and screen reader users the same action. */}
                                <button
                                  type="button"
                                  className="text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                  aria-label={t("openLocation", {
                                    location: getWarehouseLocationDisplayName(location),
                                  })}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    goToLocation(location.id);
                                  }}
                                >
                                  {location.code}
                                </button>
                              </TableCell>
                              <TableCell>
                                {isSearching ? location.locationPath : location.name || "—"}
                              </TableCell>
                              <TableCell>{locationTypeLabel(location.locationType)}</TableCell>
                              <TableCell className="whitespace-nowrap">
                                {t(
                                  warehouseLocationUseLabelKeys[getWarehouseLocationUse(location)]
                                )}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {location.isStorable && location.maxCapacity != null
                                  ? `${format.number(location.usedCapacity ?? 0, { maximumFractionDigits: 2 })} / ${format.number(location.maxCapacity, { maximumFractionDigits: 2 })}`
                                  : "—"}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {format.number(location.subtreeQuantity ?? 0, {
                                  maximumFractionDigits: 2,
                                })}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {/* No capacity set: same plain dash as Used / Max. */}
                                {location.capacityStatus === "not_configured" ? (
                                  "—"
                                ) : (
                                  <StatusText tone={capacityTone(location.capacityStatus)}>
                                    {location.maxCapacity != null
                                      ? `${capacityStatusLabel(location.capacityStatus)} · ${format.number(location.utilizationPercent ?? 0, { maximumFractionDigits: 1 })}%`
                                      : capacityStatusLabel(location.capacityStatus)}
                                  </StatusText>
                                )}
                              </TableCell>
                              <TableCell>
                                <StatusText tone={location.isActive ? "green" : "muted"}>
                                  {location.isActive ? t("active") : t("inactive")}
                                </StatusText>
                              </TableCell>
                              {/* Actions, including the portaled menu, must not also open the row. */}
                              <TableCell
                                className="text-right"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={!canEdit}
                                    onClick={() => openLocationDialog({ mode: "edit", location })}
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
                                        aria-label={t("moreActionsFor", { code: location.code })}
                                      >
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      {isSearching ? (
                                        <DropdownMenuItem
                                          onClick={() => goToLocation(location.parentId ?? null)}
                                        >
                                          <FolderTree className="h-4 w-4" />
                                          <span>{t("showInHierarchy")}</span>
                                        </DropdownMenuItem>
                                      ) : null}
                                      {canCreate && location.isActive ? (
                                        <DropdownMenuItem
                                          onClick={() =>
                                            openLocationDialog({
                                              mode: "create",
                                              parent: location,
                                            })
                                          }
                                        >
                                          <FolderPlus className="h-4 w-4" />
                                          <span>{t("addInside")}</span>
                                        </DropdownMenuItem>
                                      ) : null}
                                      {canCreate ? (
                                        <DropdownMenuItem onClick={() => openCopyDialog(location)}>
                                          <Copy className="h-4 w-4" />
                                          <span>{t("copyStructure")}</span>
                                        </DropdownMenuItem>
                                      ) : null}
                                      {canEdit ? (
                                        <DropdownMenuItem onClick={() => openMoveDialog(location)}>
                                          <MoveRight className="h-4 w-4" />
                                          <span>{t("move")}</span>
                                        </DropdownMenuItem>
                                      ) : null}
                                      <DropdownMenuItem
                                        disabled={!canEdit || toggleLocation.isPending}
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
                                        <span>
                                          {location.isActive ? t("disable") : t("enable")}
                                        </span>
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
          </div>
        </div>

        <Dialog open={structureOpen} onOpenChange={setStructureOpen}>
          <DialogContent className="max-h-dvh overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("structure")}</DialogTitle>
              <DialogDescription>{t("structureDescription")}</DialogDescription>
            </DialogHeader>
            {structureTree}
          </DialogContent>
        </Dialog>

        {dialogState ? (
          <WarehouseLocationFormDialog
            key={`location-form-${dialogKey}`}
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            warehouseId={warehouseId}
            warehouseLabel={warehouseLabel}
            location={dialogState.mode === "edit" ? dialogState.location : null}
            defaultParent={dialogState.mode === "create" ? dialogState.parent : null}
            suggestedType={suggestedType}
            canSubmit={dialogState.mode === "edit" ? canEdit : canCreate}
            isSubmitting={createLocation.isPending || updateLocation.isPending}
            onSubmit={(values, parentId) =>
              dialogState.mode === "edit"
                ? updateLocation.mutateAsync({ id: dialogState.location.id, values })
                : createLocation.mutateAsync({ ...values, parentId })
            }
          />
        ) : null}

        {batchOpen || batchKey > 0 ? (
          <AddMultipleWarehouseLocationsDialog
            key={`batch-${batchKey}`}
            open={batchOpen}
            onOpenChange={setBatchOpen}
            warehouseId={warehouseId}
            parent={currentParent}
            suggestedType={listedSiblingType}
            isSubmitting={createLocationsBatch.isPending}
            onSubmit={(request) => createLocationsBatch.mutateAsync(request)}
          />
        ) : null}

        {copyTarget ? (
          <CopyWarehouseLocationStructureDialog
            key={`copy-${copyKey}`}
            open={copyOpen}
            onOpenChange={setCopyOpen}
            warehouseId={warehouseId}
            warehouseLabel={warehouseLabel}
            source={copyTarget}
            isSubmitting={copyStructure.isPending}
            onSubmit={(request) => copyStructure.mutateAsync({ sourceId: copyTarget.id, request })}
          />
        ) : null}

        {moveTarget ? (
          <MoveWarehouseLocationDialog
            key={`move-${moveKey}`}
            open={moveOpen}
            onOpenChange={setMoveOpen}
            warehouseId={warehouseId}
            warehouseLabel={warehouseLabel}
            location={moveTarget}
            isSubmitting={moveLocation.isPending}
            onSubmit={(parentId) => moveLocation.mutateAsync({ id: moveTarget.id, parentId })}
          />
        ) : null}
      </div>
    </ProtectedRoute>
  );
}
