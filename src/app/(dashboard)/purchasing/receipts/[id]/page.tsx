"use client";

import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ArrowLeft, Package, CheckCircle, Clock, Download, Printer } from "lucide-react";

// Mock data for a single goods receipt
const mockReceiptDetails = {
  "GR-2024-001": {
    id: "GR-2024-001",
    purchaseOrderId: "PO-2024-156",
    supplier: {
      name: "ABC Distributors Inc.",
      code: "SUP-001",
      address: "123 Business St, Davao City",
      contact: "+63 82 123 4567",
    },
    receiptDate: "2024-01-15T10:30:00",
    deliveryDate: "2024-01-15T09:00:00",
    batchSequenceNumber: "BATCH-2024-001",
    status: "completed",
    receivedBy: "John Doe",
    warehouse: "Main Warehouse - Davao",
    notes: "All items received in good condition. Quality check completed.",
    items: [
      {
        id: "1",
        productCode: "PRD-001",
        productName: "Widget A",
        orderedQty: 100,
        receivedQty: 100,
        unit: "pcs",
        unitPrice: 150.0,
        totalPrice: 15000.0,
        status: "received",
      },
      {
        id: "2",
        productCode: "PRD-002",
        productName: "Widget B",
        orderedQty: 50,
        receivedQty: 50,
        unit: "pcs",
        unitPrice: 200.0,
        totalPrice: 10000.0,
        status: "received",
      },
      {
        id: "3",
        productCode: "PRD-003",
        productName: "Widget C",
        orderedQty: 30,
        receivedQty: 30,
        unit: "pcs",
        unitPrice: 300.0,
        totalPrice: 9000.0,
        status: "received",
      },
      {
        id: "4",
        productCode: "PRD-004",
        productName: "Widget D",
        orderedQty: 40,
        receivedQty: 40,
        unit: "pcs",
        unitPrice: 175.0,
        totalPrice: 7000.0,
        status: "received",
      },
      {
        id: "5",
        productCode: "PRD-005",
        productName: "Widget E",
        orderedQty: 30,
        receivedQty: 30,
        unit: "pcs",
        unitPrice: 250.0,
        totalPrice: 7500.0,
        status: "received",
      },
    ],
  },
  "GR-2024-002": {
    id: "GR-2024-002",
    purchaseOrderId: "PO-2024-157",
    supplier: {
      name: "XYZ Supplies Co.",
      code: "SUP-002",
      address: "456 Commerce Ave, Cagayan de Oro City",
      contact: "+63 88 765 4321",
    },
    receiptDate: "2024-01-14T14:20:00",
    deliveryDate: "2024-01-14T13:00:00",
    batchSequenceNumber: "BATCH-2024-002",
    status: "partial",
    receivedBy: "Jane Smith",
    warehouse: "Main Warehouse - Davao",
    notes: "Partial delivery. Remaining items expected by Jan 20.",
    items: [
      {
        id: "1",
        productCode: "PRD-006",
        productName: "Component X",
        orderedQty: 80,
        receivedQty: 60,
        unit: "pcs",
        unitPrice: 120.0,
        totalPrice: 7200.0,
        status: "partial",
      },
      {
        id: "2",
        productCode: "PRD-007",
        productName: "Component Y",
        orderedQty: 50,
        receivedQty: 50,
        unit: "pcs",
        unitPrice: 180.0,
        totalPrice: 9000.0,
        status: "received",
      },
      {
        id: "3",
        productCode: "PRD-008",
        productName: "Component Z",
        orderedQty: 20,
        receivedQty: 10,
        unit: "pcs",
        unitPrice: 220.0,
        totalPrice: 2200.0,
        status: "partial",
      },
    ],
  },
  "GR-2024-003": {
    id: "GR-2024-003",
    purchaseOrderId: "PO-2024-158",
    supplier: {
      name: "Global Parts Ltd.",
      code: "SUP-003",
      address: "789 Industrial Rd, General Santos City",
      contact: "+63 83 111 2222",
    },
    receiptDate: "2024-01-14T11:00:00",
    deliveryDate: "2024-01-14T10:00:00",
    batchSequenceNumber: "BATCH-2024-003",
    status: "pending",
    receivedBy: "Mike Johnson",
    warehouse: "Main Warehouse - Davao",
    notes: "Awaiting quality inspection.",
    items: [
      {
        id: "1",
        productCode: "PRD-009",
        productName: "Part Alpha",
        orderedQty: 150,
        receivedQty: 0,
        unit: "pcs",
        unitPrice: 95.0,
        totalPrice: 0,
        status: "pending",
      },
      {
        id: "2",
        productCode: "PRD-010",
        productName: "Part Beta",
        orderedQty: 100,
        receivedQty: 0,
        unit: "pcs",
        unitPrice: 110.0,
        totalPrice: 0,
        status: "pending",
      },
    ],
  },
};

