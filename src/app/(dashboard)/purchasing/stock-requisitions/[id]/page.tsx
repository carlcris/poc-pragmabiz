"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Download, FileText, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusText } from "@/components/shared/StatusText";
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

const StockRequisitionFormDialog = dynamic(
  () =>
    import("@/components/stock-requisitions/StockRequisitionFormDialog").then(
      (mod) => mod.StockRequisitionFormDialog
    ),
  { ssr: false }
);

export default function StockRequisitionDetailPage() {
  const t = useTranslations("stockRequisitionDetailPage");
  const locale = useLocale();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;

  const { data: sr, isLoading, error } = useStockRequisition(id);
  const updateStatusMutation = useUpdateStockRequisitionStatus();
  const { formatCurrency } = useCurrency();

  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  useEffect(() => {
    setEditDialogOpen(searchParams.get("edit") === "true");
  }, [searchParams]);

  const updateEditSearchParam = (open: boolean) => {
    const nextParams = new URLSearchParams(searchParams.toString());

    if (open) {
      nextParams.set("edit", "true");
    } else {
      nextParams.delete("edit");
    }

    const query = nextParams.toString();
    router.replace(query ? `?${query}` : `/purchasing/stock-requisitions/${id}`, {
      scroll: false,
    });
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

  const getLabel = (key: string) => t(key).replace(/:$/, "");

  const handleSubmit = async () => {
    try {
      await updateStatusMutation.mutateAsync({ id, status: "submitted" });
      toast.success(t("submitSuccess"));
      setSubmitDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("submitError"));
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
    <div className="flex h-full flex-col gap-4 sm:gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight sm:text-xl">{t("title")}</h1>
          {isLoading && !sr ? (
            <Skeleton className="mt-1 h-4 w-40" />
          ) : (
            <p className="text-xs text-muted-foreground sm:text-sm">{sr?.srNumber || id}</p>
          )}
        </div>
        {sr && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button variant="outline" onClick={handleDownloadPDF}>
              <Download className="mr-2 h-4 w-4" />
              {t("downloadPdf")}
            </Button>
            {sr.status === "draft" && (
              <>
                <Button variant="outline" onClick={() => updateEditSearchParam(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  {t("edit")}
                </Button>
                <Button onClick={() => setSubmitDialogOpen(true)}>{t("send")}</Button>
              </>
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                {[1, 2].map((column) => (
                  <div key={column} className="space-y-4">
                    {[1, 2, 3, 4].map((row) => (
                      <div key={row} className="space-y-2">
                        <Skeleton className="h-3 w-28" />
                        <Skeleton className="h-5 w-52" />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((column) => (
                        <TableHead key={column}>
                          <Skeleton className="h-4 w-20" />
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[1, 2, 3].map((row) => (
                      <TableRow key={row}>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((column) => (
                          <TableCell key={column}>
                            <Skeleton className="h-5 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
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
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-3">
                  <div>
                    <span className="text-muted-foreground">{getLabel("status")}</span>
                    <div className="mt-1">{getStatusBadge(sr.status)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{getLabel("supplier")}</span>
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
                    <span className="text-muted-foreground">{getLabel("businessUnit")}</span>
                    <div className="font-medium">
                      {sr.businessUnit?.name || t("noValue")} ({sr.businessUnit?.code || t("noValue")})
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{getLabel("createdBy")}</span>
                    <div className="font-medium">{formatUser(sr.createdByUser)}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(sr.createdAt)}</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <span className="text-muted-foreground">{getLabel("requisitionDate")}</span>
                    <div className="font-medium">{formatDate(sr.requisitionDate)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{getLabel("requiredByDate")}</span>
                    <div className="font-medium">{formatDate(sr.requiredByDate)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{getLabel("totalAmount")}</span>
                    <div className="text-lg font-bold text-primary">
                      {formatCurrency(sr.totalAmount)}
                    </div>
                  </div>
                  {sr.notes && (
                    <div>
                      <span className="text-muted-foreground">{getLabel("notes")}</span>
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
                      <TableHead>{t("unitWithQtyPerUnitLabel")}</TableHead>
                      <TableHead className="text-right">{t("requestedQty")}</TableHead>
                      <TableHead className="text-right">{t("totalQtyLabel")}</TableHead>
                      <TableHead className="text-right">{t("fulfilledQty")}</TableHead>
                      <TableHead className="text-right">{t("outstandingQty")}</TableHead>
                      <TableHead className="text-right">{t("unitCostLabel")}</TableHead>
                      <TableHead className="text-right">{t("total")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sr.items && sr.items.length > 0 ? (
                      sr.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.item?.code}</TableCell>
                          <TableCell>{item.item?.name}</TableCell>
                          <TableCell>
                            <div className="font-medium">
                              {item.itemUnitOption?.displayLabel || item.uomCode || t("noValue")}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {t("qtyPerUnitInlineLabel", {
                                qty: (item.itemUnitOption?.qtyPerUnit ?? 1).toLocaleString(locale, {
                                  maximumFractionDigits: 4,
                                }),
                              })}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {item.requestedQty}
                          </TableCell>
                          <TableCell className="text-right">
                            {(item.requestedQty * (item.itemUnitOption?.qtyPerUnit ?? 1)).toLocaleString(locale, {
                              maximumFractionDigits: 4,
                            })}
                          </TableCell>
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
                        <TableCell colSpan={9} className="text-center text-muted-foreground">
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

      {sr ? (
        <StockRequisitionFormDialog
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            updateEditSearchParam(open);
          }}
          stockRequisition={sr}
        />
      ) : null}

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

    </div>
  );
}
