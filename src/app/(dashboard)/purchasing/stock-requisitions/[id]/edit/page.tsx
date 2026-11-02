"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { DocumentPageFallback } from "@/components/document-page/DocumentPageFallback";
import { StockRequisitionEditor } from "@/components/stock-requisitions/StockRequisitionEditor";
import { RESOURCES } from "@/constants/resources";
import { usePermissions, useResourcePermissions } from "@/hooks/usePermissions";
import { useStockRequisition } from "@/hooks/useStockRequisitions";
import { canEditStockRequisition } from "@/lib/stock-requisitions/editability";

export default function EditStockRequisitionPage() {
  const t = useTranslations("stockRequisitionPage");
  const params = useParams<{ id: string }>();
  const stockRequisitionId = typeof params.id === "string" ? params.id : "";
  const { data: stockRequisition, isLoading, error } = useStockRequisition(stockRequisitionId);
  const { canEdit } = useResourcePermissions(RESOURCES.STOCK_REQUISITIONS);
  const { isLoading: isLoadingPermissions } = usePermissions();

  if (isLoading || isLoadingPermissions) {
    return <DocumentPageFallback state="loading" label={t("loading")} />;
  }
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
  if (!canEditStockRequisition(stockRequisition, canEdit)) {
    return (
      <DocumentPageFallback
        state="message"
        message={t("notEditable")}
        actionHref={`/purchasing/stock-requisitions/${stockRequisition.id}`}
        actionLabel={t("viewStockRequisition")}
      />
    );
  }

  return <StockRequisitionEditor key={stockRequisition.id} stockRequisition={stockRequisition} />;
}
