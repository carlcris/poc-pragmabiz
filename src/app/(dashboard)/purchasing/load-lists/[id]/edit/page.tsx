"use client";

import { useParams } from "next/navigation";
import { LoadListEditor } from "@/components/load-lists/LoadListEditor";
import { LoadListPageFallback } from "@/components/load-lists/LoadListPageFallback";
import { RESOURCES } from "@/constants/resources";
import { useLoadList } from "@/hooks/useLoadLists";
import { usePermissions, useResourcePermissions } from "@/hooks/usePermissions";
import { canEditLoadList } from "@/lib/load-lists/editability";

export default function EditLoadListPage() {
  const params = useParams<{ id: string }>();
  const loadListId = typeof params.id === "string" ? params.id : "";
  const { data: loadList, isLoading, error } = useLoadList(loadListId);
  const { canEdit } = useResourcePermissions(RESOURCES.LOAD_LISTS);
  const { isLoading: isLoadingPermissions } = usePermissions();

  if (isLoading || isLoadingPermissions) return <LoadListPageFallback state="loading" />;
  if (error) return <LoadListPageFallback state="error" />;
  if (!loadList) return <LoadListPageFallback state="notFound" />;
  if (!canEditLoadList(loadList, canEdit)) {
    return <LoadListPageFallback state="notEditable" loadListId={loadList.id} />;
  }

  return <LoadListEditor key={loadList.id} loadList={loadList} />;
}
