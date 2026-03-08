"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import {
  Plus,
  Search,
  Pencil,
  Filter,
  Eye,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  ShoppingCart,
} from "lucide-react";
import { useQuotations, useConvertToOrder, useChangeQuotationStatus } from "@/hooks/useQuotations";
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
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { useCurrency } from "@/hooks/useCurrency";
import { useRouter } from "next/navigation";
import type { Quotation, QuotationStatus } from "@/types/quotation";

const QuotationFormDialog = dynamic(
  () => import("@/components/quotations/QuotationFormDialog").then((mod) => mod.QuotationFormDialog),
  { ssr: false }
);
const QuotationViewDialog = dynamic(
  () => import("@/components/quotations/QuotationViewDialog").then((mod) => mod.QuotationViewDialog),
  { ssr: false }
);

export default function QuotationsPage() {
  const t = useTranslations("quotationsPage");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [quotationToConvert, setQuotationToConvert] = useState<Quotation | null>(null);

  const { formatCurrency } = useCurrency();
  const router = useRouter();
  const convertToOrder = useConvertToOrder();
  const changeStatus = useChangeQuotationStatus();

  const { data, isLoading, error } = useQuotations({
    search,
    status: statusFilter as QuotationStatus | "all",
    page,
    limit: pageSize,
  });

  const quotations = data?.data || [];
  const pagination = data?.pagination;

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const getStatusIcon = (status: QuotationStatus) => {
    switch (status) {
      case "draft":
        return <FileText className="h-4 w-4 text-gray-600" />;
      case "sent":
        return <Send className="h-4 w-4 text-blue-600" />;
      case "accepted":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "rejected":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "expired":
        return <Clock className="h-4 w-4 text-orange-600" />;
      case "ordered":
        return <ShoppingCart className="h-4 w-4 text-purple-600" />;
    }
  };

  const getStatusBadge = (status: QuotationStatus) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">{t("draft")}</Badge>;
      case "sent":
        return (
          <Badge variant="default" className="bg-blue-600">
            {t("sent")}
          </Badge>
        );
      case "accepted":
        return (
          <Badge variant="default" className="bg-green-600">
            {t("accepted")}
          </Badge>
        );
      case "rejected":
        return <Badge variant="destructive">{t("rejected")}</Badge>;
      case "expired":
        return (
          <Badge variant="secondary" className="bg-orange-100 text-orange-800">
            {t("expired")}
          </Badge>
        );
      case "ordered":
        return (
          <Badge variant="default" className="bg-purple-600">
            {t("ordered")}
          </Badge>
        );
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
    setPage(1);
  };

  const handleCreateQuotation = () => {
    setSelectedQuotation(null);
    setDialogOpen(true);
  };

  const handleEditQuotation = (quotation: Quotation) => {
    setSelectedQuotation(quotation);
    setDialogOpen(true);
  };

  const handleViewQuotation = (quotation: Quotation) => {
    setSelectedQuotation(quotation);
    setViewDialogOpen(true);
  };

  const handleConvertToOrder = (quotation: Quotation) => {
    setQuotationToConvert(quotation);
    setConvertDialogOpen(true);
  };

  const handleConfirmConvert = async () => {
    if (!quotationToConvert) return;

    try {
      await convertToOrder.mutateAsync(quotationToConvert.id);
      setConvertDialogOpen(false);
      setQuotationToConvert(null);

      // Navigate to sales orders page or show success message
      router.push(`/sales/orders`);
    } catch {
      // Error is handled by the mutation hook with toast
      setConvertDialogOpen(false);
      setQuotationToConvert(null);
    }
  };

  const handleChangeStatus = async (quotationId: string, newStatus: string) => {
    try {
      await changeStatus.mutateAsync({ id: quotationId, status: newStatus });
    } catch {
      // Error is handled by the mutation hook with toast
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
              <SelectItem value="rejected">{t("rejected")}</SelectItem>
              <SelectItem value="expired">{t("expired")}</SelectItem>
              <SelectItem value="ordered">{t("ordered")}</SelectItem>
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
                    <TableRow key={quotation.id}>
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
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewQuotation(quotation)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {(quotation.status === "draft" || quotation.status === "sent") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditQuotation(quotation)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canChangeStatus(quotation.status) && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={changeStatus.isPending}
                                >
                                  {t("changeStatus")}
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
                                      {status.label}
                                    </DropdownMenuItem>
                                  );
                                })}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                          {quotation.status === "accepted" && !quotation.salesOrderId && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleConvertToOrder(quotation)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <ShoppingCart className="mr-1 h-4 w-4" />
                              {t("convertToOrder")}
                            </Button>
                          )}
                          {quotation.salesOrderId && (
                            <Badge variant="outline" className="text-xs">
                              {t("converted")}
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
        <QuotationFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          quotation={selectedQuotation}
        />
      )}

      {viewDialogOpen && (
        <QuotationViewDialog
          open={viewDialogOpen}
          onOpenChange={setViewDialogOpen}
          quotation={selectedQuotation}
        />
      )}

      <AlertDialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("convertTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("convertDescription", { number: quotationToConvert?.quotationNumber ?? "" })}
            </AlertDialogDescription>
            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              <p>{t("convertWillLabel")}</p>
              <ul className="ml-2 list-inside list-disc space-y-1">
                <li>{t("convertBulletCreateOrder")}</li>
                <li>{t("convertBulletCopyItems")}</li>
                <li>{t("convertBulletStatus")}</li>
                <li>{t("convertBulletLink")}</li>
              </ul>
              <p className="font-medium">{t("convertCannotUndo")}</p>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmConvert}
              className="bg-green-600 hover:bg-green-700"
              disabled={convertToOrder.isPending}
            >
              {convertToOrder.isPending ? t("converting") : t("convertAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
