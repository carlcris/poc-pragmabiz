"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { customersApi } from "@/lib/api/customers";
import { deliveryNotesApi } from "@/lib/api/delivery-notes";
import { itemsApi } from "@/lib/api/items";
import { loadListsApi } from "@/lib/api/load-lists";
import { stockRequisitionsApi } from "@/lib/api/stock-requisitions";
import { suppliersApi } from "@/lib/api/suppliers";
import { transformationOrdersApi } from "@/lib/api/transformation-orders";
import { transformationOrderIdSchema } from "@/lib/validations/transformation-order";
import { DELIVERY_NOTES_QUERY_KEY } from "@/hooks/useDeliveryNotes";
import { LOAD_LISTS_QUERY_KEY, STOCK_REQUISITIONS_QUERY_KEY } from "@/hooks/queryKeys";
import { useQuotation } from "@/hooks/useQuotations";
import { TRANSFORMATION_ORDERS_QUERY_KEY } from "@/hooks/useTransformationOrders";

type FrameJobOrderBreadcrumbResponse = {
  data: {
    jobOrderCode: string;
  };
};

const fetchFrameJobOrderBreadcrumb = async (
  id: string
): Promise<FrameJobOrderBreadcrumbResponse> => {
  const response = await fetch(`/api/frame-job-orders/${id}`, {
    credentials: "include",
  });

  if (!response.ok) throw new Error("FAILED_TO_LOAD_FRAME_JOB_ORDER");
  return response.json() as Promise<FrameJobOrderBreadcrumbResponse>;
};

const PURCHASING_DOCUMENT_ROUTES = [
  { segment: "load-lists", listLabelKey: "Load Lists", detailLabelKey: "Load List Details" },
  {
    segment: "stock-requisitions",
    listLabelKey: "Stock Requisitions",
    detailLabelKey: "Stock Requisition Details",
  },
] as const;

