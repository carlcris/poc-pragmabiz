"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { deliveryNotesApi } from "@/lib/api/delivery-notes";
import { itemsApi } from "@/lib/api/items";
import { suppliersApi } from "@/lib/api/suppliers";
import { DELIVERY_NOTES_QUERY_KEY } from "@/hooks/useDeliveryNotes";

export function Breadcrumb() {
  const t = useTranslations("navigation");
  const tReports = useTranslations("reportsPage");
  const tAdminSettingsIndex = useTranslations("adminSettings.index");
  const tAdminSettingsPages = useTranslations("adminSettings.pages");
  const pathname = usePathname();
  const pathSegments = pathname.split("/").filter(Boolean);

  const lastSegment = pathSegments[pathSegments.length - 1];
  const parentSegment = pathSegments[pathSegments.length - 2];
  const parentPath = `/${pathSegments.slice(0, -1).join("/")}`;
  const isDeliveryNoteDetail = parentSegment === "delivery-notes" && pathSegments.length >= 3;
  const deliveryNoteId = isDeliveryNoteDetail ? lastSegment : "";
  const isItemCreate = pathname === "/inventory/items/create";
  const isItemDetail =
    parentSegment === "items" &&
    pathSegments.length >= 3 &&
    lastSegment !== "edit" &&
    !isItemCreate;
  const isItemEdit = lastSegment === "edit" && pathSegments[pathSegments.length - 3] === "items";
  const isSupplierDetail =
    pathSegments[0] === "purchasing" && parentSegment === "suppliers" && pathSegments.length >= 3;
  const isWarehouseLocations =
    lastSegment === "locations" && pathSegments[pathSegments.length - 3] === "warehouses";
  const isTransformationTemplateDesigner =
    pathname === "/inventory/transformations/templates/design";
  const isAdminSettingsPage =
    pathSegments[0] === "admin" && pathSegments[1] === "settings" && pathSegments.length >= 2;
  const itemId = isItemEdit
    ? pathSegments[pathSegments.length - 2]
    : isItemDetail
      ? lastSegment
      : "";
  const supplierId = isSupplierDetail ? lastSegment : "";
  const adminSettingsLabelMap: Record<string, string> = {
    settings: tAdminSettingsIndex("title"),
    company: tAdminSettingsPages("companyTitle"),
    "business-unit": tAdminSettingsPages("businessUnitTitle"),
    financial: tAdminSettingsPages("financialTitle"),
    inventory: tAdminSettingsPages("inventoryTitle"),
    pos: tAdminSettingsPages("posTitle"),
    workflow: tAdminSettingsPages("workflowTitle"),
    integration: tAdminSettingsPages("integrationTitle"),
    security: tAdminSettingsPages("securityTitle"),
  };
  const reportLabelMap: Record<string, string> = {
    stock: tReports("stockReportsName"),
    "stock-aging": tReports("stockAgingName"),
    shipments: tReports("shipmentsReportName"),
    "item-location-batch": tReports("itemLocationBatchName"),
    "picking-efficiency": tReports("pickingEfficiencyName"),
    "transformation-efficiency": tReports("transformationEfficiencyName"),
  };
  const shouldShowParentCrumb =
    pathSegments.length >= 3 &&
    !isDeliveryNoteDetail &&
    !isItemCreate &&
    !isItemDetail &&
    !isItemEdit &&
    !isSupplierDetail &&
    !isWarehouseLocations &&
    !!parentSegment &&
    (isAdminSettingsPage ? parentSegment in adminSettingsLabelMap : t.has(parentSegment));
  const isReportChildPage = parentSegment === "reports" && pathSegments.length >= 2;

  const { data: deliveryNote } = useQuery({
    queryKey: [DELIVERY_NOTES_QUERY_KEY, deliveryNoteId],
    queryFn: () => deliveryNotesApi.getById(deliveryNoteId),
    enabled: !!deliveryNoteId,
  });

  const { data: itemResponse, isLoading: isItemLoading } = useQuery({
    queryKey: ["items", itemId],
    queryFn: () => itemsApi.getItem(itemId),
    enabled: !!itemId,
  });

  const { data: supplier, isLoading: isSupplierLoading } = useQuery({
    queryKey: ["suppliers", supplierId],
    queryFn: () => suppliersApi.getSupplier(supplierId),
    enabled: !!supplierId,
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
            : isTransformationTemplateDesigner
              ? "Designer"
              : isAdminSettingsPage && adminSettingsLabelMap[lastSegment]
                ? adminSettingsLabelMap[lastSegment]
                : parentSegment === "reports" && reportLabelMap[lastSegment]
                  ? reportLabelMap[lastSegment]
                  : t.has(lastSegment)
                    ? t(lastSegment)
                    : lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1);

  if (isDeliveryNoteDetail) {
    return (
      <nav className="flex items-center gap-1 text-xs text-muted-foreground sm:text-sm">
        <Link
          href="/dashboard"
          className="flex items-center font-medium transition-colors hover:text-foreground"
        >
          {t("Home")}
        </Link>
        <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
        <Link
          href="/inventory/delivery-notes"
          className="flex items-center font-medium transition-colors hover:text-foreground"
        >
          {t("Delivery Note")}
        </Link>
        <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
        <span className="font-medium text-foreground">{deliveryNote?.dn_no || lastSegment}</span>
      </nav>
    );
  }

  if (isItemCreate || isItemDetail || isItemEdit) {
    const itemLabel = isItemCreate
      ? t("Create Item")
      : isItemEdit
        ? t("Edit Item")
        : itemResponse?.data?.name || "";

    return (
      <nav className="flex items-center gap-1 text-xs text-muted-foreground sm:text-sm">
        <Link
          href="/dashboard"
          className="flex items-center font-medium transition-colors hover:text-foreground"
        >
          {t("Home")}
        </Link>
        <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
        <Link
          href="/inventory/items"
          className="flex items-center font-medium transition-colors hover:text-foreground"
        >
          {t("Item Master")}
        </Link>
        <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
        {itemLabel ? (
          <span className="font-medium text-foreground">{itemLabel}</span>
        ) : isItemLoading ? (
          <span aria-label="Loading" className="h-4 w-40 animate-pulse rounded bg-muted" />
        ) : (
          <span className="font-medium text-foreground">{t("Item Master")}</span>
        )}
      </nav>
    );
  }

  if (isSupplierDetail) {
    return (
      <nav className="flex items-center gap-1 text-xs text-muted-foreground sm:text-sm">
        <Link
          href="/dashboard"
          className="flex items-center font-medium transition-colors hover:text-foreground"
        >
          {t("Home")}
        </Link>
        <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
        <Link
          href="/purchasing/suppliers"
          className="flex items-center font-medium transition-colors hover:text-foreground"
        >
          {t("Suppliers")}
        </Link>
        <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
        {supplier ? (
          <span className="font-medium text-foreground">{supplier.name || supplier.code}</span>
        ) : isSupplierLoading ? (
          <span aria-label="Loading" className="h-4 w-40 animate-pulse rounded bg-muted" />
        ) : (
          <span className="font-medium text-foreground">{t("Suppliers")}</span>
        )}
      </nav>
    );
  }

  if (isWarehouseLocations) {
    return (
      <nav className="flex items-center gap-1 text-xs text-muted-foreground sm:text-sm">
        <Link
          href="/dashboard"
          className="flex items-center font-medium transition-colors hover:text-foreground"
        >
          {t("Home")}
        </Link>
        <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
        <Link
          href="/inventory/warehouses"
          className="flex items-center font-medium transition-colors hover:text-foreground"
        >
          {t("Warehouse")}
        </Link>
        <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
        <span className="font-medium text-foreground">{t("Location")}</span>
      </nav>
    );
  }

  return (
    <nav className="flex items-center gap-1 text-xs text-muted-foreground sm:text-sm">
      <Link
        href="/dashboard"
        className="flex items-center font-medium transition-colors hover:text-foreground"
      >
        {t("Home")}
      </Link>
      {isReportChildPage ? (
        <>
          <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
          <Link
            href="/reports"
            className="flex items-center font-medium transition-colors hover:text-foreground"
          >
            {tReports("title")}
          </Link>
          <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="font-medium text-foreground">{currentPageLabel}</span>
        </>
      ) : shouldShowParentCrumb ? (
        <>
          <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
          <Link
            href={parentPath}
            className="flex items-center font-medium transition-colors hover:text-foreground"
          >
            {isAdminSettingsPage ? adminSettingsLabelMap[parentSegment] : t(parentSegment)}
          </Link>
          <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="font-medium text-foreground">{currentPageLabel}</span>
        </>
      ) : (
        <>
          <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="font-medium text-foreground">{currentPageLabel}</span>
        </>
      )}
    </nav>
  );
}
