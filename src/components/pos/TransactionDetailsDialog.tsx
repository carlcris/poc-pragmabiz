"use client";

import { format } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import { Printer } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { POSTransaction } from "@/types/pos";

type TransactionDetailsDialogProps = {
  transaction: POSTransaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function TransactionDetailsDialog({ transaction, open, onOpenChange }: TransactionDetailsDialogProps) {
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
    if (status === "completed") return <Badge className="bg-green-100 text-green-800">{t("completed")}</Badge>;
    if (status === "voided") return <Badge variant="secondary">{t("voided")}</Badge>;
    return <Badge>{status}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{t("title")}</DialogTitle>
            <Button variant="outline" size="sm">
              <Printer className="mr-2 h-4 w-4" />
              {t("printReceipt")}
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">{t("transactionNumber")}</div>
              <div className="font-mono font-medium">{transaction.transactionNumber}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">{t("dateTime")}</div>
              <div className="font-medium">{formatDateTime(transaction.transactionDate)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">{t("cashier")}</div>
              <div className="font-medium">{transaction.cashierName}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">{t("customer")}</div>
              <div className="font-medium">
                {transaction.customerName || <span className="italic text-muted-foreground">{t("walkInCustomer")}</span>}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">{t("status")}</div>
              <div>{getStatusBadge(transaction.status)}</div>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="mb-3 font-semibold">{t("items")}</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("item")}</TableHead>
                  <TableHead className="text-right">{t("quantity")}</TableHead>
                  <TableHead className="text-right">{t("unitPrice")}</TableHead>
                  <TableHead className="text-right">{t("discount")}</TableHead>
                  <TableHead className="text-right">{t("total")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transaction.items.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <div className="font-medium">{item.itemName}</div>
                      <div className="text-sm text-muted-foreground">{item.itemCode}</div>
                    </TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                    <TableCell className="text-right">{item.discount > 0 ? `${item.discount}%` : t("notAvailable")}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(item.lineTotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("subtotal")}</span>
              <span className="font-medium">{formatCurrency(transaction.subtotal)}</span>
            </div>
            {transaction.totalDiscount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>{t("discount")}</span>
                <span>-{formatCurrency(transaction.totalDiscount)}</span>
              </div>
            )}
            {transaction.totalTax > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("tax", { rate: transaction.taxRate })}</span>
                <span className="font-medium">{formatCurrency(transaction.totalTax)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between text-lg">
              <span className="font-semibold">{t("totalAmount")}</span>
              <span className="font-bold">{formatCurrency(transaction.totalAmount)}</span>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="mb-3 font-semibold">{t("payment")}</h3>
            <div className="space-y-2">
              {transaction.payments.map((payment, index) => (
                <div key={index} className="flex justify-between">
                  <span className="capitalize text-muted-foreground">{payment.method}</span>
                  <span className="font-medium">{formatCurrency(payment.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("amountPaid")}</span>
                <span className="font-medium">{formatCurrency(transaction.amountPaid)}</span>
              </div>
              {transaction.changeAmount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>{t("change")}</span>
                  <span className="font-medium">{formatCurrency(transaction.changeAmount)}</span>
                </div>
              )}
            </div>
          </div>

          {transaction.notes && (
            <>
              <Separator />
              <div>
                <h3 className="mb-2 font-semibold">{t("notes")}</h3>
                <p className="text-sm text-muted-foreground">{transaction.notes}</p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
