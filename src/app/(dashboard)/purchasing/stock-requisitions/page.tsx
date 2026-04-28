"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import {
  Plus,
  Search,
  Pencil,
  Filter,
  FileText,
  Trash2,
  MoreVertical,
  Send,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  useStockRequisitions,
  useDeleteStockRequisition,
  useUpdateStockRequisitionStatus,
} from "@/hooks/useStockRequisitions";
import { useSuppliers } from "@/hooks/useSuppliers";
import { Button } from "@/components/ui/button";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { useCurrency } from "@/hooks/useCurrency";
import type { StockRequisition, StockRequisitionStatus } from "@/types/stock-requisition";

const StockRequisitionFormDialog = dynamic(
  () =>
    import("@/components/stock-requisitions/StockRequisitionFormDialog").then(
      (mod) => mod.StockRequisitionFormDialog
    ),
  { ssr: false }
);

export default function StockRequisitionsPage() {
  const t = useTranslations("stockRequisitionsPage");
  const locale = useLocale();
  const router = useRouter();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSR, setSelectedSR] = useState<StockRequisition | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [srToDelete, setSRToDelete] = useState<StockRequisition | null>(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [srToUpdateStatus, setSRToUpdateStatus] = useState<StockRequisition | null>(null);
  const [nextStatus, setNextStatus] = useState<"submitted" | "cancelled" | null>(null);

  const { formatCurrency } = useCurrency();
  const deleteMutation = useDeleteStockRequisition();
  const updateStatusMutation = useUpdateStockRequisitionStatus();

  const { data, isLoading, error } = useStockRequisitions({
    search,
    status: statusFilter !== "all" ? (statusFilter as StockRequisitionStatus) : undefined,
    supplierId: supplierFilter !== "all" ? supplierFilter : undefined,
    page,
    limit: pageSize,
  });

  const { data: suppliersData } = useSuppliers({ page: 1, limit: 50 });
  const suppliers = suppliersData?.data || [];

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

  const getStatusBadge = (status: StockRequisitionStatus) => {
    switch (status) {
      case "draft":
        return <StatusText tone="muted">{t("draft")}</StatusText>;
      case "submitted":
        return <StatusText tone="blue">{t("submitted")}</StatusText>;
      case "partially_fulfilled":
        return <StatusText tone="yellow">{t("partiallyFulfilled")}</StatusText>;
      case "fulfilled":
        return <StatusText tone="green">{t("fulfilled")}</StatusText>;
      case "cancelled":
        return <StatusText tone="red">{t("cancelled")}</StatusText>;
      default:
        return <StatusText>{status}</StatusText>;
    }
  };

  const handleCreateSR = () => {
    setSelectedSR(null);
    setDialogOpen(true);
  };

  const handleEditSR = (sr: StockRequisition) => {
    setSelectedSR(sr);
    setDialogOpen(true);
  };

  const handleViewSR = (sr: StockRequisition) => {
    router.push(`/purchasing/stock-requisitions/${sr.id}`);
  };

  const handleDeleteSR = (sr: StockRequisition) => {
    setSRToDelete(sr);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!srToDelete) return;

    try {
      await deleteMutation.mutateAsync(srToDelete.id);
      toast.success(t("deleteSuccess"));
      setDeleteDialogOpen(false);
      setSRToDelete(null);
    } catch (err) {
      console.error("Failed to delete stock requisition:", err);
      toast.error(t("deleteError"));
    }
  };

  const handleStatusAction = (sr: StockRequisition, status: "submitted" | "cancelled") => {
    setSRToUpdateStatus(sr);
    setNextStatus(status);
    setStatusDialogOpen(true);
  };

  const confirmStatusAction = async () => {
    if (!srToUpdateStatus || !nextStatus) return;

    try {
      await updateStatusMutation.mutateAsync({ id: srToUpdateStatus.id, status: nextStatus });
      toast.success(nextStatus === "submitted" ? t("submitSuccess") : t("cancelSuccess"));
      setStatusDialogOpen(false);
      setSRToUpdateStatus(null);
      setNextStatus(null);
    } catch (err) {
      console.error("Failed to update stock requisition status:", err);
      toast.error(nextStatus === "submitted" ? t("submitError") : t("cancelError"));
    }
  };

  const canCancelSR = (sr: StockRequisition) =>
    sr.status !== "cancelled" && sr.status !== "fulfilled";

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="whitespace-nowrap text-lg font-semibold tracking-tight sm:text-xl">
            {t("title")}
          </h1>
          <p className="whitespace-nowrap text-xs text-muted-foreground sm:text-sm">
            {t("subtitle")}
          </p>
        </div>
        <Button onClick={handleCreateSR} className="w-full flex-shrink-0 sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          <span className="sm:inline">{t("createAction")}</span>
        </Button>
      </div>

      <div className="space-y-3 sm:space-y-4">
        <div className="mb-3 flex flex-col gap-2 sm:mb-4 sm:flex-row sm:gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("searchPlaceholder")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-8"
            />
          </div>
          <ClientOnly fallback={<Skeleton className="h-10 w-full sm:w-[180px]" />}>
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder={t("statusPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allStatus")}</SelectItem>
                <SelectItem value="draft">{t("draft")}</SelectItem>
                <SelectItem value="submitted">{t("submitted")}</SelectItem>
                <SelectItem value="partially_fulfilled">{t("partiallyFulfilled")}</SelectItem>
                <SelectItem value="fulfilled">{t("fulfilled")}</SelectItem>
                <SelectItem value="cancelled">{t("cancelled")}</SelectItem>
              </SelectContent>
            </Select>
          </ClientOnly>
          <ClientOnly fallback={<Skeleton className="h-10 w-full sm:w-[180px]" />}>
            <Select
              value={supplierFilter}
              onValueChange={(value) => {
                setSupplierFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
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
        </div>

        {isLoading ? (
          <div className="max-h-[calc(100vh-400px)] overflow-auto rounded-md border">
            <Table className="min-w-[800px]">
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead>{t("srNumber")}</TableHead>
                  <TableHead>{t("supplier")}</TableHead>
                  <TableHead>{t("requisitionDate")}</TableHead>
                  <TableHead>{t("requiredBy")}</TableHead>
                  <TableHead className="text-right">{t("totalAmount")}</TableHead>
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
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="ml-auto h-4 w-20" />
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
          <div className="py-8 text-center text-muted-foreground">
            {t("emptyTitle")} {t("emptyDescription")}
          </div>
        ) : (
          <>
            <div className="max-h-[calc(100vh-400px)] overflow-auto rounded-md border">
              <Table className="min-w-[800px]">
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead>{t("srNumber")}</TableHead>
                    <TableHead>{t("supplier")}</TableHead>
                    <TableHead>{t("requisitionDate")}</TableHead>
                    <TableHead>{t("requiredBy")}</TableHead>
                    <TableHead className="text-right">{t("totalAmount")}</TableHead>
                    <TableHead className="text-center">{t("status")}</TableHead>
                    <TableHead>{t("createdBy")}</TableHead>
                    <TableHead className="text-right">{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((sr) => (
                    <TableRow
                      key={sr.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleViewSR(sr)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-blue-600" />
                          <div>
                            <div className="font-medium">{sr.srNumber}</div>
                            <div className="text-xs text-muted-foreground">
                              {sr.businessUnit?.code}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{sr.supplier?.name}</div>
                          <div className="text-xs text-muted-foreground">{sr.supplier?.code}</div>
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(sr.requisitionDate)}</TableCell>
                      <TableCell>{formatDate(sr.requiredByDate)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(sr.totalAmount)}
                      </TableCell>
                      <TableCell className="text-center">{getStatusBadge(sr.status)}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {sr.createdByUser
                            ? `${sr.createdByUser.firstName} ${sr.createdByUser.lastName}`
                            : t("noValue")}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(sr.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          {sr.status === "draft" && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditSR(sr)}
                                className="h-8 px-2"
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                <span>{t("edit")}</span>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleStatusAction(sr, "submitted")}
                                className="h-8 px-2"
                              >
                                <Send className="mr-2 h-4 w-4 text-blue-600" />
                                <span>{t("send")}</span>
                              </Button>
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
                                  {canCancelSR(sr) && (
                                    <DropdownMenuItem
                                      onClick={() => handleStatusAction(sr, "cancelled")}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <XCircle className="h-4 w-4" />
                                      <span>{t("cancel")}</span>
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    onClick={() => handleDeleteSR(sr)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    <span>{t("delete")}</span>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </>
                          )}
                          {sr.status !== "draft" && canCancelSR(sr) && (
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
                                  onClick={() => handleStatusAction(sr, "cancelled")}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <XCircle className="h-4 w-4" />
                                  <span>{t("cancel")}</span>
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

      {dialogOpen && (
        <StockRequisitionFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          stockRequisition={selectedSR}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDescription", { number: srToDelete?.srNumber ?? "" })}
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

      <AlertDialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {nextStatus === "submitted" ? t("sendTitle") : t("cancelTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {nextStatus === "submitted" ? t("sendDescription") : t("cancelDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmStatusAction}
              disabled={updateStatusMutation.isPending}
              className={
                nextStatus === "cancelled"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : undefined
              }
            >
              {updateStatusMutation.isPending
                ? nextStatus === "submitted"
                  ? t("sending")
                  : t("cancelling")
                : nextStatus === "submitted"
                  ? t("send")
                  : t("cancel")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
