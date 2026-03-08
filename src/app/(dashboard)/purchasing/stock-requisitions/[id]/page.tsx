"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, FileText, Pencil, Download } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  useStockRequisition,
  useUpdateStockRequisitionStatus,
} from "@/hooks/useStockRequisitions";
import { useCurrency } from "@/hooks/useCurrency";
import type { StockRequisitionStatus } from "@/types/stock-requisition";

export default function StockRequisitionDetailPage() {
  const t = useTranslations("stockRequisitionDetailPage");
  const locale = useLocale();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: sr, isLoading, error } = useStockRequisition(id);
  const updateStatusMutation = useUpdateStockRequisitionStatus();
  const { formatCurrency } = useCurrency();

  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const getStatusBadge = (status: StockRequisitionStatus) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">{t("draft")}</Badge>;
      case "submitted":
        return (
          <Badge
            variant="outline"
            className="border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-400"
          >
            {t("submitted")}
          </Badge>
        );
      case "partially_fulfilled":
        return (
          <Badge
            variant="outline"
            className="border-yellow-600 text-yellow-700 dark:border-yellow-400 dark:text-yellow-400"
          >
            {t("partiallyFulfilled")}
          </Badge>
        );
      case "fulfilled":
        return (
          <Badge
            variant="outline"
            className="border-green-600 text-green-700 dark:border-green-400 dark:text-green-400"
          >
            {t("fulfilled")}
          </Badge>
        );
      case "cancelled":
        return <Badge variant="destructive">{t("cancelled")}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleSubmit = async () => {
    try {
      await updateStatusMutation.mutateAsync({ id, status: "submitted" });
      toast.success(t("submitSuccess"));
      setSubmitDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("submitError"));
    }
  };

  const handleCancel = async () => {
    try {
      await updateStatusMutation.mutateAsync({ id, status: "cancelled" });
      toast.success(t("cancelSuccess"));
      setCancelDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("cancelError"));
    }
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return t("noValue");
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(new Date(dateString));
  };

  const formatUser = (user?: {
    firstName?: string;
    lastName?: string;
    email?: string;
  }) => {
    if (!user) return t("noValue");
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
    return fullName || user.email || t("noValue");
  };

  const handleDownloadPDF = async () => {
    if (!sr) return;

    try {
      const { generateStockRequisitionPDF } = await import("@/lib/pdf-generator");
      const supplierLanguage = sr.supplier?.lang === "chinese" ? "chinese" : "english";
      await generateStockRequisitionPDF({
        language: supplierLanguage,
        srNumber: sr.srNumber,
        supplierName: sr.supplier?.name || t("unknownSupplier"),
        requisitionDate: formatDate(sr.requisitionDate),
        requiredByDate: sr.requiredByDate ? formatDate(sr.requiredByDate) : undefined,
        totalAmount: formatCurrency(sr.totalAmount),
        items: (sr.items || []).map((item) => ({
          itemCode: item.item?.code || t("na"),
          itemName:
            supplierLanguage === "chinese"
              ? item.item?.chineseName || item.item?.name || t("unknownItem")
              : item.item?.name || t("unknownItem"),
          requestedQty: item.requestedQty,
          unitPrice: formatCurrency(item.unitPrice),
          totalPrice: formatCurrency(item.totalPrice),
        })),
        notes: sr.notes || undefined,
        createdBy: formatUser(sr.createdByUser),
        businessUnit: sr.businessUnit?.name
          ? `${sr.businessUnit.name} (${sr.businessUnit.code || ""})`
          : undefined,
      });
      toast.success(t("pdfSuccess"));
    } catch (error) {
      console.error("Failed to generate PDF:", error);
      toast.error(t("pdfError"));
    }
  };

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{t("title")}</h1>
            <p className="text-muted-foreground">{sr?.srNumber || id}</p>
          </div>
        </div>
        {sr && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={handleDownloadPDF}>
              <Download className="mr-2 h-4 w-4" />
              {t("downloadPdf")}
            </Button>
            {sr.status === "draft" && (
              <>
                <Button variant="outline" onClick={() => router.push(`?edit=true`)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  {t("edit")}
                </Button>
                <Button onClick={() => setSubmitDialogOpen(true)}>{t("send")}</Button>
              </>
            )}
            {sr.status !== "cancelled" && sr.status !== "fulfilled" && (
              <Button
                variant="destructive"
                onClick={() => setCancelDialogOpen(true)}
                disabled={updateStatusMutation.isPending}
              >
                {t("cancel")}
              </Button>
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="h-24 animate-pulse rounded bg-muted" />
          <div className="h-64 animate-pulse rounded bg-muted" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-8 text-center text-destructive">
            {t("loadError")}
          </CardContent>
        </Card>
      ) : !sr ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {t("notFound")}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Header Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {t("requisitionDetails")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-sm">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div>
                    <span className="text-muted-foreground">{t("status")}</span>
                    <div className="mt-1">{getStatusBadge(sr.status)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("supplier")}</span>
                    <div className="font-medium">
                      {sr.supplier?.name} ({sr.supplier?.code})
                    </div>
                    {sr.supplier?.contactPerson && (
                      <div className="text-xs text-muted-foreground">
                        {t("contact")} {sr.supplier.contactPerson}
                      </div>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("businessUnit")}</span>
                    <div className="font-medium">
                      {sr.businessUnit?.name || t("noValue")} ({sr.businessUnit?.code || t("noValue")})
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("createdBy")}</span>
                    <div className="font-medium">{formatUser(sr.createdByUser)}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(sr.createdAt)}</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <span className="text-muted-foreground">{t("requisitionDate")}</span>
                    <div className="font-medium">{formatDate(sr.requisitionDate)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("requiredByDate")}</span>
                    <div className="font-medium">{formatDate(sr.requiredByDate)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("totalAmount")}</span>
                    <div className="text-lg font-bold text-primary">
                      {formatCurrency(sr.totalAmount)}
                    </div>
                  </div>
                  {sr.notes && (
                    <div>
                      <span className="text-muted-foreground">{t("notes")}</span>
                      <div className="font-medium">{sr.notes}</div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader>
              <CardTitle>{t("lineItems")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("itemCode")}</TableHead>
                      <TableHead>{t("itemName")}</TableHead>
                      <TableHead className="text-right">{t("requestedQty")}</TableHead>
                      <TableHead className="text-right">{t("fulfilledQty")}</TableHead>
                      <TableHead className="text-right">{t("outstandingQty")}</TableHead>
                      <TableHead className="text-right">{t("unitPrice")}</TableHead>
                      <TableHead className="text-right">{t("total")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sr.items && sr.items.length > 0 ? (
                      sr.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.item?.code}</TableCell>
                          <TableCell>{item.item?.name}</TableCell>
                          <TableCell className="text-right">{item.requestedQty}</TableCell>
                          <TableCell className="text-right">
                            <span
                              className={item.fulfilledQty > 0 ? "text-green-600 font-medium" : ""}
                            >
                              {item.fulfilledQty}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={
                                item.outstandingQty > 0 ? "text-orange-600 font-medium" : ""
                              }
                            >
                              {item.outstandingQty}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.unitPrice)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(item.totalPrice)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          {t("noLineItems")}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Submit Confirmation Dialog */}
      <AlertDialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("sendTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("sendDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <Button onClick={handleSubmit} disabled={updateStatusMutation.isPending}>
              {updateStatusMutation.isPending ? t("sending") : t("send")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("cancelTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("cancelDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancelBack")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={updateStatusMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {updateStatusMutation.isPending ? t("cancelling") : t("confirmCancel")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
