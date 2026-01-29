"use client";

import { useState } from "react";
import { MobileHeader } from "@/components/mobile/MobileHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useCurrency } from "@/hooks/useCurrency";
import { useUserVanWarehouse } from "@/hooks/useVanWarehouse";
import { FileText, ChevronRight, Calendar, User, AlertCircle } from "lucide-react";
import Link from "next/link";

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  invoiceDate: string;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  status: string;
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

export default function MobileInvoicesPage() {
  const { formatCurrency } = useCurrency();
  const [filter, setFilter] = useState<string>("all");
  const { data: userData, isLoading: userLoading } = useUserVanWarehouse();

  const { data, isLoading } = useQuery({
    queryKey: ["mobile-invoices", filter, userData?.employeeId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter !== "all") {
        params.set("status", filter);
      }
      if (userData?.employeeId) {
        params.set("employeeId", userData.employeeId);
      }
      params.set("limit", "50");

      const response = await fetch(`/api/invoices?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch invoices");
      return response.json();
    },
    enabled: !!userData?.employeeId,
  });

  const invoices: Invoice[] = data?.data || [];

  const filters = [
    { label: "All", value: "all" },
    { label: "Paid", value: "paid" },
    { label: "Sent", value: "sent" },
    { label: "Draft", value: "draft" },
  ];

  if (userLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <MobileHeader title="Sales Invoices" showBack backHref="/mobile/view" />
        <div className="p-4">
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  if (!userData?.employeeId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <MobileHeader title="Sales Invoices" showBack backHref="/mobile/view" />
        <div className="p-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You have not been assigned as an employee. Please contact your administrator.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileHeader title="Sales Invoices" showBack backHref="/mobile/view" />

      {/* Filters */}
      <div className="sticky top-0 z-10 border-b bg-white px-4 py-3">
        <div className="scrollbar-hide flex gap-2 overflow-x-auto">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                filter === f.value
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-gray-700 active:bg-gray-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Invoice List */}
      <div className="space-y-3 p-4">
        {isLoading ? (
          <>
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="mb-2 h-5 w-32" />
                  <Skeleton className="mb-3 h-4 w-24" />
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : invoices.length === 0 ? (
          <div className="py-12 text-center">
            <FileText className="mx-auto mb-3 h-12 w-12 text-gray-300" />
            <p className="text-gray-500">No invoices found</p>
          </div>
        ) : (
          invoices.map((invoice) => (
            <Link key={invoice.id} href={`/mobile/view/invoices/${invoice.id}`}>
              <Card className="active:scale-98 cursor-pointer transition-shadow hover:shadow-md">
                <CardContent className="p-4">
                  <div className="mb-2 flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-1 text-base font-semibold">{invoice.invoiceNumber}</div>
                      <div className="mb-1 flex items-center text-sm text-gray-600">
                        <User className="mr-1 h-3.5 w-3.5" />
                        {invoice.customerName}
                      </div>
                      <div className="flex items-center text-xs text-gray-500">
                        <Calendar className="mr-1 h-3 w-3" />
                        {format(new Date(invoice.invoiceDate), "MMM dd, yyyy")}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {getStatusBadge(invoice.status)}
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t pt-3">
                    <div>
                      <div className="text-xs text-gray-500">Total Amount</div>
                      <div className="text-lg font-bold text-gray-900">
                        {formatCurrency(invoice.totalAmount)}
                      </div>
                    </div>
                    {invoice.amountDue > 0 && (
                      <div className="text-right">
                        <div className="text-xs text-gray-500">Amount Due</div>
                        <div className="text-base font-semibold text-orange-600">
                          {formatCurrency(invoice.amountDue)}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
