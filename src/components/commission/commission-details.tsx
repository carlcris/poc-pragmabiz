"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocale, useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useCommissionSummary } from "@/hooks/useCommission";
import { useCurrency } from "@/hooks/useCurrency";

interface CommissionDetailsProps {
  dateRange?: {
    from: Date;
    to: Date;
  };
  employeeId?: string;
}

export function CommissionDetails({ dateRange, employeeId }: CommissionDetailsProps) {
  const t = useTranslations("commissionDetails");
  const locale = useLocale();
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
        return (
          <Badge variant="default" className="bg-green-600">
            {t("paid")}
          </Badge>
        );
      case "partially_paid":
        return (
          <Badge variant="default" className="bg-orange-500">
            {t("partiallyPaid")}
          </Badge>
        );
      case "sent":
        return <Badge variant="secondary">{t("sent")}</Badge>;
      case "overdue":
        return <Badge variant="destructive">{t("overdue")}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : commissions.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("noRecords")}
          </p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("invoice")}</TableHead>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("employee")}</TableHead>
                  <TableHead className="text-right">{t("invoiceAmount")}</TableHead>
                  <TableHead className="text-right">{t("rate")}</TableHead>
                  <TableHead className="text-right">{t("splitPct")}</TableHead>
                  <TableHead className="text-right">{t("commission")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissions.map((commission) => (
                  <TableRow key={commission.id}>
                    <TableCell className="font-medium">
                      <code className="text-xs">{commission.invoiceCode}</code>
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "2-digit" }).format(new Date(commission.invoiceDate))}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="text-sm font-medium">{commission.employeeName}</div>
                        <div className="text-xs text-muted-foreground">
                          {commission.employeeCode}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(commission.invoiceAmount)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {Number(commission.commissionRate).toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
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
