"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import {
  Plus,
  Search,
  Filter,
  Pencil,
  Trash2,
  CheckCircle,
  FileText,
  Clock,
  XCircle,
  Calculator,
} from "lucide-react";
import {
  useStockAdjustments,
  useCreateStockAdjustment,
  useUpdateStockAdjustment,
  useDeleteStockAdjustment,
  usePostStockAdjustment,
} from "@/hooks/useStockAdjustments";
import { useWarehouses } from "@/hooks/useWarehouses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import type {
  StockAdjustment,
  StockAdjustmentType,
  StockAdjustmentStatus,
} from "@/types/stock-adjustment";
import { useAuthStore } from "@/stores/authStore";
import { useCurrency } from "@/hooks/useCurrency";
import { supabase } from "@/lib/supabase/client";
import type { StockAdjustmentFormSubmitPayload } from "@/components/stock-adjustments/StockAdjustmentFormDialog";

const StockAdjustmentFormDialog = dynamic(
  () =>
    import("@/components/stock-adjustments/StockAdjustmentFormDialog").then(
      (mod) => mod.StockAdjustmentFormDialog
    ),
  { ssr: false }
);

export default function StockAdjustmentsPage() {
  const t = useTranslations("stockAdjustmentsPage");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAdjustment, setSelectedAdjustment] = useState<StockAdjustment | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [adjustmentToDelete, setAdjustmentToDelete] = useState<StockAdjustment | null>(null);
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [adjustmentToPost, setAdjustmentToPost] = useState<StockAdjustment | null>(null);

  const user = useAuthStore((state) => state.user);
  const companyId = user?.companyId || "";
  const { formatCurrency } = useCurrency();

  const { data, isLoading, error } = useStockAdjustments({
    search: search || undefined,
    status: statusFilter === "all" ? undefined : (statusFilter as StockAdjustmentStatus),
    adjustmentType: typeFilter === "all" ? undefined : (typeFilter as StockAdjustmentType),
    page,
    limit: pageSize,
  });

  const { data: warehousesData } = useWarehouses({ page: 1, limit: 50 });

  const warehouses = warehousesData?.data || [];

  const createMutation = useCreateStockAdjustment();
  const updateMutation = useUpdateStockAdjustment();
  const deleteMutation = useDeleteStockAdjustment();
  const postMutation = usePostStockAdjustment();

  const adjustments = data?.data || [];
  const pagination = data?.pagination;

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);


  const getStatusBadge = (status: StockAdjustmentStatus) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">{t("draft")}</Badge>;
      case "pending":
        return (
          <Badge variant="default" className="bg-yellow-600">{t("pending")}</Badge>
        );
      case "approved":
        return (
          <Badge variant="default" className="bg-blue-600">{t("approved")}</Badge>
        );
      case "posted":
        return (
          <Badge variant="default" className="bg-green-600">{t("posted")}</Badge>
        );
      case "rejected":
        return <Badge variant="destructive">{t("rejected")}</Badge>;
    }
  };

  const getStatusIcon = (status: StockAdjustmentStatus) => {
    switch (status) {
      case "draft":
        return <FileText className="h-4 w-4 text-gray-600" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case "approved":
        return <CheckCircle className="h-4 w-4 text-blue-600" />;
      case "posted":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "rejected":
        return <XCircle className="h-4 w-4 text-red-600" />;
    }
  };

  const getTypeLabel = (type: StockAdjustmentType) => {
    switch (type) {
      case "physical_count":
        return t("physicalCount");
      case "damage":
        return t("damage");
      case "loss":
        return t("loss");
      case "found":
        return t("found");
      case "quality_issue":
        return t("qualityIssue");
      case "other":
        return t("other");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleCreateAdjustment = () => {
    setSelectedAdjustment(null);
    setDialogOpen(true);
  };

  const handleEditAdjustment = (adjustment: StockAdjustment) => {
    setSelectedAdjustment(adjustment);
    setDialogOpen(true);
  };

  const handleDeleteAdjustment = (adjustment: StockAdjustment) => {
    setAdjustmentToDelete(adjustment);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!adjustmentToDelete) return;

    await deleteMutation.mutateAsync(adjustmentToDelete.id);
    setDeleteDialogOpen(false);
    setAdjustmentToDelete(null);
  };

  const handlePostAdjustment = (adjustment: StockAdjustment) => {
    setAdjustmentToPost(adjustment);
    setPostDialogOpen(true);
  };

  const handleConfirmPost = async () => {
    if (!adjustmentToPost) return;

    await postMutation.mutateAsync({ id: adjustmentToPost.id });
    setPostDialogOpen(false);
    setAdjustmentToPost(null);
  };

  const handleFetchStockQty = async (
    itemId: string,
    warehouseId: string,
    locationId?: string
  ): Promise<number> => {
    try {
      if (locationId) {
        const { data, error } = await supabase
          .from("item_location")
          .select("qty_on_hand")
          .eq("item_id", itemId)
          .eq("warehouse_id", warehouseId)
          .eq("location_id", locationId)
          .eq("company_id", companyId)
          .maybeSingle();

        if (error) {
          return 0;
        }

        return data ? parseFloat(data.qty_on_hand) : 0;
      }

      // Fallback to warehouse-level stock when location is not selected
      const { data, error } = await supabase
        .from("item_warehouse")
        .select("current_stock")
        .eq("item_id", itemId)
        .eq("warehouse_id", warehouseId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (error) {
        return 0;
      }

      return data ? parseFloat(data.current_stock) : 0;
    } catch {
      return 0;
    }
  };

  const handleSaveAdjustment = async (payload: StockAdjustmentFormSubmitPayload) => {
    try {
      const submitData = {
        ...payload.values,
        companyId,
        items: payload.lineItems.map((item) => ({
          itemId: item.itemId,
          currentQty: item.currentQty,
          adjustedQty: item.adjustedQty,
          unitCost: item.unitCost,
          uomId: item.uomId,
        })),
      };

      if (payload.selectedAdjustment) {
        await updateMutation.mutateAsync({
          id: payload.selectedAdjustment.id,
          data: submitData,
        });
      } else {
        await createMutation.mutateAsync(submitData);
      }
    } catch {}
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleTypeFilterChange = (value: string) => {
    setTypeFilter(value);
    setPage(1);
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight whitespace-nowrap">{t("title")}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">{t("subtitle")}</p>
          </div>
          <Button onClick={handleCreateAdjustment} className="w-full sm:w-auto flex-shrink-0">
            <Plus className="mr-2 h-4 w-4" />
            {t("createAdjustment")}
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
            <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder={t("statusPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allStatus")}</SelectItem>
                <SelectItem value="draft">{t("draft")}</SelectItem>
                <SelectItem value="pending">{t("pending")}</SelectItem>
                <SelectItem value="approved">{t("approved")}</SelectItem>
                <SelectItem value="posted">{t("posted")}</SelectItem>
                <SelectItem value="rejected">{t("rejected")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={handleTypeFilterChange}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder={t("typePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allTypes")}</SelectItem>
                <SelectItem value="physical_count">{t("physicalCount")}</SelectItem>
                <SelectItem value="damage">{t("damage")}</SelectItem>
                <SelectItem value="loss">{t("loss")}</SelectItem>
                <SelectItem value="found">{t("found")}</SelectItem>
                <SelectItem value="quality_issue">{t("qualityIssue")}</SelectItem>
                <SelectItem value="other">{t("other")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="max-h-[calc(100vh-400px)] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead>{t("adjustmentNumber")}</TableHead>
                    <TableHead>{t("type")}</TableHead>
                    <TableHead>{t("date")}</TableHead>
                    <TableHead>{t("warehouse")}</TableHead>
                    <TableHead>{t("location")}</TableHead>
                    <TableHead>{t("reason")}</TableHead>
                    <TableHead className="text-right">{t("totalValue")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                    <TableHead className="text-right">{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...Array(8)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-24 rounded-full" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-36" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="ml-auto h-4 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-24 rounded-full" />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Skeleton className="h-8 w-8" />
                          <Skeleton className="h-8 w-8" />
                          <Skeleton className="h-8 w-16" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : error ? (
            <div className="py-8 text-center text-destructive">
              {t("loadingError")}
            </div>
          ) : adjustments.length === 0 ? (
            <EmptyStatePanel
              icon={Calculator}
              title={t("emptyTitle")}
              description={t("emptyDescription")}
            />
          ) : (
            <>
              <div className="max-h-[calc(100vh-400px)] overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background">
                    <TableRow>
                      <TableHead>{t("adjustmentNumber")}</TableHead>
                      <TableHead>{t("type")}</TableHead>
                      <TableHead>{t("date")}</TableHead>
                      <TableHead>{t("warehouse")}</TableHead>
                      <TableHead>{t("location")}</TableHead>
                      <TableHead>{t("reason")}</TableHead>
                      <TableHead className="text-right">{t("totalValue")}</TableHead>
                      <TableHead>{t("status")}</TableHead>
                      <TableHead className="text-right">{t("actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adjustments.map((adjustment) => (
                      <TableRow key={adjustment.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(adjustment.status)}
                            {adjustment.adjustmentCode}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{getTypeLabel(adjustment.adjustmentType)}</Badge>
                        </TableCell>
                        <TableCell>{formatDate(adjustment.adjustmentDate)}</TableCell>
                        <TableCell>{adjustment.warehouseName}</TableCell>
                        <TableCell>
                          {adjustment.locationCode && adjustment.locationName
                            ? `${adjustment.locationCode} - ${adjustment.locationName}`
                            : adjustment.locationCode || adjustment.locationName || t("noLocation")}
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[200px] truncate">{adjustment.reason}</div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div
                            className={
                              adjustment.totalValue >= 0 ? "text-green-600" : "text-red-600"
                            }
                          >
                            {formatCurrency(adjustment.totalValue)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t("itemsCount", { count: adjustment.items.length })}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(adjustment.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {adjustment.status === "draft" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditAdjustment(adjustment)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteAdjustment(adjustment)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => handlePostAdjustment(adjustment)}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  <CheckCircle className="mr-1 h-4 w-4" />
                                  {t("post")}
                                </Button>
                              </>
                            )}
                            {adjustment.status === "posted" && adjustment.stockTransactionCode && (
                              <Badge variant="outline" className="text-xs">
                                {adjustment.stockTransactionCode}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {pagination && pagination.total > 0 && (
                <div className="mt-4">
                  <DataTablePagination
                    currentPage={page}
                    totalPages={pagination.totalPages}
                    pageSize={pageSize}
                    totalItems={pagination.total}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {dialogOpen && (
          <StockAdjustmentFormDialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) setSelectedAdjustment(null);
            }}
            selectedAdjustment={selectedAdjustment}
            warehouses={warehouses}
            isSaving={createMutation.isPending || updateMutation.isPending}
            onSave={handleSaveAdjustment}
            onItemSelect={handleFetchStockQty}
            formatCurrency={formatCurrency}
          />
        )}

        {/* Delete Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {adjustmentToDelete
                  ? t("deleteDescription", { code: adjustmentToDelete.adjustmentCode })
                  : ""}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                className="bg-destructive hover:bg-destructive/90"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? t("deleting") : tCommon("delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Post Dialog */}
        <AlertDialog open={postDialogOpen} onOpenChange={setPostDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("postTitle")}</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div>
                  <p>{adjustmentToPost ? t("postDescription", { code: adjustmentToPost.adjustmentCode }) : ""}</p>
                  <p className="mt-2">{t("summaryLabel")}:</p>
                  <ul className="mt-2 list-inside list-disc space-y-1">
                    <li>{t("postStepCreateTransaction")}</li>
                    <li>{t("postStepUpdateStock")}</li>
                    <li>{t("postStepUpdateLedger")}</li>
                  </ul>
                  <p className="mt-2">{t("postActionWarning")}</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmPost}
                className="bg-green-600 hover:bg-green-700"
                disabled={postMutation.isPending}
              >
                {postMutation.isPending ? t("posting") : t("postAction")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

    </>
  );
}
