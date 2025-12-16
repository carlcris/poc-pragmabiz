"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowDownCircle, ArrowUpCircle, ArrowRightLeft, Settings2, Calendar, User, FileText, Package, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TransactionType } from "@/types/stock-transaction";

interface StockTransactionDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactionId: string | null;
}

interface TransactionItem {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  uomId: string;
  uom: string;
  unitCost: number;
  totalCost: number;
  qtyBefore: number | null;
  qtyAfter: number | null;
  valuationRate: number | null;
  stockValueBefore: number | null;
  stockValueAfter: number | null;
  postingDate: string | null;
  postingTime: string | null;
  batchNo: string | null;
  serialNo: string | null;
  expiryDate: string | null;
  notes: string | null;
}

interface TransactionDetail {
  id: string;
  transactionCode: string;
  transactionType: TransactionType;
  transactionDate: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  toWarehouseId: string | null;
  toWarehouseCode: string | null;
  toWarehouseName: string | null;
  referenceType: string | null;
  referenceId: string | null;
  status: string;
  notes: string | null;
  items: TransactionItem[];
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export function StockTransactionDetailDialog({
  open,
  onOpenChange,
  transactionId,
}: StockTransactionDetailDialogProps) {
  const { data: transaction, isLoading } = useQuery<TransactionDetail>({
    queryKey: ["stock-transaction", transactionId],
    queryFn: async () => {
      if (!transactionId) throw new Error("No transaction ID");
      const response = await fetch(`/api/stock-transactions/${transactionId}`);
      if (!response.ok) throw new Error("Failed to fetch stock transaction");
      return response.json();
    },
    enabled: !!transactionId && open,
  });

  const getTransactionTypeIcon = (type: TransactionType) => {
    switch (type) {
      case "in":
        return <ArrowDownCircle className="h-4 w-4 text-green-600" />;
      case "out":
        return <ArrowUpCircle className="h-4 w-4 text-red-600" />;
      case "transfer":
        return <ArrowRightLeft className="h-4 w-4 text-blue-600" />;
      case "adjustment":
        return <Settings2 className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getTransactionTypeBadge = (type: TransactionType) => {
    const configs: Record<TransactionType, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
      in: { label: "Stock In", variant: "default" },
      out: { label: "Stock Out", variant: "destructive" },
      transfer: { label: "Transfer", variant: "outline" },
      adjustment: { label: "Adjustment", variant: "secondary" },
    };

    const config = configs[type];
    return (
      <div className="flex items-center gap-2">
        {getTransactionTypeIcon(type)}
        <Badge variant={config.variant} className="text-xs">
          {config.label}
        </Badge>
      </div>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "PHP",
    }).format(amount);
  };

  const formatReferenceType = (referenceType: string | null) => {
    if (!referenceType) return null;

    // Convert snake_case and other formats to Title Case
    return referenceType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  if (isLoading || !transaction) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Skeleton className="h-8 w-48 mb-2" />
                  <Skeleton className="h-4 w-64" />
                </div>
                <Skeleton className="h-6 w-24" />
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[calc(90vh-120px)] overflow-y-auto px-6 pb-6">
            <div className="space-y-6">
              {/* Transaction Information Skeleton */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <Skeleton className="h-5 w-48" />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <Skeleton className="h-5 w-48" />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                  </CardContent>
                </Card>
              </div>

              {/* Transaction Items Skeleton */}
              <Card>
                <CardHeader className="pb-3">
                  <Skeleton className="h-5 w-32" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl">{transaction.transactionCode}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">Stock Transaction Details</p>
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[calc(90vh-120px)] overflow-y-auto px-6 pb-6">
          <div className="space-y-6">
            {/* Transaction Information */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Transaction Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Transaction Code:</span>
                    <span className="font-semibold">{transaction.transactionCode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type:</span>
                    {getTransactionTypeBadge(transaction.transactionType)}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge variant={transaction.status === "posted" ? "default" : "secondary"} className="text-xs">
                      {transaction.status.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Transaction Date:</span>
                    <span className="font-medium">{formatDate(transaction.transactionDate)}</span>
                  </div>
                  {transaction.referenceType && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Reference:</span>
                      <span className="font-medium">{formatReferenceType(transaction.referenceType)}</span>
                    </div>
                  )}
                  {transaction.notes && (
                    <div className="pt-2">
                      <p className="text-xs text-muted-foreground mb-1">Notes:</p>
                      <p className="text-xs">{transaction.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Warehouse Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Source Warehouse:</p>
                    <p className="font-semibold text-sm">
                      {transaction.warehouseCode} - {transaction.warehouseName}
                    </p>
                  </div>
                  {transaction.transactionType === "transfer" && transaction.toWarehouseCode && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Destination Warehouse:</p>
                        <p className="font-semibold text-sm">
                          {transaction.toWarehouseCode} - {transaction.toWarehouseName}
                        </p>
                      </div>
                    </>
                  )}
                  <Separator />
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3" />
                      Created By:
                    </span>
                    <span className="font-medium">{transaction.createdByName}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Created At:
                    </span>
                    <span className="font-medium">{formatDateTime(transaction.createdAt)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Transaction Items */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Transaction Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Item Code</TableHead>
                        <TableHead className="text-xs">Item Name</TableHead>
                        <TableHead className="text-right text-xs">Qty Before</TableHead>
                        <TableHead className="text-right text-xs">Quantity</TableHead>
                        <TableHead className="text-right text-xs">Qty After</TableHead>
                        <TableHead className="text-right text-xs">Unit Cost</TableHead>
                        <TableHead className="text-right text-xs">Total Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transaction.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium text-xs">{item.itemCode}</TableCell>
                          <TableCell className="text-xs">{item.itemName}</TableCell>
                          <TableCell className="text-right text-xs">
                            {item.qtyBefore !== null ? (
                              <span className="text-muted-foreground">
                                {item.qtyBefore.toFixed(2)} {item.uom}
                              </span>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            <span
                              className={
                                transaction.transactionType === "in"
                                  ? "text-green-600 font-semibold"
                                  : transaction.transactionType === "out"
                                  ? "text-red-600 font-semibold"
                                  : "font-semibold"
                              }
                            >
                              {transaction.transactionType === "in" ? "+" : transaction.transactionType === "out" ? "-" : ""}
                              {item.quantity.toFixed(2)} {item.uom}
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {item.qtyAfter !== null ? (
                              <span className="font-semibold">
                                {item.qtyAfter.toFixed(2)} {item.uom}
                              </span>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell className="text-right text-xs">{formatCurrency(item.unitCost)}</TableCell>
                          <TableCell className="text-right font-semibold text-xs">{formatCurrency(item.totalCost)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Summary */}
                <div className="mt-4 flex justify-end">
                  <div className="w-64 space-y-2">
                    <Separator />
                    <div className="flex justify-between text-base font-bold">
                      <span>Total Cost:</span>
                      <span>
                        {formatCurrency(transaction.items.reduce((sum, item) => sum + item.totalCost, 0))}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stock Value Changes (if available) */}
            {transaction.items.some((item) => item.stockValueBefore !== null) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Stock Value Changes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Item</TableHead>
                          <TableHead className="text-right text-xs">Valuation Rate</TableHead>
                          <TableHead className="text-right text-xs">Value Before</TableHead>
                          <TableHead className="text-right text-xs">Value After</TableHead>
                          <TableHead className="text-right text-xs">Change</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transaction.items
                          .filter((item) => item.stockValueBefore !== null)
                          .map((item) => {
                            const valueChange = (item.stockValueAfter || 0) - (item.stockValueBefore || 0);
                            return (
                              <TableRow key={item.id}>
                                <TableCell className="text-xs">
                                  <div>
                                    <div className="font-medium">{item.itemCode}</div>
                                    <div className="text-muted-foreground">{item.itemName}</div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right text-xs">
                                  {item.valuationRate !== null ? formatCurrency(item.valuationRate) : "-"}
                                </TableCell>
                                <TableCell className="text-right text-xs">
                                  {item.stockValueBefore !== null ? formatCurrency(item.stockValueBefore) : "-"}
                                </TableCell>
                                <TableCell className="text-right font-semibold text-xs">
                                  {item.stockValueAfter !== null ? formatCurrency(item.stockValueAfter) : "-"}
                                </TableCell>
                                <TableCell className="text-right text-xs">
                                  <span className={valueChange >= 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                                    {valueChange >= 0 ? "+" : ""}
                                    {formatCurrency(valueChange)}
                                  </span>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
