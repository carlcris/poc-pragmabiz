"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { DocumentPageFallback } from "@/components/document-page/DocumentPageFallback";
import { StockRequisitionDetails } from "@/components/stock-requisitions/StockRequisitionDetails";
import { useStockRequisition } from "@/hooks/useStockRequisitions";

export default function StockRequisitionDetailPage() {
  const t = useTranslations("stockRequisitionPage");
  const params = useParams<{ id: string }>();
  const stockRequisitionId = typeof params.id === "string" ? params.id : "";
  const { data: stockRequisition, isLoading, error } = useStockRequisition(stockRequisitionId);

  if (isLoading) return <DocumentPageFallback state="loading" label={t("loading")} />;
  if (error || !stockRequisition) {
    return (
      <DocumentPageFallback
        state="message"
        message={error ? t("loadError") : t("notFound")}
        isError={Boolean(error)}
        actionHref="/purchasing/stock-requisitions"
        actionLabel={t("backToStockRequisitions")}
      />
    );
  }

  return <StockRequisitionDetails stockRequisition={stockRequisition} />;
}
