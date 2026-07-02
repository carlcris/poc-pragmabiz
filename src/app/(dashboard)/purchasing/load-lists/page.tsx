"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import {
  Plus,
  Search,
  Pencil,
  Filter,
  Package,
  Trash2,
  MoreVertical,
  XCircle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useLoadLists, useDeleteLoadList, useUpdateLoadListStatus } from "@/hooks/useLoadLists";
import { useResourcePermissions } from "@/hooks/usePermissions";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";
import { RESOURCES } from "@/constants/resources";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientOnly } from "@/components/shared/ClientOnly";
import { StatusText } from "@/components/shared/StatusText";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { EmptyStatePanel } from "@/components/shared/EmptyStatePanel";
import type { LoadList, LoadListStatus } from "@/types/load-list";

const LoadListFormDialog = dynamic(
  () => import("@/components/load-lists/LoadListFormDialog").then((mod) => mod.LoadListFormDialog),
  { ssr: false }
);

const formatLoadListCurrency = (amount: number, currencyCode: string, locale: string) => {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currencyCode,
      currencyDisplay: "narrowSymbol",
    }).format(amount);
  } catch {
    return `${currencyCode} ${amount.toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
};

export default function LoadListsPage() {
  const t = useTranslations("loadListsPage");
  const locale = useLocale();
  const router = useRouter();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedLL, setSelectedLL] = useState<LoadList | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [llToDelete, setLLToDelete] = useState<LoadList | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [llToCancel, setLLToCancel] = useState<LoadList | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [llToConfirm, setLLToConfirm] = useState<LoadList | null>(null);

  const deleteMutation = useDeleteLoadList();
  const updateStatusMutation = useUpdateLoadListStatus();
  const {
    canCreate: canCreateLoadLists,
    canEdit: canEditLoadLists,
    canDelete: canDeleteLoadLists,
  } = useResourcePermissions(RESOURCES.LOAD_LISTS);

  const { data, isLoading, error } = useLoadLists({
    search,
    status: statusFilter !== "all" ? (statusFilter as LoadListStatus) : undefined,
    supplierId: supplierFilter !== "all" ? supplierFilter : undefined,
    warehouseId: warehouseFilter !== "all" ? warehouseFilter : undefined,
    page,
    limit: pageSize,
  });
  const canViewTotalAmount = data?.capabilities?.canViewTotalAmount === true;

  const { data: suppliersData } = useSuppliers({ page: 1, limit: 50 });
  const suppliers = useMemo(() => suppliersData?.data || [], [suppliersData?.data]);

  const { data: warehousesData } = useWarehouses({ page: 1, limit: 50 });
  const warehouses = useMemo(() => warehousesData?.data || [], [warehousesData?.data]);

  const currentBusinessUnit = useBusinessUnitStore((state) => state.currentBusinessUnit);
  const defaultWarehouseId = useMemo(() => {
    if (!currentBusinessUnit?.id) return "";
    return (
      warehouses.find((warehouse) => warehouse.businessUnitId === currentBusinessUnit.id)?.id || ""
    );
  }, [currentBusinessUnit?.id, warehouses]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const formatDate = (value?: string | null) => {
    if (!value) return t("noValue");
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(new Date(value));
  };

  const getStatusBadge = (status: LoadListStatus) => {
    switch (status) {
      case "draft":
        return <StatusText tone="muted">{t("draft")}</StatusText>;
      case "confirmed":
        return <StatusText tone="blue">{t("confirmed")}</StatusText>;
      case "in_transit":
        return <StatusText tone="purple">{t("inTransit")}</StatusText>;
      case "arrived":
        return <StatusText tone="indigo">{t("arrived")}</StatusText>;
      case "receiving":
        return <StatusText tone="amber">{t("receiving")}</StatusText>;
      case "pending_approval":
        return <StatusText tone="yellow">{t("pendingApproval")}</StatusText>;
      case "received":
        return <StatusText tone="green">{t("received")}</StatusText>;
      case "cancelled":
        return <StatusText tone="red">{t("cancelled")}</StatusText>;
      default:
        return <StatusText>{status}</StatusText>;
    }
  };

  const handleCreateLL = () => {
    setSelectedLL(null);
    setDialogOpen(true);
  };

  const handleEditLL = (ll: LoadList) => {
    setSelectedLL(ll);
    setDialogOpen(true);
  };

  const handleViewLL = (ll: LoadList) => {
    router.push(`/purchasing/load-lists/${ll.id}`);
  };

  const handleDeleteLL = (ll: LoadList) => {
    setLLToDelete(ll);
    setDeleteDialogOpen(true);
  };

  const handleCancelLL = (ll: LoadList) => {
    setLLToCancel(ll);
    setCancelDialogOpen(true);
  };

  const handleConfirmLL = (ll: LoadList) => {
    setLLToConfirm(ll);
    setConfirmDialogOpen(true);
  };

  const canCancelLL = (ll: LoadList) =>
    ll.status !== "cancelled" &&
    ll.status !== "received" &&
    ll.status !== "arrived" &&
    ll.status !== "receiving" &&
    ll.status !== "pending_approval";

  const confirmDelete = async () => {
    if (!llToDelete) return;

    try {
      await deleteMutation.mutateAsync(llToDelete.id);
      toast.success(t("deleteSuccess"));
      setDeleteDialogOpen(false);
      setLLToDelete(null);
    } catch (err) {
      console.error("Failed to delete load list:", err);
      toast.error(t("deleteError"));
    }
  };

  const confirmCancel = async () => {
    if (!llToCancel) return;

    try {
      await updateStatusMutation.mutateAsync({
        id: llToCancel.id,
        data: {
          status: "cancelled",
        },
      });
      toast.success(t("cancelSuccess"));
      setCancelDialogOpen(false);
      setLLToCancel(null);
    } catch (err) {
      console.error("Failed to cancel load list:", err);
      toast.error(t("cancelError"));
    }
  };

  const confirmLoadList = async () => {
    if (!llToConfirm) return;

    try {
      await updateStatusMutation.mutateAsync({
        id: llToConfirm.id,
        data: {
          status: "confirmed",
        },
      });
      toast.success(t("confirmSuccess"));
      setConfirmDialogOpen(false);
      setLLToConfirm(null);
    } catch (err) {
      console.error("Failed to confirm load list:", err);
      toast.error(t("confirmError"));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="whitespace-nowrap text-lg font-semibold tracking-tight sm:text-xl">
            {t("title")}
          </h1>
          <p className="whitespace-nowrap text-xs text-muted-foreground sm:text-sm">
            {t("subtitle")}
          </p>
        </div>
        {canCreateLoadLists && (
          <Button onClick={handleCreateLL} className="w-full flex-shrink-0 sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            {t("createAction")}
          </Button>
        )}
      </div>

      <div className="space-y-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative w-full sm:flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("searchPlaceholder")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-8"
            />
          </div>
          <ClientOnly fallback={<Skeleton className="h-10 w-full sm:w-[200px]" />}>
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder={t("statusPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allStatus")}</SelectItem>
                <SelectItem value="draft">{t("draft")}</SelectItem>
                <SelectItem value="confirmed">{t("confirmed")}</SelectItem>
                <SelectItem value="in_transit">{t("inTransit")}</SelectItem>
                <SelectItem value="arrived">{t("arrived")}</SelectItem>
                <SelectItem value="receiving">{t("receiving")}</SelectItem>
                <SelectItem value="pending_approval">{t("pendingApproval")}</SelectItem>
                <SelectItem value="received">{t("received")}</SelectItem>
                <SelectItem value="cancelled">{t("cancelled")}</SelectItem>
              </SelectContent>
            </Select>
          </ClientOnly>
          <ClientOnly fallback={<Skeleton className="h-10 w-full sm:w-[200px]" />}>
            <Select
              value={supplierFilter}
              onValueChange={(value) => {
                setSupplierFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder={t("supplierPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allSuppliers")}</SelectItem>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ClientOnly>
          <ClientOnly fallback={<Skeleton className="h-10 w-full sm:w-[200px]" />}>
            <Select
              value={warehouseFilter}
              onValueChange={(value) => {
                setWarehouseFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder={t("warehousePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allWarehouses")}</SelectItem>
                {warehouses.map((warehouse) => (
                  <SelectItem key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ClientOnly>
        </div>

        {isLoading ? (
          <div className="max-h-[calc(100vh-400px)] overflow-y-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead>{t("llNumber")}</TableHead>
                  <TableHead>{t("supplier")}</TableHead>
                  <TableHead>{t("warehouse")}</TableHead>
                  <TableHead>{t("containerSeal")}</TableHead>
                  <TableHead>{t("batch")}</TableHead>
                  {canViewTotalAmount && (
                    <TableHead className="text-right">{t("totalAmount")}</TableHead>
                  )}
                  <TableHead>{t("arrivalDate")}</TableHead>
                  <TableHead className="text-center">{t("status")}</TableHead>
                  <TableHead>{t("createdBy")}</TableHead>
                  <TableHead className="text-right">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(8)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    {canViewTotalAmount && (
                      <TableCell className="text-right">
                        <Skeleton className="ml-auto h-4 w-20" />
                      </TableCell>
                    )}
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Skeleton className="mx-auto h-5 w-20 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Skeleton className="h-8 w-8" />
                        <Skeleton className="h-8 w-8" />
                        <Skeleton className="h-8 w-8" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : error ? (
          <div className="py-8 text-center text-destructive">{t("loadError")}</div>
        ) : !data?.data || data.data.length === 0 ? (
          <EmptyStatePanel
            icon={Package}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
          />
        ) : (
          <>
            <div className="max-h-[calc(100vh-400px)] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead>{t("llNumber")}</TableHead>
                    <TableHead>{t("supplier")}</TableHead>
                    <TableHead>{t("warehouse")}</TableHead>
                    <TableHead>{t("containerSeal")}</TableHead>
                    <TableHead>{t("batch")}</TableHead>
                    {canViewTotalAmount && (
                      <TableHead className="text-right">{t("totalAmount")}</TableHead>
                    )}
                    <TableHead>{t("arrivalDate")}</TableHead>
                    <TableHead className="text-center">{t("status")}</TableHead>
                    <TableHead>{t("createdBy")}</TableHead>
                    <TableHead className="text-right">{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((ll) => (
                    <TableRow
                      key={ll.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleViewLL(ll)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-blue-600" />
                          <div>
                            <div className="font-medium">{ll.llNumber}</div>
                            {ll.supplierLlNumber && (
                              <div className="text-xs text-muted-foreground">
                                {t("supplierPrefix", { value: ll.supplierLlNumber })}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{ll.supplier?.name}</div>
                          <div className="text-xs text-muted-foreground">{ll.supplier?.code}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{ll.warehouse?.name}</div>
                          <div className="text-xs text-muted-foreground">{ll.warehouse?.code}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {!ll.containerNumber && !ll.sealNumber ? (
                            t("noValue")
                          ) : (
                            <div>
                              {ll.containerNumber ?? t("noValue")} / {ll.sealNumber ?? t("noValue")}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{ll.batchNumber || t("noValue")}</div>
                      </TableCell>
                      {canViewTotalAmount && (
                        <TableCell className="text-right">
                          <div className="text-sm font-medium tabular-nums">
                            {formatLoadListCurrency(
                              ll.totalAmount ?? 0,
                              ll.currency ?? "PHP",
                              locale
                            )}
                          </div>
                        </TableCell>
                      )}
                      <TableCell>
                        <div>
                          {ll.estimatedArrivalDate && (
                            <div className="text-sm">
                              {t("estimatedPrefix", { date: formatDate(ll.estimatedArrivalDate) })}
                            </div>
                          )}
                          {ll.actualArrivalDate && (
                            <div className="text-sm font-medium text-green-600">
                              {t("actualPrefix", { date: formatDate(ll.actualArrivalDate) })}
                            </div>
                          )}
                          {!ll.estimatedArrivalDate && !ll.actualArrivalDate && t("noValue")}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{getStatusBadge(ll.status)}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {ll.createdByUser
                            ? `${ll.createdByUser.firstName} ${ll.createdByUser.lastName}`
                            : t("noValue")}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(ll.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div
                          className="flex items-center justify-end gap-2"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {canEditLoadLists &&
                            (ll.status === "draft" || ll.status === "confirmed") && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-2"
                                onClick={() => handleEditLL(ll)}
                                aria-label={t("edit")}
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                <span>{t("edit")}</span>
                              </Button>
                            )}
                          {canEditLoadLists && ll.status === "draft" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2"
                              onClick={() => handleConfirmLL(ll)}
                              aria-label={t("confirm")}
                            >
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              <span>{t("confirm")}</span>
                            </Button>
                          )}
                          {(canEditLoadLists && canCancelLL(ll)) ||
                          (canDeleteLoadLists &&
                            (ll.status === "draft" || ll.status === "confirmed")) ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  aria-label={t("actions")}
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {canEditLoadLists && canCancelLL(ll) && (
                                  <DropdownMenuItem
                                    onClick={() => handleCancelLL(ll)}
                                    disabled={updateStatusMutation.isPending}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <XCircle className="h-4 w-4" />
                                    <span>{t("cancel")}</span>
                                  </DropdownMenuItem>
                                )}
                                {canDeleteLoadLists &&
                                  (ll.status === "draft" || ll.status === "confirmed") && (
                                    <DropdownMenuItem
                                      onClick={() => handleDeleteLL(ll)}
                                      disabled={deleteMutation.isPending}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      <span>{t("delete")}</span>
                                    </DropdownMenuItem>
                                  )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {data.pagination && data.pagination.total > 0 && (
              <div className="mt-4">
                <DataTablePagination
                  currentPage={page}
                  totalPages={data.pagination.totalPages}
                  pageSize={pageSize}
                  totalItems={data.pagination.total}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                />
              </div>
            )}
          </>
        )}
      </div>

      {dialogOpen && (
        <LoadListFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          loadList={selectedLL}
          defaultWarehouseId={defaultWarehouseId}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDescription", { code: llToDelete?.llNumber ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? t("deleting") : t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("cancelTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("cancelDescription", { code: llToCancel?.llNumber ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancelBack")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCancel}
              disabled={updateStatusMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {updateStatusMutation.isPending ? t("cancelling") : t("confirmCancel")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirmDescription", { code: llToConfirm?.llNumber ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLoadList} disabled={updateStatusMutation.isPending}>
              {updateStatusMutation.isPending ? t("confirming") : t("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
