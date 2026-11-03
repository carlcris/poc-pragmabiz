"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { DocumentPageFallback } from "@/components/document-page/DocumentPageFallback";
import { StockRequestDetails } from "@/components/stock-requests/StockRequestDetails";
import { useStockRequest } from "@/hooks/useStockRequests";

export default function StockRequestDetailPage() {
  const t = useTranslations("stockRequestPage");
  const params = useParams<{ id: string }>();
  const stockRequestId = typeof params.id === "string" ? params.id : "";
  const { data: stockRequest, isLoading, error } = useStockRequest(stockRequestId);

  if (isLoading) return <DocumentPageFallback state="loading" label={t("loading")} />;
  if (error || !stockRequest) {
    return (
      <DocumentPageFallback
        state="message"
        message={error ? t("loadError") : t("notFound")}
        isError={Boolean(error)}
        actionHref="/inventory/stock-requests"
        actionLabel={t("backToStockRequests")}
      />
    );
  }

  return <StockRequestDetails stockRequest={stockRequest} />;
}
