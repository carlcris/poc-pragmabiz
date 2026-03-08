"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import {
  Plus,
  Search,
  Eye,
  Filter,
  CheckCircle,
  XCircle,
  Pencil,
  Trash2,
  Send,
  Package,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import {
  usePurchaseOrders,
  useDeletePurchaseOrder,
  useSubmitPurchaseOrder,
  useApprovePurchaseOrder,
  useCancelPurchaseOrder,
  useCompletePurchaseOrder,
} from "@/hooks/usePurchaseOrders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { useCurrency } from "@/hooks/useCurrency";
import type { PurchaseOrder, PurchaseOrderStatus } from "@/types/purchase-order";

const PurchaseOrderFormDialog = dynamic(
  () =>
    import("@/components/purchase-orders/PurchaseOrderFormDialog").then(
      (mod) => mod.PurchaseOrderFormDialog
    ),
  { ssr: false }
);
const PurchaseOrderViewDialog = dynamic(
  () =>
    import("@/components/purchase-orders/PurchaseOrderViewDialog").then(
      (mod) => mod.PurchaseOrderViewDialog
    ),
  { ssr: false }
);
const ReceiveGoodsDialog = dynamic(
  () => import("@/components/purchase-receipts/ReceiveGoodsDialog").then((mod) => mod.ReceiveGoodsDialog),
  { ssr: false }
);

