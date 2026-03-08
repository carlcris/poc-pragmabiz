"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { deliveryNotesApi } from "@/lib/api/delivery-notes";
import { DELIVERY_NOTES_QUERY_KEY } from "@/hooks/useDeliveryNotes";

export function Breadcrumb() {
  const t = useTranslations("navigation");
  const pathname = usePathname();
  const pathSegments = pathname.split("/").filter(Boolean);

  const lastSegment = pathSegments[pathSegments.length - 1];
  const parentSegment = pathSegments[pathSegments.length - 2];
  const isDeliveryNoteDetail = parentSegment === "delivery-notes" && pathSegments.length >= 3;
  const deliveryNoteId = isDeliveryNoteDetail ? lastSegment : "";

  const { data: deliveryNote } = useQuery({
    queryKey: [DELIVERY_NOTES_QUERY_KEY, deliveryNoteId],
    queryFn: () => deliveryNotesApi.getById(deliveryNoteId),
    enabled: !!deliveryNoteId,
  });

  // Handle detail pages that use dynamic ids in the URL.
  const currentPageLabel =
    parentSegment === "stock-requisitions"
      ? t("Stock Requisition Details")
      : parentSegment === "load-lists"
        ? t("Load List Details")
        : parentSegment === "grns"
          ? t("GRN Details")
          : parentSegment === "delivery-notes"
            ? t("Delivery Note Details")
          : t.has(lastSegment)
            ? t(lastSegment)
            : lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1);

  if (isDeliveryNoteDetail) {
    return (
      <nav className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground">
        <Link
          href="/dashboard"
          className="flex items-center hover:text-foreground transition-colors font-medium"
        >
          {t("Home")}
        </Link>
        <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
        <Link
          href="/inventory/delivery-notes"
          className="flex items-center hover:text-foreground transition-colors font-medium"
        >
          {t("Delivery Note")}
        </Link>
        <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
        <span className="font-medium text-foreground">{deliveryNote?.dn_no || lastSegment}</span>
      </nav>
    );
  }

  return (
    <nav className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground">
      <Link
        href="/dashboard"
        className="flex items-center hover:text-foreground transition-colors font-medium"
      >
        {t("Home")}
      </Link>
      <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
      <span className="font-medium text-foreground">{currentPageLabel}</span>
    </nav>
  );
}
