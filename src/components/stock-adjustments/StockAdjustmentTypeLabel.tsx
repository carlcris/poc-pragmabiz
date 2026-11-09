"use client";

import { useTranslations } from "next-intl";
import type { StockAdjustmentType } from "@/types/stock-adjustment";

type StockAdjustmentTypeLabelProps = {
  type: StockAdjustmentType;
};

export function StockAdjustmentTypeLabel({ type }: StockAdjustmentTypeLabelProps) {
  const t = useTranslations("stockAdjustmentsPage");

  switch (type) {
    case "physical_count":
      return t("physicalCount");
    case "damage":
      return t("damage");
    case "loss":
      return t("loss");
    case "found":
      return t("found");
    case "quality_issue":
      return t("qualityIssue");
    case "other":
      return t("other");
  }
}
