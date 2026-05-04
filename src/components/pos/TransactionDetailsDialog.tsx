"use client";

import { format } from "date-fns";
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
import type { POSTransaction } from "@/types/pos";

type TransactionDetailsDialogProps = {
  transaction: POSTransaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function TransactionDetailsDialog({
  transaction,
  open,
  onOpenChange,
}: TransactionDetailsDialogProps) {
  const t = useTranslations("posTransactionDetailsDialog");
  const locale = useLocale();

  if (!transaction) return null;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "PHP" }).format(amount);

  const formatDateTime = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMMM dd, yyyy hh:mm a");
    } catch {
      return dateString;
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === "completed")
      return <Badge className="bg-green-100 text-green-800">{t("completed")}</Badge>;
    if (status === "voided") return <Badge variant="secondary">{t("voided")}</Badge>;
    return <Badge>{status}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <DialogTitle>{t("title")}</DialogTitle>
            {getStatusBadge(transaction.status)}
          </div>
          <DialogDescription>
            {transaction.transactionNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Transaction Information */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="mb-3 text-sm font-semibold">{t("transactionInformation")}</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">{t("transactionNumber")}</span>
                  <div className="font-mono font-medium">{transaction.transactionNumber}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("dateTime")}</span>
                  <div className="font-medium">{formatDateTime(transaction.transactionDate)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("cashier")}</span>
                  <div className="font-medium">{transaction.cashierName}</div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold">{t("customerInformation")}</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">{t("customer")}</span>
                  <div className="font-medium">
                    {transaction.customerName || (
                      <span className="italic text-muted-foreground">{t("walkInCustomer")}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <hr className="border-t" />

          {/* Line Items */}
          <div>
            <h3 className="mb-3 text-sm font-semibold">{t("items")}</h3>
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-3 text-left">{t("item")}</th>
                    <th className="p-3 text-right">{t("quantity")}</th>
                    <th className="p-3 text-right">{t("unitPrice")}</th>
                    <th className="p-3 text-right">{t("discount")}</th>
                    <th className="p-3 text-right">{t("total")}</th>
                  </tr>
                </thead>
                <tbody>
                  {transaction.items.map((item, index) => (
                    <tr key={index} className="border-t">
                      <td className="p-3">
                        <div className="font-medium">{item.itemName}</div>
                        <div className="text-xs text-muted-foreground">{item.itemCode}</div>
                      </td>
                      <td className="p-3 text-right">{item.quantity}</td>
                      <td className="p-3 text-right">{formatCurrency(item.unitPrice)}</td>
                      <td className="p-3 text-right">
                        {item.discount > 0 ? `${item.discount}%` : t("notAvailable")}
                      </td>
                      <td className="p-3 text-right font-medium">
                        {formatCurrency(item.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <hr className="border-t" />

          {/* Summary */}
          <div className="flex justify-end">
            <div className="w-64 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("subtotal")}</span>
                <span className="font-medium">{formatCurrency(transaction.subtotal)}</span>
              </div>
              {transaction.totalDiscount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>{t("discount")}</span>
                  <span className="font-medium">-{formatCurrency(transaction.totalDiscount)}</span>
                </div>
              )}
              {transaction.totalTax > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("tax", { rate: transaction.taxRate })}
                  </span>
                  <span className="font-medium">{formatCurrency(transaction.totalTax)}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-2 text-lg font-bold">
                <span>{t("totalAmount")}</span>
                <span>{formatCurrency(transaction.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Payment Details */}
          <div>
            <h3 className="mb-3 text-sm font-semibold">{t("payment")}</h3>
            <div className="space-y-2 text-sm">
              {transaction.payments.map((payment, index) => (
                <div key={index} className="flex justify-between">
                  <span className="capitalize text-muted-foreground">{payment.method}</span>
                  <span className="font-medium">{formatCurrency(payment.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t pt-2">
                <span className="text-muted-foreground">{t("amountPaid")}</span>
                <span className="font-medium">{formatCurrency(transaction.amountPaid)}</span>
              </div>
              {transaction.changeAmount > 0 && (
                <div className="flex justify-between font-medium text-green-600">
                  <span>{t("change")}</span>
                  <span>{formatCurrency(transaction.changeAmount)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {transaction.notes && (
            <>
              <hr className="border-t" />
              <div>
                <h3 className="mb-2 text-sm font-semibold">{t("notes")}</h3>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {transaction.notes}
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("close")}
          </Button>
          <Button variant="default">
            <Printer className="mr-2 h-4 w-4" />
            {t("printReceipt")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
