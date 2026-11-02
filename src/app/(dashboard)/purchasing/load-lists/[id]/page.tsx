"use client";

import { useParams } from "next/navigation";
import { LoadListDetails } from "@/components/load-lists/LoadListDetails";
import { LoadListPageFallback } from "@/components/load-lists/LoadListPageFallback";
import { useLoadList } from "@/hooks/useLoadLists";

export default function LoadListDetailPage() {
  const params = useParams<{ id: string }>();
  const loadListId = typeof params.id === "string" ? params.id : "";
  const { data: loadList, isLoading, error } = useLoadList(loadListId);

  if (isLoading) return <LoadListPageFallback state="loading" />;
  if (error) return <LoadListPageFallback state="error" />;
  if (!loadList) return <LoadListPageFallback state="notFound" />;

  return <LoadListDetails loadList={loadList} />;
}
