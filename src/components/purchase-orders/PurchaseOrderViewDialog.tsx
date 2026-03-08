"use client";

import { useLocale, useTranslations } from "next-intl";
import { Printer, Package } from "lucide-react";
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
import { usePurchaseReceipts } from "@/hooks/usePurchaseReceipts";
import type { PurchaseOrder } from "@/types/purchase-order";

interface PurchaseOrderViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrder: PurchaseOrder | null;
}

export function PurchaseOrderViewDialog({
  open,
  onOpenChange,
  purchaseOrder,
}: PurchaseOrderViewDialogProps) {
  const t = useTranslations("purchaseOrderViewDialog");
  const locale = useLocale();
  const { formatCurrency } = useCurrency();

  // Fetch receipts for this purchase order
  const { data: receiptsData } = usePurchaseReceipts({
    purchaseOrderId: purchaseOrder?.id,
    limit: 100,
  });
  const receipts = receiptsData?.data || [];

  if (!purchaseOrder) return null;

  const handlePrint = () => {
    window.print();
  };

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
            {getStatusBadge(purchaseOrder.status)}
          </div>
          <DialogDescription>{t("orderCode", { code: purchaseOrder.orderCode })}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Information */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="mb-3 text-sm font-semibold">{t("supplierInformation")}</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">{t("name")}</span>
                  <div className="font-medium">{purchaseOrder.supplier?.name}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("code")}</span>
                  <div className="font-medium">{purchaseOrder.supplier?.code}</div>
                </div>
                {purchaseOrder.supplier?.email && (
                  <div>
                    <span className="text-muted-foreground">{t("email")}</span>
                    <div className="font-medium">{purchaseOrder.supplier.email}</div>
                  </div>
                )}
                {purchaseOrder.supplier?.phone && (
                  <div>
                    <span className="text-muted-foreground">{t("phone")}</span>
                    <div className="font-medium">{purchaseOrder.supplier.phone}</div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold">{t("orderDetails")}</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">{t("orderDate")}</span>
                  <div className="font-medium">{formatDate(purchaseOrder.orderDate)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("expectedDelivery")}</span>
                  <div className="font-medium">
                    {formatDate(purchaseOrder.expectedDeliveryDate)}
                  </div>
                </div>
                {purchaseOrder.approvedBy && (
                  <div>
                    <span className="text-muted-foreground">{t("approvedOn")}</span>
                    <div className="font-medium">
                      {purchaseOrder.approvedAt ? formatDate(purchaseOrder.approvedAt) : t("na")}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Delivery Address */}
          <div>
            <h3 className="mb-3 text-sm font-semibold">{t("deliveryAddress")}</h3>
            <div className="text-sm text-muted-foreground">
              {purchaseOrder.deliveryAddress && (
                <>
                  <div>{purchaseOrder.deliveryAddress}</div>
                  <div>
                    {purchaseOrder.deliveryCity && `${purchaseOrder.deliveryCity}, `}
                    {purchaseOrder.deliveryState && `${purchaseOrder.deliveryState} `}
                    {purchaseOrder.deliveryPostalCode}
                  </div>
                  {purchaseOrder.deliveryCountry && <div>{purchaseOrder.deliveryCountry}</div>}
                </>
              )}
            </div>
          </div>

          <hr className="border-t" />

          {/* Line Items */}
          <div>
            <h3 className="mb-3 text-sm font-semibold">{t("lineItems")}</h3>
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-3 text-left">{t("item")}</th>
                    <th className="p-3 text-right">{t("quantity")}</th>
                    <th className="p-3 text-center">{t("unit")}</th>
                    <th className="p-3 text-right">{t("rate")}</th>
                    <th className="p-3 text-right">{t("discount")}</th>
                    <th className="p-3 text-right">{t("tax")}</th>
                    <th className="p-3 text-right">{t("total")}</th>
                    {(purchaseOrder.status === "partially_received" ||
                      purchaseOrder.status === "received") && (
                      <th className="p-3 text-right">{t("received")}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {purchaseOrder.items?.map((item, index) => {
                    const total = item.lineTotal ?? item.quantity * item.rate;

                    return (
                      <tr key={index} className="border-t">
                        <td className="p-3">
                          <div>
                            <div className="font-medium">{item.item?.name}</div>
                            <div className="text-xs text-muted-foreground">{item.item?.code}</div>
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          {item.quantity}
                        </td>
                        <td className="p-3 text-center">
                          <span className="text-muted-foreground">
                            {item.uom?.code || item.uom?.name || t("noUnit")}
                          </span>
                        </td>
                        <td className="p-3 text-right">{formatCurrency(item.rate)}</td>
                        <td className="p-3 text-right">{item.discountPercent}%</td>
                        <td className="p-3 text-right">{item.taxPercent}%</td>
                        <td className="p-3 text-right font-medium">{formatCurrency(total)}</td>
                        {(purchaseOrder.status === "partially_received" ||
                          purchaseOrder.status === "received") && (
                          <td className="p-3 text-right">
                            {(() => {
                              const receivedQty = item.quantityReceived ?? 0;
                              return (
                                <>
                            <span
                              className={
                                receivedQty === item.quantity
                                  ? "text-green-600"
                                  : "text-yellow-600"
                              }
                            >
                              {receivedQty} / {item.quantity}
                            </span>
                                </>
                              );
                            })()}
                          </td>
                        )}
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
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("subtotal")}</span>
                <span className="font-medium">{formatCurrency(purchaseOrder.subtotal)}</span>
              </div>
              <div className="flex justify-between text-red-600">
                <span>{t("discountAmount")}</span>
                <span className="font-medium">-{formatCurrency(purchaseOrder.discountAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("taxAmount")}</span>
                <span className="font-medium">{formatCurrency(purchaseOrder.taxAmount)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 text-lg font-bold">
                <span>{t("totalAmount")}</span>
                <span>{formatCurrency(purchaseOrder.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {purchaseOrder.notes && (
            <>
              <hr className="border-t" />
              <div>
                <h3 className="mb-2 text-sm font-semibold">{t("notes")}</h3>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {purchaseOrder.notes}
                </p>
              </div>
            </>
          )}

          {/* Receipts / Goods Received */}
          {receipts.length > 0 && (
            <>
              <hr className="border-t" />
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  <h3 className="text-sm font-semibold">{t("goodsReceived", { count: receipts.length })}</h3>
                </div>
                <div className="space-y-3">
                  {receipts.map((receipt) => (
                    <div key={receipt.id} className="rounded-lg border p-4">
                      <div className="mb-3 flex items-start justify-between">
                        <div>
                          <div className="text-sm font-medium">{receipt.receiptCode}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {t("receivedOn", { date: formatDate(receipt.receiptDate) })}
                            {receipt.warehouse ? t("atWarehouse", { warehouse: receipt.warehouse.name }) : ""}
                          </div>
                        </div>
                        <Badge variant="default" className="bg-green-600">
                          {receipt.status}
                        </Badge>
                      </div>

                      {receipt.supplierInvoiceNumber && (
                        <div className="mb-2 text-xs text-muted-foreground">
                          {receipt.supplierInvoiceDate
                            ? t("supplierInvoiceWithDate", {
                                number: receipt.supplierInvoiceNumber,
                                date: formatDate(receipt.supplierInvoiceDate),
                              })
                            : t("supplierInvoice", { number: receipt.supplierInvoiceNumber })}
                        </div>
                      )}

                      {receipt.items && receipt.items.length > 0 && (
                        <div className="mt-3 border-t pt-3">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-muted-foreground">
                                <th className="pb-2 text-left">{t("item")}</th>
                                <th className="pb-2 text-right">{t("ordered")}</th>
                                <th className="pb-2 text-right">{t("received")}</th>
                                <th className="pb-2 text-right">{t("rate")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {receipt.items.map((item) => (
                                <tr key={item.id} className="border-t">
                                  <td className="py-2">
                                    <div className="font-medium">{item.item?.name}</div>
                                    <div className="text-muted-foreground">{item.item?.code}</div>
                                  </td>
                                  <td className="py-2 text-right">{item.quantityOrdered}</td>
                                  <td className="py-2 text-right">
                                    <span className="font-medium text-green-600">
                                      {item.quantityReceived}
                                    </span>
                                  </td>
                                  <td className="py-2 text-right">{formatCurrency(item.rate)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {receipt.notes && (
                        <div className="mt-3 border-t pt-3 text-xs text-muted-foreground">
                          <span className="font-medium">{t("notes")}:</span> {receipt.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
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
