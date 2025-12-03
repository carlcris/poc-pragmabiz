"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useCommissionSummary } from "@/hooks/useCommission";
import { useCurrency } from "@/hooks/useCurrency";
import { format } from "date-fns";

interface CommissionDetailsProps {
  dateRange?: {
    from: Date;
    to: Date;
  };
  employeeId?: string;
}

export function CommissionDetails({ dateRange, employeeId }: CommissionDetailsProps) {
  const { formatCurrency } = useCurrency();
  const { data, isLoading } = useCommissionSummary({
    dateFrom: dateRange?.from,
    dateTo: dateRange?.to,
    employeeId,
  });

  const commissions = data?.commissions || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge variant="default" className="bg-green-600">Paid</Badge>;
      case "partially_paid":
        return <Badge variant="default" className="bg-orange-500">Partially Paid</Badge>;
      case "sent":
        return <Badge variant="secondary">Sent</Badge>;
      case "overdue":
        return <Badge variant="destructive">Overdue</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Commission Details</CardTitle>
        <CardDescription>
          Detailed breakdown of all commission records
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : commissions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No commission records found for the selected period
          </p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-right">Invoice Amount</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Split %</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissions.map((commission) => (
                  <TableRow key={commission.id}>
                    <TableCell className="font-medium">
                      <code className="text-xs">{commission.invoiceCode}</code>
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(commission.invoiceDate), "MMM dd, yyyy")}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium text-sm">{commission.employeeName}</div>
                        <div className="text-xs text-muted-foreground">{commission.employeeCode}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(commission.invoiceAmount)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                      {Number(commission.commissionRate).toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                      {Number(commission.splitPercentage).toFixed(0)}%
                    </TableCell>
                    <TableCell className="text-right font-semibold text-green-600">
                      {formatCurrency(commission.commissionAmount)}
                    </TableCell>
                    <TableCell>{getStatusBadge(commission.invoiceStatus)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
