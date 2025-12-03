"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCommissionSummary } from "@/hooks/useCommission";

interface CommissionByPeriodProps {
  dateRange?: {
    from: Date;
    to: Date;
  };
}

export function CommissionByPeriod({ dateRange }: CommissionByPeriodProps) {
  const { data, isLoading } = useCommissionSummary({
    dateFrom: dateRange?.from,
    dateTo: dateRange?.to,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Commission by Period</CardTitle>
        <CardDescription>
          Trend analysis and period comparisons (Coming soon)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground text-center py-8">
          Period analysis feature will be available soon
        </p>
      </CardContent>
    </Card>
  );
}
