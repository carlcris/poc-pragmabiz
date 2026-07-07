"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Search,
  Filter,
  Package,
  Trash2,
  MoreVertical,
  Send,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useGRNs, useDeleteGRN, useSubmitGRN, useConfirmGRN } from "@/hooks/useGRNs";
import { grnsApi } from "@/lib/api/grns";
import { useWarehouses } from "@/hooks/useWarehouses";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
import type { GRN, GRNStatus } from "@/types/grn";

export default function GRNsPage() {
  const t = useTranslations("grnsPage");
  const locale = useLocale();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [grnToDelete, setGRNToDelete] = useState<GRN | null>(null);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [grnToSubmit, setGRNToSubmit] = useState<GRN | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [grnToConfirm, setGRNToConfirm] = useState<GRN | null>(null);

  const deleteMutation = useDeleteGRN();
  const submitMutation = useSubmitGRN();
  const confirmMutation = useConfirmGRN();

  const { data, isLoading, error } = useGRNs({
    search,
    status: statusFilter !== "all" ? (statusFilter as GRNStatus) : undefined,
    warehouseId: warehouseFilter !== "all" ? warehouseFilter : undefined,
    page,
    limit: pageSize,
  });

  const { data: warehousesData } = useWarehouses({ page: 1, limit: 50 });
  const warehouses = warehousesData?.data || [];

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(new Date(value));

  const getStatusBadge = (status: GRNStatus) => {
    switch (status) {
      case "draft":
        return <StatusText tone="muted">{t("draft")}</StatusText>;
      case "receiving":
        return <StatusText tone="amber">{t("receiving")}</StatusText>;
      case "pending_approval":
        return <StatusText tone="yellow">{t("pendingApproval")}</StatusText>;
      case "approved":
        return <StatusText tone="green">{t("approved")}</StatusText>;
      case "rejected":
        return <StatusText tone="red">{t("rejected")}</StatusText>;
      case "cancelled":
        return <StatusText tone="red">{t("cancelled")}</StatusText>;
      default:
        return <StatusText>{status}</StatusText>;
    }
  };

  const handleViewGRN = (grn: GRN) => {
    router.push(`/purchasing/grns/${grn.id}`);
  };

  const handleDeleteGRN = (grn: GRN) => {
    setGRNToDelete(grn);
    setDeleteDialogOpen(true);
  };

  const handleSubmitGRN = (grn: GRN) => {
    setGRNToSubmit(grn);
    setSubmitDialogOpen(true);
  };

  const handleConfirmGRN = (grn: GRN) => {
    setGRNToConfirm(grn);
    setConfirmDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!grnToDelete) return;

    try {
      await deleteMutation.mutateAsync(grnToDelete.id);
      toast.success(t("deleteSuccess"));
      setDeleteDialogOpen(false);
      setGRNToDelete(null);
    } catch (err) {
      console.error("Failed to delete GRN:", err);
      toast.error(t("deleteError"));
    }
  };

  const confirmSubmit = async () => {
    if (!grnToSubmit) return;

    try {
      const grn = await grnsApi.getGRN(grnToSubmit.id);
      const items = Array.isArray(grn.items) ? grn.items : [];
      const hasReceivedQty =
        items.length > 0 && items.every((item) => Number(item.receivedQty ?? 0) > 0);

      if (!hasReceivedQty) {
        toast.error(t("submitMissingReceivedQty"));
        return;
      }

      await submitMutation.mutateAsync(grnToSubmit.id);
      toast.success(t("submitSuccess"));
      setSubmitDialogOpen(false);
      setGRNToSubmit(null);
    } catch {
      toast.error(t("submitError"));
    }
  };

  const confirmGRN = async () => {
    if (!grnToConfirm) return;

    try {
      await confirmMutation.mutateAsync({ id: grnToConfirm.id });
      toast.success(t("confirmSuccess"));
      setConfirmDialogOpen(false);
      setGRNToConfirm(null);
    } catch (err) {
      console.error("Failed to confirm GRN:", err);
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
      </div>

      <div className="space-y-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative w-full sm:flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value)}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder={t("statusPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allStatus")}</SelectItem>
              <SelectItem value="draft">{t("draft")}</SelectItem>
              <SelectItem value="receiving">{t("receiving")}</SelectItem>
              <SelectItem value="pending_approval">{t("pendingApproval")}</SelectItem>
              <SelectItem value="approved">{t("approved")}</SelectItem>
              <SelectItem value="rejected">{t("rejected")}</SelectItem>
              <SelectItem value="cancelled">{t("cancelled")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={warehouseFilter} onValueChange={(value) => setWarehouseFilter(value)}>
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
        </div>

        {isLoading ? (
          <div className="max-h-[calc(100vh-400px)] overflow-y-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead>{t("grnNumber")}</TableHead>
                  <TableHead>{t("loadList")}</TableHead>
                  <TableHead>{t("supplier")}</TableHead>
                  <TableHead>{t("warehouse")}</TableHead>
                  <TableHead>{t("containerSeal")}</TableHead>
                  <TableHead>{t("receivingDate")}</TableHead>
                  <TableHead className="text-center">{t("status")}</TableHead>
                  <TableHead>{t("receivedBy")}</TableHead>
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
                    <TableHead>{t("grnNumber")}</TableHead>
                    <TableHead>{t("loadList")}</TableHead>
                    <TableHead>{t("supplier")}</TableHead>
                    <TableHead>{t("warehouse")}</TableHead>
                    <TableHead>{t("containerSeal")}</TableHead>
                    <TableHead>{t("receivingDate")}</TableHead>
                    <TableHead className="text-center">{t("status")}</TableHead>
                    <TableHead>{t("receivedBy")}</TableHead>
                    <TableHead className="text-right">{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((grn) => (
                    <TableRow
                      key={grn.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleViewGRN(grn)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-green-600" />
                          <div className="font-medium">{grn.grnNumber}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          {grn.loadList && (
                            <>
                              <div className="font-medium">{grn.loadList.llNumber}</div>
                              {grn.loadList.supplierLlNumber && (
                                <div className="text-xs text-muted-foreground">
                                  {t("supplierPrefix", { value: grn.loadList.supplierLlNumber })}
                                </div>
                              )}
                            </>
                          )}
                          {!grn.loadList && t("noValue")}
                        </div>
                      </TableCell>
                      <TableCell>
                        {grn.loadList?.supplier ? (
                          <div>
                            <div className="font-medium">{grn.loadList.supplier.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {grn.loadList.supplier.code}
                            </div>
                          </div>
                        ) : (
                          t("noValue")
                        )}
                      </TableCell>
                      <TableCell>
                        {grn.warehouse ? (
                          <div>
                            <div className="font-medium">{grn.warehouse.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {grn.warehouse.code}
                            </div>
                          </div>
                        ) : (
                          t("noValue")
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {!grn.containerNumber && !grn.sealNumber ? (
                            t("noValue")
                          ) : (
                            <div>
                              {grn.containerNumber ?? t("noValue")} /{" "}
                              {grn.sealNumber ?? t("noValue")}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {grn.receivingDate ? (
                          <div className="text-sm">{formatDate(grn.receivingDate)}</div>
                        ) : (
                          <div className="text-sm text-muted-foreground">{t("notStarted")}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">{getStatusBadge(grn.status)}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {grn.receivedByUser
                            ? `${grn.receivedByUser.firstName} ${grn.receivedByUser.lastName}`
                            : t("noValue")}
                        </div>
                        {grn.receivingDate && (
                          <div className="text-xs text-muted-foreground">
                            {formatDate(grn.receivingDate)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div
                          className="flex items-center justify-end gap-2"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {(grn.status === "draft" || grn.status === "receiving") && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2"
                              onClick={() => handleSubmitGRN(grn)}
                              aria-label={t("submitForApproval")}
                            >
                              <Send className="mr-2 h-4 w-4" />
                              <span>{t("submit")}</span>
                            </Button>
                          )}
                          {grn.status === "pending_approval" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2"
                              onClick={() => handleConfirmGRN(grn)}
                              aria-label={t("confirm")}
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              <span>{t("confirm")}</span>
                            </Button>
                          )}
                          {grn.status === "draft" && (
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
                                <DropdownMenuItem
                                  onClick={() => handleDeleteGRN(grn)}
                                  disabled={deleteMutation.isPending}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span>{t("delete")}</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDescription", { code: grnToDelete?.grnNumber ?? "" })}
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

      <AlertDialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("submitTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("submitDescription", { grnNumber: grnToSubmit?.grnNumber ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSubmit} disabled={submitMutation.isPending}>
              {submitMutation.isPending ? t("submitting") : t("submit")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirmDescription", { grnNumber: grnToConfirm?.grnNumber ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmGRN}
              disabled={confirmMutation.isPending}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {confirmMutation.isPending ? t("confirming") : t("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
