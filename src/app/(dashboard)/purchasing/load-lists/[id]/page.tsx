"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { DocumentPageFallback } from "@/components/document-page/DocumentPageFallback";
import { LoadListDetails } from "@/components/load-lists/LoadListDetails";
import { useLoadList } from "@/hooks/useLoadLists";

export default function LoadListDetailPage() {
  const t = useTranslations("loadListPage");
  const params = useParams<{ id: string }>();
  const loadListId = typeof params.id === "string" ? params.id : "";
  const { data: loadList, isLoading, error } = useLoadList(loadListId);

  if (isLoading) return <DocumentPageFallback state="loading" label={t("loading")} />;
  if (error || !loadList) {
    return (
      <DocumentPageFallback
        state="message"
        message={error ? t("loadError") : t("notFound")}
        isError={Boolean(error)}
        actionHref="/purchasing/load-lists"
        actionLabel={t("backToLoadLists")}
      />
    );
  }

  return <LoadListDetails loadList={loadList} />;
}
