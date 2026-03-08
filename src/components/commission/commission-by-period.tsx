"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface CommissionByPeriodProps {
  dateRange?: {
    from: Date;
    to: Date;
  };
}

export function CommissionByPeriod({ dateRange }: CommissionByPeriodProps) {
  const t = useTranslations("commissionByPeriod");
  void dateRange;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="py-8 text-center text-sm text-muted-foreground">{t("description")}</p>
      </CardContent>
    </Card>
  );
}
