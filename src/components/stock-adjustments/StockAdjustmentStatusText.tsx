"use client";

import { useTranslations } from "next-intl";
import { StatusText } from "@/components/shared/StatusText";
import type { StockAdjustmentStatus } from "@/types/stock-adjustment";

type StockAdjustmentStatusTextProps = {
  status: StockAdjustmentStatus;
  className?: string;
};

export function StockAdjustmentStatusText({ status, className }: StockAdjustmentStatusTextProps) {
  const t = useTranslations("stockAdjustmentsPage");

  switch (status) {
    case "draft":
      return (
        <StatusText tone="muted" className={className}>
          {t("draft")}
        </StatusText>
      );
    case "pending":
      return (
        <StatusText tone="yellow" className={className}>
          {t("pending")}
        </StatusText>
      );
    case "approved":
      return (
        <StatusText tone="blue" className={className}>
          {t("approved")}
        </StatusText>
      );
    case "posted":
      return (
        <StatusText tone="green" className={className}>
          {t("posted")}
        </StatusText>
      );
    case "rejected":
      return (
        <StatusText tone="red" className={className}>
          {t("rejected")}
        </StatusText>
      );
  }
}
