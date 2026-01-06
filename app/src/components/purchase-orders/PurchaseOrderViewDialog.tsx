"use client";

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
        return <Badge variant="secondary">Draft</Badge>;
      case "submitted":
        return <Badge variant="default" className="bg-blue-600">Submitted</Badge>;
      case "approved":
        return <Badge variant="default" className="bg-green-600">Approved</Badge>;
      case "in_transit":
        return <Badge variant="default" className="bg-purple-600">In Transit</Badge>;
      case "partially_received":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Partially Received</Badge>;
      case "received":
        return <Badge variant="default" className="bg-green-700">Received</Badge>;
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
            <DialogTitle>Purchase Order Details</DialogTitle>
            {getStatusBadge(purchaseOrder.status)}
          </div>
          <DialogDescription>
            PO #{purchaseOrder.orderCode}
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
                  <div className="font-medium">{purchaseOrder.supplier?.name}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Code:</span>
                  <div className="font-medium">{purchaseOrder.supplier?.code}</div>
                </div>
                {purchaseOrder.supplier?.email && (
                  <div>
                    <span className="text-muted-foreground">Email:</span>
                    <div className="font-medium">{purchaseOrder.supplier.email}</div>
                  </div>
                )}
                {purchaseOrder.supplier?.phone && (
                  <div>
                    <span className="text-muted-foreground">Phone:</span>
                    <div className="font-medium">{purchaseOrder.supplier.phone}</div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-3">Order Details</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Order Date:</span>
                  <div className="font-medium">{formatDate(purchaseOrder.orderDate)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Expected Delivery:</span>
                  <div className="font-medium">{formatDate(purchaseOrder.expectedDeliveryDate)}</div>
                </div>
                {purchaseOrder.approvedBy && (
                  <div>
                    <span className="text-muted-foreground">Approved On:</span>
                    <div className="font-medium">
                      {purchaseOrder.approvedAt ? formatDate(purchaseOrder.approvedAt) : "N/A"}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Delivery Address */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Delivery Address</h3>
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
            <h3 className="text-sm font-semibold mb-3">Line Items</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3">Item</th>
                    <th className="text-right p-3">Quantity</th>
                    <th className="text-center p-3">Unit</th>
                    <th className="text-right p-3">Rate</th>
                    <th className="text-right p-3">Discount</th>
                    <th className="text-right p-3">Tax</th>
                    <th className="text-right p-3">Total</th>
                    {(purchaseOrder.status === "partially_received" || purchaseOrder.status === "received") && (
                      <th className="text-right p-3">Received</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {purchaseOrder.items?.map((item, index) => {
                    const total = item.lineTotal ?? item.quantity * item.rate;
                    const conversionFactor = item.packaging?.qtyPerPack ?? 1;
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
                        <td className="text-right p-3">
                          {item.quantity}
                          {showConversion && (
                            <div className="text-xs text-muted-foreground">
                              = {(item.quantity * conversionFactor).toFixed(4)}{" "}
                              {baseUnitLabel}
                            </div>
                          )}
                        </td>
                        <td className="text-center p-3">
                          <span className="text-muted-foreground">
                            {item.packagingName || "—"}
                          </span>
                        </td>
                        <td className="text-right p-3">{formatCurrency(item.rate)}</td>
                        <td className="text-right p-3">{item.discountPercent}%</td>
                        <td className="text-right p-3">{item.taxPercent}%</td>
                        <td className="text-right p-3 font-medium">
                          {formatCurrency(total)}
                        </td>
                        {(purchaseOrder.status === "partially_received" || purchaseOrder.status === "received") && (
                          <td className="text-right p-3">
                            <span className={item.quantityReceived === item.quantity ? "text-green-600" : "text-yellow-600"}>
                              {item.quantityReceived} / {item.quantity}
                            </span>
                            {showConversion && (
                              <div className="text-xs text-muted-foreground">
                                = {(item.quantityReceived * conversionFactor).toFixed(4)}{" "}
                                {baseUnitLabel}
                              </div>
                            )}
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
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-medium">{formatCurrency(purchaseOrder.subtotal)}</span>
              </div>
              <div className="flex justify-between text-red-600">
                <span>Discount:</span>
                <span className="font-medium">-{formatCurrency(purchaseOrder.discountAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax:</span>
                <span className="font-medium">{formatCurrency(purchaseOrder.taxAmount)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Total:</span>
                <span>{formatCurrency(purchaseOrder.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {purchaseOrder.notes && (
            <>
              <hr className="border-t" />
              <div>
                <h3 className="text-sm font-semibold mb-2">Notes</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
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
                <div className="flex items-center gap-2 mb-3">
                  <Package className="h-4 w-4" />
                  <h3 className="text-sm font-semibold">Goods Received ({receipts.length})</h3>
                </div>
                <div className="space-y-3">
                  {receipts.map((receipt) => (
                    <div key={receipt.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="font-medium text-sm">{receipt.receiptCode}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Received on {formatDate(receipt.receiptDate)}
                            {receipt.warehouse && ` at ${receipt.warehouse.name}`}
                          </div>
                        </div>
                        <Badge variant="default" className="bg-green-600">
                          {receipt.status}
                        </Badge>
                      </div>

                      {receipt.supplierInvoiceNumber && (
                        <div className="text-xs text-muted-foreground mb-2">
                          Supplier Invoice: {receipt.supplierInvoiceNumber}
                          {receipt.supplierInvoiceDate && ` (${formatDate(receipt.supplierInvoiceDate)})`}
                        </div>
                      )}

                      {receipt.items && receipt.items.length > 0 && (
                        <div className="border-t pt-3 mt-3">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-muted-foreground">
                                <th className="text-left pb-2">Item</th>
                                <th className="text-right pb-2">Ordered</th>
                                <th className="text-right pb-2">Received</th>
                                <th className="text-right pb-2">Rate</th>
                              </tr>
                            </thead>
                            <tbody>
                              {receipt.items.map((item) => (
                                <tr key={item.id} className="border-t">
                                  <td className="py-2">
                                    <div className="font-medium">{item.item?.name}</div>
                                    <div className="text-muted-foreground">{item.item?.code}</div>
                                  </td>
                                  <td className="text-right py-2">{item.quantityOrdered}</td>
                                  <td className="text-right py-2">
                                    <span className="font-medium text-green-600">
                                      {item.quantityReceived}
                                    </span>
                                  </td>
                                  <td className="text-right py-2">{formatCurrency(item.rate)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {receipt.notes && (
                        <div className="text-xs text-muted-foreground mt-3 border-t pt-3">
                          <span className="font-medium">Notes:</span> {receipt.notes}
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
            Close
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
