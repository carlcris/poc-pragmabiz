"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { Plus, Search, Pencil, Filter, Package, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useLoadLists, useDeleteLoadList } from "@/hooks/useLoadLists";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useWarehouses } from "@/hooks/useWarehouses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientOnly } from "@/components/shared/ClientOnly";
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

  const deleteMutation = useDeleteLoadList();

  const { data, isLoading, error } = useLoadLists({
    search,
    status: statusFilter !== "all" ? (statusFilter as LoadListStatus) : undefined,
    supplierId: supplierFilter !== "all" ? supplierFilter : undefined,
    warehouseId: warehouseFilter !== "all" ? warehouseFilter : undefined,
    page,
    limit: pageSize,
  });

  const { data: suppliersData } = useSuppliers({ page: 1, limit: 50 });
  const suppliers = suppliersData?.data || [];

  const { data: warehousesData } = useWarehouses({ page: 1, limit: 50 });
  const warehouses = warehousesData?.data || [];

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
        return <Badge variant="secondary">{t("draft")}</Badge>;
      case "confirmed":
        return (
          <Badge
            variant="outline"
            className="border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-400"
          >
            {t("confirmed")}
          </Badge>
        );
      case "in_transit":
        return (
          <Badge
            variant="outline"
            className="border-purple-600 text-purple-700 dark:border-purple-400 dark:text-purple-400"
          >
            {t("inTransit")}
          </Badge>
        );
      case "arrived":
        return (
          <Badge
            variant="outline"
            className="border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-400"
          >
            {t("arrived")}
          </Badge>
        );
      case "receiving":
        return (
          <Badge
            variant="outline"
            className="border-amber-600 text-amber-700 dark:border-amber-400 dark:text-amber-400"
          >
            {t("receiving")}
          </Badge>
        );
      case "pending_approval":
        return (
          <Badge
            variant="outline"
            className="border-yellow-600 text-yellow-700 dark:border-yellow-400 dark:text-yellow-400"
          >
            {t("pendingApproval")}
          </Badge>
        );
      case "received":
        return (
          <Badge
            variant="outline"
            className="border-green-600 text-green-700 dark:border-green-400 dark:text-green-400"
          >
            {t("received")}
          </Badge>
        );
      case "cancelled":
        return <Badge variant="destructive">{t("cancelled")}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
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

  const getErrorMessage = (err: unknown, fallback: string) =>
    err instanceof Error ? err.message : fallback;

  const confirmDelete = async () => {
    if (!llToDelete) return;

    try {
      await deleteMutation.mutateAsync(llToDelete.id);
      toast.success(t("deleteSuccess"));
      setDeleteDialogOpen(false);
      setLLToDelete(null);
    } catch (err) {
      toast.error(getErrorMessage(err, t("deleteError")));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight whitespace-nowrap">{t("title")}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">{t("subtitle")}</p>
        </div>
        <Button onClick={handleCreateLL} className="w-full sm:w-auto flex-shrink-0">
          <Plus className="mr-2 h-4 w-4" />
          {t("createAction")}
        </Button>
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
          <div className="py-8 text-center text-destructive">
            {t("loadError")}
          </div>
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
                    <TableHead>{t("arrivalDate")}</TableHead>
                    <TableHead className="text-center">{t("status")}</TableHead>
                    <TableHead>{t("createdBy")}</TableHead>
                    <TableHead className="text-right">{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((ll) => (
                    <TableRow key={ll.id}>
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
                          {(!ll.containerNumber && !ll.sealNumber) ? (
                            t("noValue")
                          ) : (
                            <div>{ll.containerNumber ?? t("noValue")} / {ll.sealNumber ?? t("noValue")}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{ll.batchNumber || t("noValue")}</div>
                      </TableCell>
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
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleViewLL(ll)} aria-label={t("view")}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {(ll.status === "draft" || ll.status === "confirmed") && (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => handleEditLL(ll)} aria-label={t("edit")}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDeleteLL(ll)} aria-label={t("delete")}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
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
        <LoadListFormDialog open={dialogOpen} onOpenChange={setDialogOpen} loadList={selectedLL} />
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
    </div>
  );
}