const statusConfig = {
  completed: {
    label: "Completed",
    variant: "default" as const,
    icon: CheckCircle,
    color: "text-green-600",
  },
  partial: {
    label: "Partial",
    variant: "secondary" as const,
    icon: Clock,
    color: "text-yellow-600",
  },
  pending: {
    label: "Pending",
    variant: "outline" as const,
    icon: Clock,
    color: "text-gray-600",
  },
  received: {
    label: "Received",
    variant: "default" as const,
    icon: CheckCircle,
    color: "text-green-600",
  },
};

export default function GoodsReceiptDetailPage() {
  const params = useParams();
  const router = useRouter();
  const receiptId = params.id as string;

  const receipt = mockReceiptDetails[receiptId as keyof typeof mockReceiptDetails];

  if (!receipt) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Receipt Not Found</h1>
        </div>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            The goods receipt you&apos;re looking for doesn&apos;t exist.
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusKey = receipt.status as keyof typeof statusConfig;
  const status = statusConfig[statusKey] ?? statusConfig.pending;
  const StatusIcon = status.icon;

  const totalOrderedQty = receipt.items.reduce((sum, item) => sum + item.orderedQty, 0);
  const totalReceivedQty = receipt.items.reduce((sum, item) => sum + item.receivedQty, 0);
  const totalValue = receipt.items.reduce((sum, item) => sum + item.totalPrice, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{receipt.id}</h1>
            <p className="text-muted-foreground">Goods Receipt Details</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Receipt Information */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Receipt Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Receipt ID</p>
                <p className="text-sm font-semibold">{receipt.id}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <Badge variant={status.variant} className="gap-1">
                  <StatusIcon className={`h-3 w-3 ${status.color}`} />
                  {status.label}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Purchase Order</p>
                <p className="cursor-pointer text-sm font-semibold text-blue-600 hover:underline">
                  {receipt.purchaseOrderId}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Received By</p>
                <p className="text-sm">{receipt.receivedBy}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Receipt Date</p>
                <p className="text-sm">
                  {new Date(receipt.receiptDate).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Delivery Date</p>
                <p className="text-sm">
                  {new Date(receipt.deliveryDate).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Batch</p>
                <p className="text-sm">{receipt.batchSequenceNumber || "—"}</p>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Warehouse</p>
              <p className="text-sm">{receipt.warehouse}</p>
            </div>
            {receipt.notes && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Notes</p>
                <p className="text-sm">{receipt.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Supplier Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Supplier Name</p>
              <p className="text-sm font-semibold">{receipt.supplier.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Supplier Code</p>
              <p className="text-sm">{receipt.supplier.code}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Address</p>
              <p className="text-sm">{receipt.supplier.address}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Contact</p>
              <p className="text-sm">{receipt.supplier.contact}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{receipt.items.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ordered Quantity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrderedQty}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Received Quantity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalReceivedQty}</div>
            <p className="text-xs text-muted-foreground">
              {totalOrderedQty > 0 ? ((totalReceivedQty / totalOrderedQty) * 100).toFixed(1) : 0}%
              of total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₱{totalValue.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Receipt Items</CardTitle>
          <CardDescription>Items included in this goods receipt</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product Code</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead className="text-right">Ordered Qty</TableHead>
                  <TableHead className="text-right">Received Qty</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Total Price</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipt.items.map((item) => {
                  const itemStatus = statusConfig[item.status as keyof typeof statusConfig];
                  const ItemStatusIcon = itemStatus.icon;
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.productCode}</TableCell>
                      <TableCell>{item.productName}</TableCell>
                      <TableCell className="text-right">{item.orderedQty}</TableCell>
                      <TableCell className="text-right font-semibold">{item.receivedQty}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell className="text-right">
                        ₱{item.unitPrice.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        ₱{item.totalPrice.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={itemStatus.variant} className="gap-1">
                          <ItemStatusIcon className={`h-3 w-3 ${itemStatus.color}`} />
                          {itemStatus.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
