"use client";

import { useState } from "react";
import { MobileHeader } from "@/components/mobile/MobileHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";
import { useUserVanWarehouse } from "@/hooks/useVanWarehouse";
import {
  AlertCircle,
  Calendar,
  DollarSign,
  ShoppingCart,
  Package,
  TrendingUp,
  Receipt,
} from "lucide-react";

interface SalesSummary {
  totalSales: number;
  transactions: number;
  itemsSold: number;
  averageTransactionValue: number;
}

export default function SalesSummaryPage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: vanData, isLoading: vanLoading } = useUserVanWarehouse();

  // Fetch sales summary for the selected date
  const { data: salesData, isLoading: salesLoading } = useQuery({
    queryKey: ["sales-summary", vanData?.vanWarehouseId, selectedDate],
    queryFn: async () => {
      if (!vanData?.vanWarehouseId) return null;

      const params = new URLSearchParams({
        date: selectedDate,
      });

      const response = await fetch(`/api/van-sales/stats?${params}`);
      if (!response.ok) throw new Error("Failed to fetch sales data");
      const result = await response.json();

      // Calculate average transaction value
      const avgTransactionValue = result.transactions > 0
        ? result.todaySales / result.transactions
        : 0;

      return {
        totalSales: result.todaySales,
        transactions: result.transactions,
        itemsSold: result.itemsSold,
        averageTransactionValue: avgTransactionValue,
        invoices: result.invoices || [],
      };
    },
    enabled: !!vanData?.vanWarehouseId,
  });

  if (vanLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <MobileHeader
          title="Sales Summary"
          showBack
          backHref="/mobile/reports"
        />
        <div className="p-4">
          <Skeleton className="h-32 w-full mb-4" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  if (!vanData?.vanWarehouseId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <MobileHeader
          title="Sales Summary"
          showBack
          backHref="/mobile/reports"
        />
        <div className="p-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You have not been assigned to a van warehouse. Please contact your supervisor.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const isLoading = salesLoading;
  const summary: SalesSummary = salesData || {
    totalSales: 0,
    transactions: 0,
    itemsSold: 0,
    averageTransactionValue: 0,
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      <MobileHeader
        title="Sales Summary"
        showBack
        backHref="/mobile/reports"
        subtitle={vanData?.vanWarehouse?.name}
      />

      <div className="p-4 space-y-4">
        {/* Date Filter */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Select Date
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
            />
          </CardContent>
        </Card>

        {isLoading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <>
            {/* Total Sales */}
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Total Sales</div>
                    <div className="text-2xl font-bold text-green-600">
                      ₱{summary.totalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Number of Transactions */}
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Transactions</div>
                    <div className="text-2xl font-bold text-blue-600">
                      {summary.transactions}
                    </div>
                  </div>
                  <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <Receipt className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Items Sold */}
            <Card className="border-l-4 border-l-purple-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Items Sold</div>
                    <div className="text-2xl font-bold text-purple-600">
                      {summary.itemsSold}
                    </div>
                  </div>
                  <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <Package className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Average Transaction Value */}
            <Card className="border-l-4 border-l-orange-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Avg. Transaction Value</div>
                    <div className="text-2xl font-bold text-orange-600">
                      ₱{summary.averageTransactionValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Performance Message */}
            {summary.totalSales > 0 ? (
              <Card className="bg-gradient-to-r from-green-50 to-blue-50">
                <CardContent className="p-4 text-center">
                  <div className="flex items-center justify-center gap-2 text-green-700 font-semibold">
                    <TrendingUp className="h-5 w-5" />
                    <span>Great work! Keep it up!</span>
                  </div>
                  {summary.transactions > 0 && (
                    <p className="text-sm text-gray-600 mt-2">
                      You made {summary.transactions} {summary.transactions === 1 ? 'sale' : 'sales'} today
                    </p>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-gray-50">
                <CardContent className="p-4 text-center">
                  <ShoppingCart className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500">No sales recorded for this date</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Sales data will appear here once transactions are made
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
