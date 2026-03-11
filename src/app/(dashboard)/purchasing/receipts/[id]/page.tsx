"use client";

import { useLocale, useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { MetricCard } from "@/components/shared/MetricCard";
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

export default function GoodsReceiptDetailPage() {
  const t = useTranslations("purchaseReceiptDetailPage");
  const locale = useLocale();
  const params = useParams();
  const router = useRouter();
  const receiptId = params.id as string;

  const receipt = mockReceiptDetails[receiptId as keyof typeof mockReceiptDetails];

  const statusConfig = {
    completed: {
      label: t("completed"),
      variant: "default" as const,
      icon: CheckCircle,
      color: "text-green-600",
    },
    partial: {
      label: t("partial"),
      variant: "secondary" as const,
      icon: Clock,
      color: "text-yellow-600",
    },
    pending: {
      label: t("pending"),
      variant: "outline" as const,
      icon: Clock,
      color: "text-gray-600",
    },
    received: {
      label: t("received"),
      variant: "default" as const,
      icon: CheckCircle,
      color: "text-green-600",
    },
  };

  const formatDateTime = (value: string) =>
    new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 2,
    }).format(value);

  if (!receipt) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">{t("receiptNotFound")}</h1>
        </div>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {t("receiptNotFoundDescription")}
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{receipt.id}</h1>
            <p className="text-muted-foreground">{t("goodsReceiptDetails")}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Printer className="mr-2 h-4 w-4" />
            {t("print")}
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            {t("export")}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("receiptInformation")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t("receiptId")}</p>
                <p className="text-sm font-semibold">{receipt.id}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t("status")}</p>
                <Badge variant={status.variant} className="gap-1">
                  <StatusIcon className={`h-3 w-3 ${status.color}`} />
                  {status.label}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t("purchaseOrder")}</p>
                <p className="cursor-pointer text-sm font-semibold text-blue-600 hover:underline">
                  {receipt.purchaseOrderId}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t("receivedBy")}</p>
                <p className="text-sm">{receipt.receivedBy}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t("receiptDate")}</p>
                <p className="text-sm">{formatDateTime(receipt.receiptDate)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t("deliveryDate")}</p>
                <p className="text-sm">{formatDateTime(receipt.deliveryDate)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t("batch")}</p>
                <p className="text-sm">{receipt.batchSequenceNumber || t("noValue")}</p>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t("warehouse")}</p>
              <p className="text-sm">{receipt.warehouse}</p>
            </div>
            {receipt.notes && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t("notes")}</p>
                <p className="text-sm">{receipt.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("supplierInformation")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t("supplierName")}</p>
              <p className="text-sm font-semibold">{receipt.supplier.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t("supplierCode")}</p>
              <p className="text-sm">{receipt.supplier.code}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t("address")}</p>
              <p className="text-sm">{receipt.supplier.address}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t("contact")}</p>
              <p className="text-sm">{receipt.supplier.contact}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard title={t("totalItems")} icon={Package} value={String(receipt.items.length)} />
        <MetricCard title={t("orderedQuantity")} icon={Package} value={String(totalOrderedQty)} />
        <MetricCard
          title={t("receivedQuantity")}
          icon={Package}
          value={String(totalReceivedQty)}
          caption={`${totalOrderedQty > 0 ? ((totalReceivedQty / totalOrderedQty) * 100).toFixed(1) : 0}% ${t("ofTotal")}`}
        />
        <MetricCard title={t("totalValue")} icon={Package} value={formatCurrency(totalValue)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("receiptItems")}</CardTitle>
          <CardDescription>{t("receiptItemsDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("productCode")}</TableHead>
                  <TableHead>{t("productName")}</TableHead>
                  <TableHead className="text-right">{t("orderedQty")}</TableHead>
                  <TableHead className="text-right">{t("receivedQty")}</TableHead>
                  <TableHead>{t("unit")}</TableHead>
                  <TableHead className="text-right">{t("unitPrice")}</TableHead>
                  <TableHead className="text-right">{t("totalPrice")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipt.items.map((item) => {
                  const itemStatus = statusConfig[item.status as keyof typeof statusConfig] ?? statusConfig.pending;
                  const ItemStatusIcon = itemStatus.icon;
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.productCode}</TableCell>
                      <TableCell>{item.productName}</TableCell>
                      <TableCell className="text-right">{item.orderedQty}</TableCell>
                      <TableCell className="text-right font-semibold">{item.receivedQty}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(item.totalPrice)}</TableCell>
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
