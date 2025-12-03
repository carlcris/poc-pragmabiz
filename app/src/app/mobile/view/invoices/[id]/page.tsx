"use client";

import { use } from "react";
import { MobileHeader } from "@/components/mobile/MobileHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useCurrency } from "@/hooks/useCurrency";
import {
  FileText,
  Calendar,
  User,
  MapPin,
  Phone,
  Mail,
  Package,
  DollarSign
} from "lucide-react";

interface InvoiceItem {
  id: string;
  itemCode: string;
  itemName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  lineTotal: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  invoiceDate: string;
  dueDate: string;
  status: string;
  lineItems: InvoiceItem[];
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  billingAddress: string;
  billingCity: string;
  billingState: string;
  billingPostalCode: string;
  billingCountry: string;
  notes: string;
  primaryEmployeeName: string;
  commissionTotal: number;
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case "paid":
      return <Badge className="bg-green-600">Paid</Badge>;
    case "partially_paid":
      return <Badge className="bg-orange-500">Partial</Badge>;
    case "sent":
      return <Badge variant="secondary">Sent</Badge>;
    case "overdue":
      return <Badge variant="destructive">Overdue</Badge>;
    case "draft":
      return <Badge variant="outline">Draft</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

export default function MobileInvoiceDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { formatCurrency } = useCurrency();

  const { data: invoiceData, isLoading } = useQuery({
    queryKey: ["invoice-details", id],
    queryFn: async () => {
      const response = await fetch(`/api/invoices/${id}`);
      if (!response.ok) throw new Error("Failed to fetch invoice");
      return response.json();
    },
  });

  const invoice: Invoice | undefined = invoiceData;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <MobileHeader title="Invoice Details" showBack backHref="/mobile/view/invoices" />
        <div className="p-4 space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-gray-50">
        <MobileHeader title="Invoice Details" showBack backHref="/mobile/view/invoices" />
        <div className="p-4">
          <Card>
            <CardContent className="py-8">
              <div className="text-center">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Invoice not found</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const address = [
    invoice.billingAddress,
    invoice.billingCity,
    invoice.billingState,
    invoice.billingPostalCode,
    invoice.billingCountry,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      <MobileHeader title="Invoice Details" showBack backHref="/mobile/view/invoices" />

      <div className="p-4 space-y-4">
        {/* Invoice Header */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-xs text-gray-500 mb-1">Invoice Number</div>
                <div className="font-bold text-lg">{invoice.invoiceNumber}</div>
              </div>
              {getStatusBadge(invoice.status)}
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div>
                <div className="flex items-center text-xs text-gray-500 mb-1">
                  <Calendar className="h-3 w-3 mr-1" />
                  Invoice Date
                </div>
                <div className="text-sm font-medium">
                  {format(new Date(invoice.invoiceDate), "MMM dd, yyyy")}
                </div>
              </div>
              <div>
                <div className="flex items-center text-xs text-gray-500 mb-1">
                  <Calendar className="h-3 w-3 mr-1" />
                  Due Date
                </div>
                <div className="text-sm font-medium">
                  {format(new Date(invoice.dueDate), "MMM dd, yyyy")}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Customer Information */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center">
              <User className="h-4 w-4 mr-2" />
              Customer Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <div className="font-semibold text-sm">{invoice.customerName}</div>
            </div>
            {invoice.customerEmail && (
              <div className="flex items-center text-sm text-gray-600">
                <Mail className="h-3.5 w-3.5 mr-2 text-gray-400" />
                {invoice.customerEmail}
              </div>
            )}
            {address && (
              <div className="flex items-start text-sm text-gray-600">
                <MapPin className="h-3.5 w-3.5 mr-2 text-gray-400 mt-0.5" />
                <span className="flex-1">{address}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center">
              <Package className="h-4 w-4 mr-2" />
              Items ({invoice.lineItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {invoice.lineItems.map((item) => (
              <div key={item.id} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="font-semibold text-sm">{item.itemName}</div>
                    <div className="text-xs text-gray-500">{item.itemCode}</div>
                    {item.description && (
                      <div className="text-xs text-gray-600 mt-1">{item.description}</div>
                    )}
                  </div>
                  <div className="text-right ml-2">
                    <div className="font-bold text-sm">{formatCurrency(item.lineTotal)}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <div>Qty: {item.quantity}</div>
                  <div>@ {formatCurrency(item.unitPrice)}</div>
                  {item.discount > 0 && (
                    <div className="text-orange-600">-{item.discount}%</div>
                  )}
                  {item.taxRate > 0 && (
                    <div className="text-blue-600">Tax: {item.taxRate}%</div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Totals */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center">
              <DollarSign className="h-4 w-4 mr-2" />
              Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium">{formatCurrency(invoice.subtotal)}</span>
            </div>
            {invoice.totalDiscount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Discount</span>
                <span className="font-medium text-orange-600">
                  -{formatCurrency(invoice.totalDiscount)}
                </span>
              </div>
            )}
            {invoice.totalTax > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Tax</span>
                <span className="font-medium">{formatCurrency(invoice.totalTax)}</span>
              </div>
            )}
            <Separator />
            <div className="flex items-center justify-between">
              <span className="font-semibold">Total Amount</span>
              <span className="font-bold text-lg">{formatCurrency(invoice.totalAmount)}</span>
            </div>
            {invoice.amountPaid > 0 && (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Amount Paid</span>
                  <span className="font-medium text-green-600">
                    {formatCurrency(invoice.amountPaid)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-orange-600">Amount Due</span>
                  <span className="font-bold text-orange-600">
                    {formatCurrency(invoice.amountDue)}
                  </span>
                </div>
              </>
            )}
            {invoice.commissionTotal > 0 && (
              <>
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Commission</span>
                  <span className="font-medium text-blue-600">
                    {formatCurrency(invoice.commissionTotal)}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Sales Person */}
        {invoice.primaryEmployeeName && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">Sales Person</div>
                <div className="font-semibold text-sm">{invoice.primaryEmployeeName}</div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        {invoice.notes && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">{invoice.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
