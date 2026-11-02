"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { DocumentPageFallback } from "@/components/document-page/DocumentPageFallback";
import { LoadListEditor } from "@/components/load-lists/LoadListEditor";
import { RESOURCES } from "@/constants/resources";
import { useLoadList } from "@/hooks/useLoadLists";
import { usePermissions, useResourcePermissions } from "@/hooks/usePermissions";
import { canEditLoadList } from "@/lib/load-lists/editability";

export default function EditLoadListPage() {
  const t = useTranslations("loadListPage");
  const params = useParams<{ id: string }>();
  const loadListId = typeof params.id === "string" ? params.id : "";
  const { data: loadList, isLoading, error } = useLoadList(loadListId);
  const { canEdit } = useResourcePermissions(RESOURCES.LOAD_LISTS);
  const { isLoading: isLoadingPermissions } = usePermissions();

  if (isLoading || isLoadingPermissions) {
    return <DocumentPageFallback state="loading" label={t("loading")} />;
  }
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
  if (!canEditLoadList(loadList, canEdit)) {
    return (
      <DocumentPageFallback
        state="message"
        message={t("notEditable")}
        actionHref={`/purchasing/load-lists/${loadList.id}`}
        actionLabel={t("viewLoadList")}
      />
    );
  }

  return <LoadListEditor key={loadList.id} loadList={loadList} />;
}
