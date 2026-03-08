"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Search, Eye, Filter, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { usePurchaseReceipts, useDeletePurchaseReceipt } from "@/hooks/usePurchaseReceipts";
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
import { PurchaseReceiptViewDialog } from "@/components/purchase-receipts/PurchaseReceiptViewDialog";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { useCurrency } from "@/hooks/useCurrency";
import type { PurchaseReceipt, PurchaseReceiptStatus } from "@/types/purchase-receipt";

export default function PurchaseReceiptsPage() {
  const t = useTranslations("purchaseReceiptsPage");
  const locale = useLocale();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState<PurchaseReceiptStatus | "all">("all");
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<PurchaseReceipt | null>(null);

  // Action dialogs
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [receiptForAction, setReceiptForAction] = useState<PurchaseReceipt | null>(null);

  const { formatCurrency } = useCurrency();
  const deleteMutation = useDeletePurchaseReceipt();

  const { data, isLoading, error } = usePurchaseReceipts({
    search,
    status: statusFilter !== "all" ? statusFilter : undefined,
    page,
    limit: pageSize,
  });

  const receipts = data?.data || [];
  const pagination = data?.pagination;

  const getErrorMessage = (err: unknown, fallback: string) =>
    err instanceof Error ? err.message : fallback;

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(value));

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">{t("draft")}</Badge>;
      case "received":
        return (
          <Badge variant="default" className="bg-green-600">
            {t("received")}
          </Badge>
        );
      case "cancelled":
        return <Badge variant="destructive">{t("cancelled")}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value as PurchaseReceiptStatus | "all");
    setPage(1);
  };

  const handleViewReceipt = (receipt: PurchaseReceipt) => {
    setSelectedReceipt(receipt);
    setViewDialogOpen(true);
  };

  const handleDeleteReceipt = (receipt: PurchaseReceipt) => {
    setReceiptForAction(receipt);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!receiptForAction) return;
    try {
      await deleteMutation.mutateAsync(receiptForAction.id);
      toast.success(t("deleteSuccess"));
      setDeleteDialogOpen(false);
      setReceiptForAction(null);
    } catch (err) {
      toast.error(getErrorMessage(err, t("deleteError")));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="mb-4 flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("searchPlaceholder")}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-8"
            />
          </div>
          <ClientOnly fallback={<Skeleton className="h-10 w-[200px]" />}>
            <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
              <SelectTrigger className="w-[200px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder={t("statusPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allStatus")}</SelectItem>
                <SelectItem value="draft">{t("draft")}</SelectItem>
                <SelectItem value="received">{t("received")}</SelectItem>
                <SelectItem value="cancelled">{t("cancelled")}</SelectItem>
              </SelectContent>
            </Select>
          </ClientOnly>
        </div>

        {isLoading ? (
          <div className="max-h-[calc(100vh-400px)] overflow-y-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead>{t("receiptCode")}</TableHead>
                  <TableHead>{t("purchaseOrder")}</TableHead>
                  <TableHead>{t("supplier")}</TableHead>
                  <TableHead>{t("warehouse")}</TableHead>
                  <TableHead>{t("batch")}</TableHead>
                  <TableHead>{t("receiptDate")}</TableHead>
                  <TableHead className="text-right">{t("totalValue")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
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
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="ml-auto h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
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
          <div className="py-8 text-center text-destructive">
            {t("loadError")}
          </div>
        ) : receipts.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            {t("emptyTitle")} {t("emptyDescription")}
          </div>
        ) : (
          <>
            <div className="max-h-[calc(100vh-400px)] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead>{t("receiptCode")}</TableHead>
                    <TableHead>{t("purchaseOrder")}</TableHead>
                    <TableHead>{t("supplier")}</TableHead>
                    <TableHead>{t("warehouse")}</TableHead>
                    <TableHead>{t("batch")}</TableHead>
                    <TableHead>{t("receiptDate")}</TableHead>
                    <TableHead className="text-right">{t("totalValue")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                    <TableHead className="text-right">{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receipts.map((receipt) => {
                    const totalValue =
                      receipt.items?.reduce((sum, item) => {
                        return sum + item.quantityReceived * item.rate;
                      }, 0) || 0;

                    return (
                      <TableRow key={receipt.id}>
                        <TableCell className="font-medium">
                          <div>{receipt.receiptCode}</div>
                          {receipt.batchSequenceNumber && (
                            <div className="text-xs text-muted-foreground">
                              {t("batchPrefix", { batch: receipt.batchSequenceNumber })}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-blue-600">
                            {receipt.purchaseOrder?.orderCode}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{receipt.supplier?.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {receipt.supplier?.code}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{receipt.warehouse?.code}</div>
                        </TableCell>
                        <TableCell>{receipt.batchSequenceNumber || t("noValue")}</TableCell>
                        <TableCell>
                          {formatDate(receipt.receiptDate)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(totalValue)}
                        </TableCell>
                        <TableCell>{getStatusBadge(receipt.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewReceipt(receipt)}
                              title={t("view")}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {receipt.status === "draft" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteReceipt(receipt)}
                                title={t("delete")}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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

      {/* View Dialog */}
      <PurchaseReceiptViewDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        receipt={selectedReceipt}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDescription", { code: receiptForAction?.receiptCode ?? "" })}
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
