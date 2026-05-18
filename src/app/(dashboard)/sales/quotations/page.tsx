"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import {
  Plus,
  Search,
  Pencil,
  Filter,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  MoreVertical,
} from "lucide-react";
import { toast } from "sonner";
import {
  useQuotations,
  useChangeQuotationStatus,
  useConfirmQuotation,
} from "@/hooks/useQuotations";
import { quotationsApi } from "@/lib/api/quotations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatusText } from "@/components/shared/StatusText";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useCurrency } from "@/hooks/useCurrency";
import { useRouter } from "next/navigation";
import type { Quotation, QuotationStatus } from "@/types/quotation";

const QuotationViewDialog = dynamic(
  () =>
    import("@/components/quotations/QuotationViewDialog").then((mod) => mod.QuotationViewDialog),
  { ssr: false }
);

export default function QuotationsPage() {
  const t = useTranslations("quotationsPage");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadedQuotations, setLoadedQuotations] = useState<Quotation[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [quotationToConfirm, setQuotationToConfirm] = useState<Quotation | null>(null);

  const { formatCurrency } = useCurrency();
  const router = useRouter();
  const changeStatus = useChangeQuotationStatus();
  const confirmQuotation = useConfirmQuotation();

  const { data, isLoading, isFetching, error } = useQuotations({
    search,
    status: statusFilter as QuotationStatus | "all",
    cursor,
    limit: pageSize,
  });

  const quotations = loadedQuotations;
  const pagination = data?.pagination;

  useEffect(() => {
    const nextSearch = searchInput.trim();
    if (nextSearch === search) return;

    const timeout = window.setTimeout(() => {
      setSearch(nextSearch);
      setCursor(null);
      setLoadedQuotations([]);
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [searchInput, search]);

  useEffect(() => {
    if (!data) return;

    setLoadedQuotations((current) => {
      const nextRows = cursor ? [...current, ...data.data] : data.data;
      const rowsById = new Map(nextRows.map((quotation) => [quotation.id, quotation]));
      return Array.from(rowsById.values());
    });
  }, [cursor, data]);

  const getStatusIcon = (status: QuotationStatus) => {
    switch (status) {
      case "draft":
        return <FileText className="h-4 w-4 text-gray-600" />;
      case "sent":
        return <Send className="h-4 w-4 text-blue-600" />;
      case "accepted":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "partially_ordered":
        return <Clock className="h-4 w-4 text-amber-600" />;
      case "rejected":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "expired":
        return <Clock className="h-4 w-4 text-orange-600" />;
      case "ordered":
        return <CheckCircle className="h-4 w-4 text-purple-600" />;
    }
  };

  const getStatusBadge = (status: QuotationStatus) => {
    switch (status) {
      case "draft":
        return <StatusText tone="muted">{t("draft")}</StatusText>;
      case "sent":
        return <StatusText tone="blue">{t("sent")}</StatusText>;
      case "accepted":
        return <StatusText tone="green">{t("accepted")}</StatusText>;
      case "partially_ordered":
        return <StatusText tone="orange">{t("partiallyOrdered")}</StatusText>;
      case "rejected":
        return <StatusText tone="red">{t("rejected")}</StatusText>;
      case "expired":
        return <StatusText tone="orange">{t("expired")}</StatusText>;
      case "ordered":
        return <StatusText tone="purple">{t("ordered")}</StatusText>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const isExpiringSoon = (validUntil: string) => {
    const daysUntilExpiry = Math.ceil(
      (new Date(validUntil).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setCursor(null);
    setLoadedQuotations([]);
  };

  const handlePageSizeChange = (value: string) => {
    setPageSize(Number(value));
    setCursor(null);
    setLoadedQuotations([]);
  };

  const handleCreateQuotation = () => {
    router.push("/sales/quotations/create");
  };

  const loadFullQuotation = async (quotation: Quotation) => {
    try {
      return await quotationsApi.getQuotation(quotation.id);
    } catch (fetchError) {
      toast.error(
        fetchError instanceof Error ? fetchError.message : "Failed to load quotation details"
      );
      return null;
    }
  };

  const handleEditQuotation = (quotation: Quotation) => {
    router.push(`/sales/quotations/${quotation.id}/edit`);
  };

  const handleViewQuotation = async (quotation: Quotation) => {
    const fullQuotation = await loadFullQuotation(quotation);
    if (!fullQuotation) return;

    setSelectedQuotation(fullQuotation);
    setViewDialogOpen(true);
  };

  const handleChangeStatus = async (quotationId: string, newStatus: string) => {
    if (newStatus === "accepted") {
      const quotation = quotations.find((candidate) => candidate.id === quotationId) || null;
      setQuotationToConfirm(quotation);
      setConfirmDialogOpen(true);
      return;
    }

    try {
      await changeStatus.mutateAsync({ id: quotationId, status: newStatus });
      toast.success("Quotation status updated successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update quotation status");
    }
  };

  const handleConfirmQuotation = async () => {
    if (!quotationToConfirm) return;

    try {
      await confirmQuotation.mutateAsync({
        id: quotationToConfirm.id,
        warehouseId: null,
      });
      toast.success("Quotation confirmed");
      setConfirmDialogOpen(false);
      setQuotationToConfirm(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to confirm quotation");
    }
  };

  const canChangeStatus = (status: string) => {
    return status === "draft" || status === "sent";
  };

  const getAvailableStatuses = (currentStatus: string) => {
    const statuses = [];

    if (currentStatus === "draft") {
      statuses.push({ value: "sent", label: t("markAsSent"), icon: Send });
      statuses.push({ value: "accepted", label: t("markAsAccepted"), icon: CheckCircle });
      statuses.push({ value: "rejected", label: t("markAsRejected"), icon: XCircle });
    } else if (currentStatus === "sent") {
      statuses.push({ value: "accepted", label: t("markAsAccepted"), icon: CheckCircle });
      statuses.push({ value: "rejected", label: t("markAsRejected"), icon: XCircle });
    }

    return statuses;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button onClick={handleCreateQuotation}>
          <Plus className="mr-2 h-4 w-4" />
          {t("createQuotation")}
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
            <SelectTrigger className="w-[180px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder={tCommon("status")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tCommon("allStatuses")}</SelectItem>
              <SelectItem value="draft">{t("draft")}</SelectItem>
              <SelectItem value="sent">{t("sent")}</SelectItem>
              <SelectItem value="accepted">{t("accepted")}</SelectItem>
              <SelectItem value="partially_ordered">{t("partiallyOrdered")}</SelectItem>
              <SelectItem value="rejected">{t("rejected")}</SelectItem>
              <SelectItem value="expired">{t("expired")}</SelectItem>
              <SelectItem value="ordered">{t("ordered")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <div>
            {pagination
              ? t("itemsCount", { count: String(pagination.total) })
              : t("itemsCount", { count: "0" })}
          </div>
          <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading && quotations.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="py-8 text-center text-destructive">{t("loadError")}</div>
        ) : quotations.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">{t("empty")}</div>
        ) : (
          <>
            <div className="max-h-[calc(100vh-400px)] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead>{t("quotationNumber")}</TableHead>
                    <TableHead>{tCommon("customer")}</TableHead>
                    <TableHead>{t("date")}</TableHead>
                    <TableHead>{t("validUntil")}</TableHead>
                    <TableHead className="text-right">{t("amount")}</TableHead>
                    <TableHead>{tCommon("status")}</TableHead>
                    <TableHead className="text-right">{tCommon("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotations.map((quotation) => (
                    <TableRow
                      key={quotation.id}
                      role="button"
                      tabIndex={0}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleViewQuotation(quotation)}
                      onKeyDown={(event) => {
                        if (event.currentTarget !== event.target) return;
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          handleViewQuotation(quotation);
                        }
                      }}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(quotation.status)}
                          {quotation.quotationNumber}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{quotation.customerName}</div>
                        <div className="text-xs text-muted-foreground">
                          {quotation.customerEmail}
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(quotation.quotationDate)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {formatDate(quotation.validUntil)}
                          {isExpiringSoon(quotation.validUntil) && quotation.status === "sent" && (
                            <Badge
                              variant="secondary"
                              className="bg-yellow-100 text-xs text-yellow-800"
                            >
                              {t("expiringSoon")}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-medium">{formatCurrency(quotation.totalAmount)}</div>
                        <div className="text-xs text-muted-foreground">
                          {t("itemsCount", { count: String(quotation.lineItems.length) })}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(quotation.status)}</TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div className="flex justify-end gap-2">
                          {(quotation.status === "draft" || quotation.status === "sent") && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2"
                              onClick={() => handleEditQuotation(quotation)}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              <span>{tCommon("edit")}</span>
                            </Button>
                          )}
                          {canChangeStatus(quotation.status) && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  disabled={changeStatus.isPending}
                                  aria-label={t("changeStatus")}
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {getAvailableStatuses(quotation.status).map((status) => {
                                  const Icon = status.icon;
                                  return (
                                    <DropdownMenuItem
                                      key={status.value}
                                      onClick={() => handleChangeStatus(quotation.id, status.value)}
                                    >
                                      <Icon className="mr-2 h-4 w-4" />
                                      <span>{status.label}</span>
                                    </DropdownMenuItem>
                                  );
                                })}
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

            {pagination?.hasMore && (
              <div className="mt-4 flex justify-center">
                <Button
                  variant="outline"
                  onClick={() => setCursor(pagination.nextCursor)}
                  disabled={isFetching || !pagination.nextCursor}
                >
                  {isFetching ? tCommon("loading") : tCommon("loadMore")}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {viewDialogOpen && (
        <QuotationViewDialog
          open={viewDialogOpen}
          onOpenChange={setViewDialogOpen}
          quotation={selectedQuotation}
        />
      )}

      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm quotation</AlertDialogTitle>
            <AlertDialogDescription>
              Confirming {quotationToConfirm?.quotationNumber ?? "this quotation"} will mark the
              quotation as accepted. Sales orders are created manually from the sales order module.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmQuotation}
              disabled={confirmQuotation.isPending}
            >
              {confirmQuotation.isPending ? "Confirming..." : "Confirm quotation"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
