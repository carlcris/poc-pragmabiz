"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface CommissionByPeriodProps {
  dateRange?: {
    from: Date;
    to: Date;
  };
}

export function CommissionByPeriod({ dateRange }: CommissionByPeriodProps) {
  void dateRange;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Commission by Period</CardTitle>
        <CardDescription>Trend analysis and period comparisons (Coming soon)</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="py-8 text-center text-sm text-muted-foreground">
          Period analysis feature will be available soon
        </p>
      </CardContent>
    </Card>
  );
}
