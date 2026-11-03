"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { DocumentPageFallback } from "@/components/document-page/DocumentPageFallback";
import { StockRequestEditor } from "@/components/stock-requests/StockRequestEditor";
import { RESOURCES } from "@/constants/resources";
import { usePermissions, useResourcePermissions } from "@/hooks/usePermissions";
import { useStockRequest } from "@/hooks/useStockRequests";
import { canEditStockRequest } from "@/lib/stock-requests/stock-request-access";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";

export default function EditStockRequestPage() {
  const t = useTranslations("stockRequestPage");
  const params = useParams<{ id: string }>();
  const stockRequestId = typeof params.id === "string" ? params.id : "";
  const { data: stockRequest, isLoading, error } = useStockRequest(stockRequestId);
  const { canEdit } = useResourcePermissions(RESOURCES.STOCK_REQUESTS);
  const { isLoading: isLoadingPermissions } = usePermissions();
  const currentBusinessUnitId = useBusinessUnitStore((state) => state.currentBusinessUnit?.id);

  if (isLoading || isLoadingPermissions) {
    return <DocumentPageFallback state="loading" label={t("loading")} />;
  }
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
  if (!canEditStockRequest(stockRequest, currentBusinessUnitId, canEdit)) {
    return (
      <DocumentPageFallback
        state="message"
        message={t("notEditable")}
        actionHref={`/inventory/stock-requests/${stockRequest.id}`}
        actionLabel={t("viewStockRequest")}
      />
    );
  }

  return <StockRequestEditor key={stockRequest.id} stockRequest={stockRequest} />;
}
