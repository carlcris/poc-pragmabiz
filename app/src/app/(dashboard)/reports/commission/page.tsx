"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, Users, TrendingUp } from "lucide-react";
import { CommissionSummary } from "@/components/commission/commission-summary";
import { CommissionDetails } from "@/components/commission/commission-details";
import { CommissionByPeriod } from "@/components/commission/commission-by-period";

export default function CommissionReportsPage() {
  const [dateRange] = useState({
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date(),
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Commission Reports</h1>
          <p className="text-muted-foreground">
            Track and analyze employee commissions and earnings
          </p>
        </div>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="summary" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-[500px]">
          <TabsTrigger value="summary" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Summary
          </TabsTrigger>
          <TabsTrigger value="details" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Details
          </TabsTrigger>
          <TabsTrigger value="period" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            By Period
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-6">
          <CommissionSummary dateRange={dateRange} />
        </TabsContent>

        <TabsContent value="details" className="space-y-6">
          <CommissionDetails dateRange={dateRange} />
        </TabsContent>

        <TabsContent value="period" className="space-y-6">
          <CommissionByPeriod dateRange={dateRange} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
