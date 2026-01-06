"use client";

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
  const { formatCurrency } = useCurrency();

  if (!receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "received":
        return <Badge variant="default" className="bg-green-600">Received</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto print:max-h-none">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <DialogTitle>Purchase Receipt Details</DialogTitle>
            {getStatusBadge(receipt.status)}
          </div>
          <DialogDescription>
            GRN #{receipt.receiptCode}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Information */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold mb-3">Supplier Information</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Name:</span>
                  <div className="font-medium">{receipt.supplier?.name}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Code:</span>
                  <div className="font-medium">{receipt.supplier?.code}</div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-3">Receipt Details</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Purchase Order:</span>
                  <div className="font-medium">{receipt.purchaseOrder?.orderCode}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Receipt Date:</span>
                  <div className="font-medium">{formatDate(receipt.receiptDate)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Warehouse:</span>
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
              <h3 className="text-sm font-semibold mb-3">Supplier Invoice</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {receipt.supplierInvoiceNumber && (
                  <div>
                    <span className="text-muted-foreground">Invoice Number:</span>
                    <div className="font-medium">{receipt.supplierInvoiceNumber}</div>
                  </div>
                )}
                {receipt.supplierInvoiceDate && (
                  <div>
                    <span className="text-muted-foreground">Invoice Date:</span>
                    <div className="font-medium">{formatDate(receipt.supplierInvoiceDate)}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          <hr className="border-t" />

          {/* Line Items */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Received Items</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3">Item</th>
                    <th className="text-right p-3">Ordered</th>
                    <th className="text-right p-3">Received</th>
                    <th className="text-center p-3">Unit</th>
                    <th className="text-right p-3">Rate</th>
                    <th className="text-right p-3">Total Value</th>
                  </tr>
                </thead>
                <tbody>
                  {receipt.items?.map((item, index) => {
                    const conversionFactor = item.packaging?.qtyPerPack ?? 1;
                    const totalValue =
                      item.quantityReceived * conversionFactor * item.rate;
                    const showConversion =
                      item.packaging?.qtyPerPack &&
                      item.packaging.qtyPerPack !== 1;
                    const baseUnitLabel =
                      item.uom?.code || item.uom?.name || "base units";

                    return (
                      <tr key={index} className="border-t">
                        <td className="p-3">
                          <div>
                            <div className="font-medium">{item.item?.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {item.item?.code}
                            </div>
                          </div>
                        </td>
                        <td className="text-right p-3">{item.quantityOrdered}</td>
                        <td className="text-right p-3">
                          <span className="font-medium text-green-600">
                            {item.quantityReceived}
                          </span>
                          {showConversion && (
                            <div className="text-xs text-muted-foreground">
                              = {(item.quantityReceived * conversionFactor).toFixed(4)}{" "}
                              {baseUnitLabel}
                            </div>
                          )}
                        </td>
                        <td className="text-center p-3">
                          <span className="text-muted-foreground">
                            {item.packaging?.name || "—"}
                          </span>
                        </td>
                        <td className="text-right p-3">{formatCurrency(item.rate)}</td>
                        <td className="text-right p-3 font-medium">
                          {formatCurrency(totalValue)}
                        </td>
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
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Total Value:</span>
                <span>
                  {formatCurrency(
                    receipt.items?.reduce(
                      (sum, item) => {
                        const conversionFactor = item.packaging?.qtyPerPack ?? 1;
                        return sum + item.quantityReceived * conversionFactor * item.rate;
                      },
                      0
                    ) || 0
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
                <h3 className="text-sm font-semibold mb-2">Notes</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {receipt.notes}
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="print:hidden">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print GRN
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
