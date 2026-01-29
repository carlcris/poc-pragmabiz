"use client";

import { useState } from "react";
import { MobileHeader } from "@/components/mobile/MobileHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCommissionSummary } from "@/hooks/useCommission";
import { useCurrency } from "@/hooks/useCurrency";
import { useUserVanWarehouse } from "@/hooks/useVanWarehouse";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { DollarSign, TrendingUp, CheckCircle, Clock, Calendar, AlertCircle } from "lucide-react";

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
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

export default function MobileCommissionsPage() {
  const { formatCurrency } = useCurrency();
  const { data: userData, isLoading: userLoading } = useUserVanWarehouse();
  const [dateRange] = useState({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  const { data, isLoading } = useCommissionSummary({
    dateFrom: dateRange.from,
    dateTo: dateRange.to,
    employeeId: userData?.employeeId || undefined,
  });

  const summary = data?.summary;
  const commissions = data?.commissions || [];

  if (userLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <MobileHeader title="My Commissions" showBack backHref="/mobile/view" />
        <div className="p-4">
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  if (!userData?.employeeId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <MobileHeader title="My Commissions" showBack backHref="/mobile/view" />
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
      <MobileHeader
        title="My Commissions"
        showBack
        backHref="/mobile/view"
        subtitle={`${format(dateRange.from, "MMM dd")} - ${format(dateRange.to, "MMM dd")}`}
      />

      {/* Summary Cards */}
      <div className="space-y-3 p-4">
        {isLoading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <>
            {/* Total Commission Card */}
            <Card className="bg-gradient-to-br from-green-600 to-green-500 text-white shadow-lg">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="mb-1 text-sm opacity-90">Total Commission</div>
                    <div className="text-3xl font-bold">
                      {formatCurrency(summary?.totalCommission || 0)}
                    </div>
                    <div className="mt-1 text-xs opacity-80">
                      From {summary?.transactionCount || 0} transactions
                    </div>
                  </div>
                  <DollarSign className="h-14 w-14 opacity-50" />
                </div>
              </CardContent>
            </Card>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Paid Commission */}
              <Card>
                <CardContent className="p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="rounded-lg bg-emerald-100 p-2">
                      <CheckCircle className="h-5 w-5 text-emerald-600" />
                    </div>
                  </div>
                  <div className="mb-1 text-xs text-gray-500">Paid</div>
                  <div className="text-lg font-bold text-gray-900">
                    {formatCurrency(summary?.paidCommission || 0)}
                  </div>
                </CardContent>
              </Card>

              {/* Pending Commission */}
              <Card>
                <CardContent className="p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="rounded-lg bg-orange-100 p-2">
                      <Clock className="h-5 w-5 text-orange-600" />
                    </div>
                  </div>
                  <div className="mb-1 text-xs text-gray-500">Pending</div>
                  <div className="text-lg font-bold text-gray-900">
                    {formatCurrency(summary?.pendingCommission || 0)}
                  </div>
                </CardContent>
              </Card>

              {/* Total Sales */}
              <Card>
                <CardContent className="p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="rounded-lg bg-blue-100 p-2">
                      <TrendingUp className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                  <div className="mb-1 text-xs text-gray-500">Total Sales</div>
                  <div className="text-lg font-bold text-gray-900">
                    {formatCurrency(summary?.totalSales || 0)}
                  </div>
                </CardContent>
              </Card>

              {/* Effective Rate */}
              <Card>
                <CardContent className="p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="rounded-lg bg-purple-100 p-2">
                      <DollarSign className="h-5 w-5 text-purple-600" />
                    </div>
                  </div>
                  <div className="mb-1 text-xs text-gray-500">Avg Rate</div>
                  <div className="text-lg font-bold text-gray-900">
                    {summary?.effectiveRate.toFixed(2)}%
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Commission Details */}
            <div className="mt-6">
              <h3 className="mb-3 px-1 text-sm font-semibold text-gray-700">
                Commission Details ({commissions.length})
              </h3>

              {commissions.length === 0 ? (
                <Card>
                  <CardContent className="py-8">
                    <div className="text-center">
                      <DollarSign className="mx-auto mb-2 h-12 w-12 text-gray-300" />
                      <p className="text-sm text-gray-500">No commission records found</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {commissions.map((commission) => (
                    <Card key={commission.id} className="transition-shadow hover:shadow-md">
                      <CardContent className="p-4">
                        <div className="mb-3 flex items-start justify-between">
                          <div className="flex-1">
                            <div className="mb-1 text-sm font-semibold">
                              {commission.invoiceCode}
                            </div>
                            <div className="mb-1 flex items-center text-xs text-gray-500">
                              <Calendar className="mr-1 h-3 w-3" />
                              {format(new Date(commission.invoiceDate), "MMM dd, yyyy")}
                            </div>
                          </div>
                          {getStatusBadge(commission.invoiceStatus)}
                        </div>

                        <div className="flex items-center justify-between border-t pt-3">
                          <div>
                            <div className="text-xs text-gray-500">Invoice Amount</div>
                            <div className="text-sm font-semibold text-gray-700">
                              {formatCurrency(commission.invoiceAmount)}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-xs text-gray-500">Rate</div>
                            <div className="text-sm font-semibold text-gray-700">
                              {Number(commission.commissionRate).toFixed(2)}%
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-gray-500">Commission</div>
                            <div className="text-base font-bold text-green-600">
                              {formatCurrency(commission.commissionAmount)}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
