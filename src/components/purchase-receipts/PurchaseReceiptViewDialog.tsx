"use client";

import { useLocale, useTranslations } from "next-intl";
import { Printer } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/hooks/useCurrency";
import type { PurchaseReceipt } from "@/types/purchase-receipt";

interface PurchaseReceiptViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receipt: PurchaseReceipt | null;
}

export function PurchaseReceiptViewDialog({
  open,
  onOpenChange,
  receipt,
}: PurchaseReceiptViewDialogProps) {
  const t = useTranslations("purchaseReceiptViewDialog");
  const locale = useLocale();
  const { formatCurrency } = useCurrency();

  if (!receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">{t("draft")}</Badge>;
      case "received":
        return (
          <Badge variant="default" className="bg-green-600">
            {t("receivedStatus")}
          </Badge>
        );
      case "cancelled":
        return <Badge variant="destructive">{t("cancelled")}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto print:max-h-none">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <DialogTitle>{t("title")}</DialogTitle>
            {getStatusBadge(receipt.status)}
          </div>
          <DialogDescription>{t("receiptCode", { code: receipt.receiptCode })}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Information */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="mb-3 text-sm font-semibold">{t("supplierInformation")}</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">{t("name")}</span>
                  <div className="font-medium">{receipt.supplier?.name}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("code")}</span>
                  <div className="font-medium">{receipt.supplier?.code}</div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold">{t("receiptDetails")}</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">{t("purchaseOrder")}</span>
                  <div className="font-medium">{receipt.purchaseOrder?.orderCode}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("receiptDate")}</span>
                  <div className="font-medium">{formatDate(receipt.receiptDate)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("batch")}</span>
                  <div className="font-medium">{receipt.batchSequenceNumber || t("noValue")}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("warehouse")}</span>
                  <div className="font-medium">
                    {receipt.warehouse?.code} - {receipt.warehouse?.name}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Supplier Invoice Details */}
          {(receipt.supplierInvoiceNumber || receipt.supplierInvoiceDate) && (
            <div>
              <h3 className="mb-3 text-sm font-semibold">{t("supplierInvoice")}</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {receipt.supplierInvoiceNumber && (
                  <div>
                    <span className="text-muted-foreground">{t("invoiceNumber")}</span>
                    <div className="font-medium">{receipt.supplierInvoiceNumber}</div>
                  </div>
                )}
                {receipt.supplierInvoiceDate && (
                  <div>
                    <span className="text-muted-foreground">{t("invoiceDate")}</span>
                    <div className="font-medium">{formatDate(receipt.supplierInvoiceDate)}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          <hr className="border-t" />

          {/* Line Items */}
          <div>
            <h3 className="mb-3 text-sm font-semibold">{t("receivedItems")}</h3>
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-3 text-left">{t("item")}</th>
                    <th className="p-3 text-right">{t("ordered")}</th>
                    <th className="p-3 text-right">{t("received")}</th>
                    <th className="p-3 text-center">{t("unit")}</th>
                    <th className="p-3 text-right">{t("rate")}</th>
                    <th className="p-3 text-right">{t("totalValue")}</th>
                  </tr>
                </thead>
                <tbody>
                  {receipt.items?.map((item, index) => {
                    const totalValue = item.quantityReceived * item.rate;

                    return (
                      <tr key={index} className="border-t">
                        <td className="p-3">
                          <div>
                            <div className="font-medium">{item.item?.name}</div>
                            <div className="text-xs text-muted-foreground">{item.item?.code}</div>
                          </div>
                        </td>
                        <td className="p-3 text-right">{item.quantityOrdered}</td>
                        <td className="p-3 text-right">
                          <span className="font-medium text-green-600">
                            {item.quantityReceived}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span className="text-muted-foreground">
                            {item.uom?.code || item.uom?.name || t("noUnit")}
                          </span>
                        </td>
                        <td className="p-3 text-right">{formatCurrency(item.rate)}</td>
                        <td className="p-3 text-right font-medium">{formatCurrency(totalValue)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <hr className="border-t" />

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-2 text-sm">
              <div className="flex justify-between border-t pt-2 text-lg font-bold">
                <span>{t("totalValue")}:</span>
                <span>
                  {formatCurrency(
                    receipt.items?.reduce((sum, item) => {
                      return sum + item.quantityReceived * item.rate;
                    }, 0) || 0
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {receipt.notes && (
            <>
              <hr className="border-t" />
              <div>
                <h3 className="mb-2 text-sm font-semibold">{t("notes")}</h3>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{receipt.notes}</p>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="print:hidden">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("close")}
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            {t("print")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
