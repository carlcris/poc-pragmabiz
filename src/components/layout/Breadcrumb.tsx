"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { deliveryNotesApi } from "@/lib/api/delivery-notes";
import { DELIVERY_NOTES_QUERY_KEY } from "@/hooks/useDeliveryNotes";

const pathNameMap: Record<string, string> = {
  dashboard: "Dashboard",
  inventory: "Inventory",
  items: "Item Master",
  warehouses: "Warehouses",
  stock: "Stock Transactions",
  adjustments: "Stock Adjustments",
  "stock-requests": "Stock Requests",
  "delivery-notes": "Delivery Notes",
  "pick-lists": "Pick Lists",
  transformations: "Stock Transformations",
  reorder: "Reorder Management",
  purchasing: "Purchasing",
  overview: "Overview",
  suppliers: "Suppliers",
  "stock-requisitions": "Stock Requisitions",
  "load-lists": "Load Lists",
  grns: "Goods Receipt Notes",
  reports: "Reports",
  admin: "Admin",
  users: "Users",
  roles: "Roles",
  settings: "Company Settings",
  "business-units": "Business Units",
};

export function Breadcrumb() {
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
      ? "Stock Requisition Details"
      : parentSegment === "load-lists"
        ? "Load List Details"
        : parentSegment === "grns"
          ? "GRN Details"
          : parentSegment === "delivery-notes"
            ? "Delivery Note Details"
          : pathNameMap[lastSegment] || lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1);

  if (isDeliveryNoteDetail) {
    return (
      <nav className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground">
        <Link
          href="/dashboard"
          className="flex items-center hover:text-foreground transition-colors font-medium"
        >
          Home
        </Link>
        <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
        <Link
          href="/inventory/delivery-notes"
          className="flex items-center hover:text-foreground transition-colors font-medium"
        >
          Delivery Note
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
        Home
      </Link>
      <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
      <span className="font-medium text-foreground">{currentPageLabel}</span>
    </nav>
  );
}