export function Breadcrumb() {
  const t = useTranslations("navigation");
  const tCommon = useTranslations("common");
  const tReports = useTranslations("reportsPage");
  const tAdminSettingsIndex = useTranslations("adminSettings.index");
  const tAdminSettingsPages = useTranslations("adminSettings.pages");
  const tWarehouses = useTranslations("warehousesPage");
  const pathname = usePathname();
  const pathSegments = pathname.split("/").filter(Boolean);

  const lastSegment = pathSegments[pathSegments.length - 1];
  const parentSegment = pathSegments[pathSegments.length - 2];
  const parentPath = `/${pathSegments.slice(0, -1).join("/")}`;
  const isDeliveryNoteDetail = parentSegment === "delivery-notes" && pathSegments.length >= 3;
  const deliveryNoteId = isDeliveryNoteDetail ? lastSegment : "";
  const isItemCreate = pathname === "/inventory/items/create";
  const isQuotationCreate = pathname === "/sales/quotations/create";
  const isSalesOrderCreate = pathname === "/sales/orders/create";
  // Full-page purchasing documents: /purchasing/<segment>/new, /<id>, and /<id>/edit.
  const purchasingDocument =
    pathSegments[0] === "purchasing" && pathSegments.length >= 3
      ? PURCHASING_DOCUMENT_ROUTES.find((route) => route.segment === pathSegments[1])
      : undefined;
  const isPurchasingDocumentCreate = !!purchasingDocument && pathSegments[2] === "new";
  const isPurchasingDocumentEdit =
    !!purchasingDocument && pathSegments.length === 4 && lastSegment === "edit";
  const purchasingDocumentId =
    purchasingDocument && !isPurchasingDocumentCreate ? pathSegments[2] : "";
  const isQuotationEdit =
    pathSegments[0] === "sales" &&
    pathSegments[1] === "quotations" &&
    pathSegments.length === 4 &&
    lastSegment === "edit";
  const isItemDetail =
    parentSegment === "items" &&
    pathSegments.length >= 3 &&
    lastSegment !== "edit" &&
    !isItemCreate;
  const isItemEdit = lastSegment === "edit" && pathSegments[pathSegments.length - 3] === "items";
  const isSupplierDetail =
    pathSegments[0] === "purchasing" && parentSegment === "suppliers" && pathSegments.length >= 3;
  const isCustomerDetail =
    pathSegments[0] === "sales" && parentSegment === "customers" && pathSegments.length >= 3;
  const isFrameJobOrderDetail =
    pathSegments[0] === "sales" &&
    parentSegment === "frame-job-orders" &&
    pathSegments.length === 3;
  const isTransformationOrderDetail =
    pathSegments[0] === "manufacturing" &&
    parentSegment === "transformations" &&
    pathSegments.length === 3 &&
    transformationOrderIdSchema.safeParse(lastSegment).success;
  const isWarehouseLocations =
    lastSegment === "locations" && pathSegments[pathSegments.length - 3] === "warehouses";
  const isWarehouseFloorMap =
    lastSegment === "floor-map" && pathSegments[pathSegments.length - 3] === "warehouses";
  const isTransformationTemplateDesigner =
    pathname === "/manufacturing/transformations/templates/design";
  const isAdminSettingsPage =
    pathSegments[0] === "admin" && pathSegments[1] === "settings" && pathSegments.length >= 2;
  const itemId = isItemEdit
    ? pathSegments[pathSegments.length - 2]
    : isItemDetail
      ? lastSegment
      : "";
  const supplierId = isSupplierDetail ? lastSegment : "";
  const customerId = isCustomerDetail ? lastSegment : "";
  const frameJobOrderId = isFrameJobOrderDetail ? lastSegment : "";
  const transformationOrderId = isTransformationOrderDetail ? lastSegment : "";
  const quotationId = isQuotationEdit ? pathSegments[2] : "";
  const loadListId = purchasingDocument?.segment === "load-lists" ? purchasingDocumentId : "";
  const stockRequisitionId =
    purchasingDocument?.segment === "stock-requisitions" ? purchasingDocumentId : "";
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
    !isCustomerDetail &&
    !isWarehouseLocations &&
    !isWarehouseFloorMap &&
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

  const { data: customer, isLoading: isCustomerLoading } = useQuery({
    queryKey: ["customers", customerId],
    queryFn: () => customersApi.getCustomer(customerId),
    enabled: !!customerId,
  });

  const { data: transformationOrderResponse, isLoading: isTransformationOrderLoading } = useQuery({
    queryKey: [TRANSFORMATION_ORDERS_QUERY_KEY, transformationOrderId],
    queryFn: () => transformationOrdersApi.getById(transformationOrderId),
    enabled: !!transformationOrderId,
  });

  const { data: quotation, isLoading: isQuotationLoading } = useQuotation(quotationId);

  // These share the page's cache entries, so the document number costs no extra request.
  const { data: loadList, isLoading: isLoadListLoading } = useQuery({
    queryKey: [LOAD_LISTS_QUERY_KEY, loadListId],
    queryFn: () => loadListsApi.getLoadList(loadListId),
    enabled: !!loadListId,
  });

  const { data: stockRequisition, isLoading: isStockRequisitionLoading } = useQuery({
    queryKey: [STOCK_REQUISITIONS_QUERY_KEY, stockRequisitionId],
    queryFn: () => stockRequisitionsApi.getStockRequisition(stockRequisitionId),
    enabled: !!stockRequisitionId,
  });
  const purchasingDocumentNumber = loadListId ? loadList?.llNumber : stockRequisition?.srNumber;
  const isPurchasingDocumentLoading = loadListId ? isLoadListLoading : isStockRequisitionLoading;

  const { data: frameJobOrderResponse, isLoading: isFrameJobOrderLoading } = useQuery({
    queryKey: ["frame-job-order", frameJobOrderId],
    queryFn: () => fetchFrameJobOrderBreadcrumb(frameJobOrderId),
    enabled: !!frameJobOrderId,
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

  if (isFrameJobOrderDetail) {
    const jobOrderCode = frameJobOrderResponse?.data.jobOrderCode;

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
          href="/sales/frame-job-orders"
          className="flex items-center font-medium transition-colors hover:text-foreground"
        >
          {t("Job Orders")}
        </Link>
        <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
        {jobOrderCode ? (
          <span className="font-medium text-foreground">{jobOrderCode}</span>
        ) : isFrameJobOrderLoading ? (
          <span
            aria-label={tCommon("loading")}
            className="h-4 w-40 animate-pulse rounded bg-muted"
          />
        ) : (
          <span className="font-medium text-foreground">{t("Job Orders")}</span>
        )}
      </nav>
    );
  }

  if (isQuotationCreate || isQuotationEdit) {
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
          href="/sales/quotations"
          className="flex items-center font-medium transition-colors hover:text-foreground"
        >
          {isQuotationCreate ? t("Quotations") : t("Quotation")}
        </Link>
        <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
        {isQuotationCreate ? (
          <span className="font-medium text-foreground">{tCommon("new")}</span>
        ) : quotation?.quotationNumber ? (
          <span className="font-medium text-foreground">{quotation.quotationNumber}</span>
        ) : isQuotationLoading ? (
          <span
            aria-label={tCommon("loading")}
            className="h-4 w-40 animate-pulse rounded bg-muted"
          />
        ) : (
          <span className="font-medium text-foreground">{t("Quotation")}</span>
        )}
      </nav>
    );
  }

  if (purchasingDocument) {
    const documentListHref = `/purchasing/${purchasingDocument.segment}`;
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
          href={documentListHref}
          className="flex items-center font-medium transition-colors hover:text-foreground"
        >
          {t(purchasingDocument.listLabelKey)}
        </Link>
        <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
        {isPurchasingDocumentCreate ? (
          <span className="font-medium text-foreground">{tCommon("new")}</span>
        ) : purchasingDocumentNumber ? (
          isPurchasingDocumentEdit ? (
            <>
              <Link
                href={`${documentListHref}/${purchasingDocumentId}`}
                className="flex items-center font-medium transition-colors hover:text-foreground"
              >
                {purchasingDocumentNumber}
              </Link>
              <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="font-medium text-foreground">{tCommon("edit")}</span>
            </>
          ) : (
            <span className="font-medium text-foreground">{purchasingDocumentNumber}</span>
          )
        ) : isPurchasingDocumentLoading ? (
          <span
            aria-label={tCommon("loading")}
            className="h-4 w-40 animate-pulse rounded bg-muted"
          />
        ) : (
          <span className="font-medium text-foreground">
            {t(purchasingDocument.detailLabelKey)}
          </span>
        )}
      </nav>
    );
  }

  if (isSalesOrderCreate) {
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
          href="/sales/orders"
          className="flex items-center font-medium transition-colors hover:text-foreground"
        >
          {t("Sales Orders")}
        </Link>
        <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
        <span className="font-medium text-foreground">{tCommon("new")}</span>
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
          <span
            aria-label={tCommon("loading")}
            className="h-4 w-40 animate-pulse rounded bg-muted"
          />
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
          <span
            aria-label={tCommon("loading")}
            className="h-4 w-40 animate-pulse rounded bg-muted"
          />
        ) : (
          <span className="font-medium text-foreground">{t("Suppliers")}</span>
        )}
      </nav>
    );
  }

  if (isCustomerDetail) {
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
          href="/sales/customers"
          className="flex items-center font-medium transition-colors hover:text-foreground"
        >
          {t("Customers")}
        </Link>
        <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
        {customer ? (
          <span className="font-medium text-foreground">{customer.name || customer.code}</span>
        ) : isCustomerLoading ? (
          <span
            aria-label={tCommon("loading")}
            className="h-4 w-40 animate-pulse rounded bg-muted"
          />
        ) : (
          <span className="font-medium text-foreground">{t("Customers")}</span>
        )}
      </nav>
    );
  }

  if (isWarehouseLocations || isWarehouseFloorMap) {
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
          {t("Warehouses")}
        </Link>
        <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
        <span className="font-medium text-foreground">
          {isWarehouseFloorMap ? tWarehouses("floorMap") : t("Location")}
        </span>
      </nav>
    );
  }

  if (isTransformationOrderDetail) {
    const orderCode = transformationOrderResponse?.data.order_code;

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
          href="/manufacturing/transformations"
          className="flex items-center font-medium transition-colors hover:text-foreground"
        >
          {t("Stock Transformations")}
        </Link>
        <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
        {orderCode ? (
          <span className="font-medium text-foreground">{orderCode}</span>
        ) : isTransformationOrderLoading ? (
          <span
            aria-label={tCommon("loading")}
            className="h-4 w-40 animate-pulse rounded bg-muted"
          />
        ) : (
          <span className="font-medium text-foreground">{t("Transformation Order Details")}</span>
        )}
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