export default function PurchaseOrdersPage() {
  const t = useTranslations("purchaseOrdersPage");
  const locale = useLocale();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus | "all">("all");
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [receiveGoodsDialogOpen, setReceiveGoodsDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);

  // Action dialogs
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderForAction, setOrderForAction] = useState<PurchaseOrder | null>(null);

  const { formatCurrency } = useCurrency();
  const deleteMutation = useDeletePurchaseOrder();
  const submitMutation = useSubmitPurchaseOrder();
  const approveMutation = useApprovePurchaseOrder();
  const cancelMutation = useCancelPurchaseOrder();
  const completeMutation = useCompletePurchaseOrder();

  const { data, isLoading, error } = usePurchaseOrders({
    search,
    status: statusFilter !== "all" ? statusFilter : undefined,
    page,
    limit: pageSize,
  });

  const orders = data?.data || [];
  const pagination = data?.pagination;

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

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
      case "submitted":
        return (
          <Badge variant="default" className="bg-blue-600">
            {t("submitted")}
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="default" className="bg-green-600">
            {t("approved")}
          </Badge>
        );
      case "in_transit":
        return (
          <Badge variant="default" className="bg-purple-600">
            {t("inTransit")}
          </Badge>
        );
      case "partially_received":
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            {t("partiallyReceived")}
          </Badge>
        );
      case "received":
        return (
          <Badge variant="default" className="bg-green-700">
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
    setStatusFilter(value as PurchaseOrderStatus | "all");
    setPage(1);
  };

  const handleCreateOrder = () => {
    setSelectedOrder(null);
    setFormDialogOpen(true);
  };

  const handleEditOrder = (order: PurchaseOrder) => {
    setSelectedOrder(order);
    setFormDialogOpen(true);
  };

  const handleViewOrder = (order: PurchaseOrder) => {
    setSelectedOrder(order);
    setViewDialogOpen(true);
  };

  const handleSubmitOrder = (order: PurchaseOrder) => {
    setOrderForAction(order);
    setSubmitDialogOpen(true);
  };

  const handleApproveOrder = (order: PurchaseOrder) => {
    setOrderForAction(order);
    setApproveDialogOpen(true);
  };

  const handleCancelOrder = (order: PurchaseOrder) => {
    setOrderForAction(order);
    setCancelDialogOpen(true);
  };

  const handleCompleteOrder = (order: PurchaseOrder) => {
    setOrderForAction(order);
    setCompleteDialogOpen(true);
  };

  const handleDeleteOrder = (order: PurchaseOrder) => {
    setOrderForAction(order);
    setDeleteDialogOpen(true);
  };

  const handleReceiveGoods = (order: PurchaseOrder) => {
    setSelectedOrder(order);
    setReceiveGoodsDialogOpen(true);
  };

  const confirmSubmit = async () => {
    if (!orderForAction) return;
    try {
      await submitMutation.mutateAsync(orderForAction.id);
      toast.success(t("submitSuccess"));
      setSubmitDialogOpen(false);
      setOrderForAction(null);
    } catch (err) {
      toast.error(getErrorMessage(err, t("submitError")));
    }
  };

  const confirmApprove = async () => {
    if (!orderForAction) return;
    try {
      await approveMutation.mutateAsync(orderForAction.id);
      toast.success(t("approveSuccess"));
      setApproveDialogOpen(false);
      setOrderForAction(null);
    } catch (err) {
      toast.error(getErrorMessage(err, t("approveError")));
    }
  };

  const confirmCancel = async () => {
    if (!orderForAction) return;
    try {
      await cancelMutation.mutateAsync(orderForAction.id);
      toast.success(t("cancelSuccess"));
      setCancelDialogOpen(false);
      setOrderForAction(null);
    } catch (err) {
      toast.error(getErrorMessage(err, t("cancelError")));
    }
  };

  const confirmComplete = async () => {
    if (!orderForAction) return;
    try {
      await completeMutation.mutateAsync(orderForAction.id);
      toast.success(t("completeSuccess"));
      setCompleteDialogOpen(false);
      setOrderForAction(null);
    } catch (err) {
      toast.error(getErrorMessage(err, t("completeError")));
    }
  };

  const confirmDelete = async () => {
    if (!orderForAction) return;
    try {
      await deleteMutation.mutateAsync(orderForAction.id);
      toast.success(t("deleteSuccess"));
      setDeleteDialogOpen(false);
      setOrderForAction(null);
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
        <Button onClick={handleCreateOrder}>
          <Plus className="mr-2 h-4 w-4" />
          {t("createAction")}
        </Button>
      </div>

      <div className="space-y-4">
        <div className="mb-4 flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("searchPlaceholder")}
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
              }}
              className="pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
            <SelectTrigger className="w-[200px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder={t("statusPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allStatus")}</SelectItem>
              <SelectItem value="draft">{t("draft")}</SelectItem>
              <SelectItem value="submitted">{t("submitted")}</SelectItem>
              <SelectItem value="approved">{t("approved")}</SelectItem>
              <SelectItem value="in_transit">{t("inTransit")}</SelectItem>
              <SelectItem value="partially_received">{t("partiallyReceived")}</SelectItem>
              <SelectItem value="received">{t("received")}</SelectItem>
              <SelectItem value="cancelled">{t("cancelled")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="py-8 text-center text-destructive">
            {t("loadError")}
          </div>
        ) : orders.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            {t("emptyTitle")} {t("emptyDescription")}
          </div>
        ) : (
          <>
            <div className="max-h-[calc(100vh-400px)] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead>{t("poNumber")}</TableHead>
                    <TableHead>{t("supplier")}</TableHead>
                    <TableHead>{t("orderDate")}</TableHead>
                    <TableHead>{t("expectedDelivery")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                    <TableHead className="text-right">{t("totalAmount")}</TableHead>
                    <TableHead className="text-right">{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.orderCode}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{order.supplier?.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {order.supplier?.code}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(order.orderDate)}</TableCell>
                      <TableCell>
                        {formatDate(order.expectedDeliveryDate)}
                      </TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(order.totalAmount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewOrder(order)}
                            title={t("view")}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {order.status === "draft" && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditOrder(order)}
                                title={t("edit")}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSubmitOrder(order)}
                                title={t("submit")}
                              >
                                <Send className="h-4 w-4 text-blue-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteOrder(order)}
                                title={t("delete")}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {order.status === "submitted" && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleApproveOrder(order)}
                                title={t("approve")}
                              >
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCancelOrder(order)}
                                title={t("cancel")}
                              >
                                <XCircle className="h-4 w-4 text-red-600" />
                              </Button>
                            </>
                          )}
                          {(order.status === "approved" ||
                            order.status === "in_transit" ||
                            order.status === "partially_received") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleReceiveGoods(order)}
                              title={t("receiveGoods")}
                            >
                              <Package className="h-4 w-4 text-purple-600" />
                            </Button>
                          )}
                          {order.status === "partially_received" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCompleteOrder(order)}
                              title={t("complete")}
                            >
                              <Check className="h-4 w-4 text-emerald-600" />
                            </Button>
                          )}
                          {order.status !== "draft" &&
                            order.status !== "submitted" &&
                            order.status !== "received" &&
                            order.status !== "cancelled" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCancelOrder(order)}
                                title={t("cancel")}
                              >
                                <XCircle className="h-4 w-4 text-red-600" />
                              </Button>
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

      {/* Form Dialog */}
      {formDialogOpen && (
        <PurchaseOrderFormDialog
          open={formDialogOpen}
          onOpenChange={setFormDialogOpen}
          purchaseOrder={selectedOrder}
        />
      )}

      {/* View Dialog */}
      {viewDialogOpen && (
        <PurchaseOrderViewDialog
          open={viewDialogOpen}
          onOpenChange={setViewDialogOpen}
          purchaseOrder={selectedOrder}
        />
      )}

      {/* Receive Goods Dialog */}
      {receiveGoodsDialogOpen && (
        <ReceiveGoodsDialog
          open={receiveGoodsDialogOpen}
          onOpenChange={setReceiveGoodsDialogOpen}
          purchaseOrder={selectedOrder}
        />
      )}

      {/* Submit Confirmation Dialog */}
      <AlertDialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("submitTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("submitDescription", { code: orderForAction?.orderCode ?? "" })}
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

      {/* Approve Confirmation Dialog */}
      <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("approveTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("approveDescription", { code: orderForAction?.orderCode ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmApprove}
              disabled={approveMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {approveMutation.isPending ? t("approving") : t("approve")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("cancelTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("cancelDescription", { code: orderForAction?.orderCode ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("goBack")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCancel}
              disabled={cancelMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelMutation.isPending ? t("cancelling") : t("cancelOrder")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Complete Confirmation Dialog */}
      <AlertDialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("completeTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("completeDescription", { code: orderForAction?.orderCode ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("goBack")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmComplete}
              disabled={completeMutation.isPending}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {completeMutation.isPending ? t("completing") : t("complete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDescription", { code: orderForAction?.orderCode ?? "" })}
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
