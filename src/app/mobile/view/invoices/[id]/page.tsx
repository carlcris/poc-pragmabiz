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
import { FileText, Calendar, User, MapPin, Mail, Package, DollarSign } from "lucide-react";

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

export default function MobileInvoiceDetailsPage({ params }: { params: Promise<{ id: string }> }) {
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
        <div className="space-y-4 p-4">
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
                <FileText className="mx-auto mb-2 h-12 w-12 text-gray-300" />
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

      <div className="space-y-4 p-4">
        {/* Invoice Header */}
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <div className="mb-1 text-xs text-gray-500">Invoice Number</div>
                <div className="text-lg font-bold">{invoice.invoiceNumber}</div>
              </div>
              {getStatusBadge(invoice.status)}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <div className="mb-1 flex items-center text-xs text-gray-500">
                  <Calendar className="mr-1 h-3 w-3" />
                  Invoice Date
                </div>
                <div className="text-sm font-medium">
                  {format(new Date(invoice.invoiceDate), "MMM dd, yyyy")}
                </div>
              </div>
              <div>
                <div className="mb-1 flex items-center text-xs text-gray-500">
                  <Calendar className="mr-1 h-3 w-3" />
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
            <CardTitle className="flex items-center text-base">
              <User className="mr-2 h-4 w-4" />
              Customer Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <div className="text-sm font-semibold">{invoice.customerName}</div>
            </div>
            {invoice.customerEmail && (
              <div className="flex items-center text-sm text-gray-600">
                <Mail className="mr-2 h-3.5 w-3.5 text-gray-400" />
                {invoice.customerEmail}
              </div>
            )}
            {address && (
              <div className="flex items-start text-sm text-gray-600">
                <MapPin className="mr-2 mt-0.5 h-3.5 w-3.5 text-gray-400" />
                <span className="flex-1">{address}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-base">
              <Package className="mr-2 h-4 w-4" />
              Items ({invoice.lineItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {invoice.lineItems.map((item) => (
              <div key={item.id} className="rounded-lg bg-gray-50 p-3">
                <div className="mb-2 flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{item.itemName}</div>
                    <div className="text-xs text-gray-500">{item.itemCode}</div>
                    {item.description && (
                      <div className="mt-1 text-xs text-gray-600">{item.description}</div>
                    )}
                  </div>
                  <div className="ml-2 text-right">
                    <div className="text-sm font-bold">{formatCurrency(item.lineTotal)}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <div>Qty: {item.quantity}</div>
                  <div>@ {formatCurrency(item.unitPrice)}</div>
                  {item.discount > 0 && <div className="text-orange-600">-{item.discount}%</div>}
                  {item.taxRate > 0 && <div className="text-blue-600">Tax: {item.taxRate}%</div>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Totals */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-base">
              <DollarSign className="mr-2 h-4 w-4" />
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
              <span className="text-lg font-bold">{formatCurrency(invoice.totalAmount)}</span>
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
                <div className="text-sm font-semibold">{invoice.primaryEmployeeName}</div>
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
