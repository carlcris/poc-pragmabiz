"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Link as LinkIcon, Pencil } from "lucide-react";
import { toast } from "sonner";
import { LinkStockRequisitionsDialog } from "@/components/load-lists/LinkStockRequisitionsDialog";
import { DocumentDetailField } from "@/components/document-page/DocumentDetailField";
import { DocumentLinesTable } from "@/components/document-page/DocumentLinesTable";
import { DocumentSection } from "@/components/document-page/DocumentSection";
import { DocumentSummaryPanel } from "@/components/document-page/DocumentSummaryPanel";
import { getDocumentLineColumns } from "@/components/document-page/document-line-columns";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusText } from "@/components/shared/StatusText";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RESOURCES } from "@/constants/resources";
import { useCurrency } from "@/hooks/useCurrency";
import { useUpdateLoadListStatus, useUpdateLoadListTransitDetails } from "@/hooks/useLoadLists";
import { useResourcePermissions } from "@/hooks/usePermissions";
import { getApiErrorCode } from "@/lib/api";
import { canEditLoadList } from "@/lib/load-lists/editability";
import {
  formatDocumentAmount,
  formatDocumentDate,
  formatDocumentPerson,
} from "@/lib/documents/document-display";
import {
  LOAD_LIST_STATUS_LABEL_KEYS,
  LOAD_LIST_STATUS_TONES,
} from "@/lib/load-lists/load-list-display";
import {
  LOAD_LIST_TRANSIT_DETAILS_ERROR_CODES,
  type LoadListDetail,
  type LoadListStatus,
  type UpdateLoadListTransitDetailsRequest,
} from "@/types/load-list";

type LoadListDetailsProps = {
  loadList: LoadListDetail;
};

type TransitDialogMode = "mark" | "edit";

const STOCK_REQUISITION_LINK_STATUSES: readonly LoadListStatus[] = [
  "draft",
  "confirmed",
  "in_transit",
  "arrived",
];
const PRE_TRANSIT_STATUSES: readonly LoadListStatus[] = ["draft", "confirmed", "cancelled"];
const EMPTY_TRANSIT_DETAILS = { linerName: "", estimatedArrivalDate: "" };

export function LoadListDetails({ loadList }: LoadListDetailsProps) {
  const t = useTranslations("loadListPage");
  const locale = useLocale();
  const { currentCurrency } = useCurrency();
  const updateStatusMutation = useUpdateLoadListStatus();
  const updateTransitDetailsMutation = useUpdateLoadListTransitDetails();
  const { canEdit: canEditResource } = useResourcePermissions(RESOURCES.LOAD_LISTS);

  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [transitDialogOpen, setTransitDialogOpen] = useState(false);
  const [transitDialogMode, setTransitDialogMode] = useState<TransitDialogMode>("mark");
  const [initialTransitDetails, setInitialTransitDetails] = useState({
    ...EMPTY_TRANSIT_DETAILS,
    loadListId: "",
  });
  const [transitDetails, setTransitDetails] = useState(EMPTY_TRANSIT_DETAILS);
  const [transitDetailsError, setTransitDetailsError] = useState<string | null>(null);
  const transitDialogTrigger = useRef<HTMLButtonElement | null>(null);
  const [arrivedDialogOpen, setArrivedDialogOpen] = useState(false);
  const [reverseArrivalDialogOpen, setReverseArrivalDialogOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);

  const capabilities = loadList.capabilities;
  const canViewUnitPrice = capabilities?.canViewUnitPrice === true;
  const canViewTotalAmount = capabilities?.canViewTotalAmount === true;
  const currency = loadList.currency ?? currentCurrency.code;
  const status = loadList.status;
  const noValue = t("notProvided");

  const canEdit = canEditLoadList(loadList, canEditResource);
  const canConfirm = loadList.isSourceBusinessUnit && canEditResource && status === "draft";
  const canManageTransit = loadList.isSourceBusinessUnit && capabilities?.canMarkInTransit === true;
  const canMarkInTransit = canManageTransit && status === "confirmed";
  const canEditTransitDetails = canManageTransit && status === "in_transit";
  const canMarkArrived =
    loadList.isTargetBusinessUnit &&
    capabilities?.canMarkArrived === true &&
    status === "in_transit";
  const canReverseArrival = loadList.isTargetBusinessUnit && status === "arrived";
  const canLinkStockRequisitions =
    loadList.isSourceBusinessUnit &&
    capabilities?.canLinkStockRequisitions === true &&
    STOCK_REQUISITION_LINK_STATUSES.includes(status);

  const columns = getDocumentLineColumns({
    trackingColumns: [],
    showUnitCost: canViewUnitPrice,
    showLineTotal: canViewTotalAmount,
    showAction: false,
  });
  const showTransit =
    !PRE_TRANSIT_STATUSES.includes(status) ||
    Boolean(loadList.linerName || loadList.estimatedArrivalDate || loadList.actualArrivalDate);
  const formatDate = (value?: string | null) => (value ? formatDocumentDate(value, locale) : null);
  const statusLabel = t(LOAD_LIST_STATUS_LABEL_KEYS[status]);
  const statusText = (
    <StatusText tone={LOAD_LIST_STATUS_TONES[status]} className="font-semibold">
      {statusLabel}
    </StatusText>
  );

  const changeStatus = async (
    data: { status: LoadListStatus; estimatedArrivalDate?: string; linerName?: string },
    closeDialog: () => void
  ) => {
    try {
      await updateStatusMutation.mutateAsync({ id: loadList.id, data });
      toast.success(
        t("statusUpdateSuccess", { status: t(LOAD_LIST_STATUS_LABEL_KEYS[data.status]) })
      );
      closeDialog();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("statusUpdateError"));
    }
  };

  const isEditingTransitDetails = transitDialogMode === "edit";
  const isTransitDialogPending = isEditingTransitDetails
    ? updateTransitDetailsMutation.isPending
    : updateStatusMutation.isPending;
  const linerName = transitDetails.linerName.trim();
  const estimatedArrivalDate = transitDetails.estimatedArrivalDate;
  const linerNameChanged = linerName !== initialTransitDetails.linerName.trim();
  const estimatedArrivalDateChanged =
    estimatedArrivalDate !== initialTransitDetails.estimatedArrivalDate;
  const hasTransitDetailsChanges = linerNameChanged || estimatedArrivalDateChanged;

  const openTransitDialog = (mode: TransitDialogMode, trigger: HTMLButtonElement) => {
    const savedDetails = {
      linerName: loadList.linerName ?? "",
      estimatedArrivalDate: loadList.estimatedArrivalDate?.split("T")[0] ?? "",
    };
    transitDialogTrigger.current = trigger;
    setInitialTransitDetails({ ...savedDetails, loadListId: loadList.id });
    setTransitDetails(savedDetails);
    setTransitDetailsError(null);
    setTransitDialogMode(mode);
    setTransitDialogOpen(true);
  };

  const closeTransitDialog = () => {
    setTransitDialogOpen(false);
    setTransitDetailsError(null);
  };

  const submitTransitDetails = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isTransitDialogPending || initialTransitDetails.loadListId !== loadList.id) return;

    if (!isEditingTransitDetails) {
      await changeStatus(
        {
          status: "in_transit",
          linerName: linerName || undefined,
          estimatedArrivalDate: estimatedArrivalDate || undefined,
        },
        closeTransitDialog
      );
      return;
    }

    if (!hasTransitDetailsChanges) return;
    const data: UpdateLoadListTransitDetailsRequest = {};
    if (linerNameChanged) data.linerName = linerName || null;
    if (estimatedArrivalDateChanged) data.estimatedArrivalDate = estimatedArrivalDate || null;

    setTransitDetailsError(null);
    try {
      await updateTransitDetailsMutation.mutateAsync({ id: loadList.id, data });
      closeTransitDialog();
      toast.success(t("transitDetailsSaved"));
    } catch (error) {
      switch (getApiErrorCode(error, LOAD_LIST_TRANSIT_DETAILS_ERROR_CODES)) {
        case "INVALID_LOAD_LIST_TRANSIT_DETAILS":
          setTransitDetailsError(t("transitDetailsInvalid"));
          break;
        case "LOAD_LIST_TRANSIT_DETAILS_SCOPE_REQUIRED":
          setTransitDetailsError(t("transitDetailsScopeRequired"));
          break;
        case "LOAD_LIST_TRANSIT_DETAILS_FORBIDDEN":
          setTransitDetailsError(t("transitDetailsForbidden"));
          break;
        case "LOAD_LIST_TRANSIT_DETAILS_UNAVAILABLE":
          setTransitDetailsError(t("transitDetailsUnavailable"));
          break;
        default:
          setTransitDetailsError(t("transitDetailsSaveError"));
      }
    }
  };

  const primaryAction = canConfirm ? (
    <Button type="button" className="h-11 w-full" onClick={() => setConfirmDialogOpen(true)}>
      {t("confirm")}
    </Button>
  ) : canMarkInTransit ? (
    <Button
      type="button"
      className="h-11 w-full"
      onClick={(event) => openTransitDialog("mark", event.currentTarget)}
    >
      {t("markInTransit")}
    </Button>
  ) : canMarkArrived ? (
    <Button type="button" className="h-11 w-full" onClick={() => setArrivedDialogOpen(true)}>
      {t("markArrived")}
    </Button>
  ) : null;
  const actionHint = canMarkInTransit
    ? t("markInTransitHint")
    : canMarkArrived
      ? t("markArrivedHint", { destination: loadList.destinationBusinessUnit?.name ?? "" })
      : null;
  const hasActions = Boolean(
    primaryAction || canEdit || canReverseArrival || canLinkStockRequisitions
  );

  const recordLines = [
    {
      key: "created",
      person: loadList.createdByUser,
      date: loadList.createdAt,
      label: "createdBy",
    },
    {
      key: "received",
      person: loadList.receivedByUser,
      date: loadList.receivedDate,
      label: "receivedBy",
    },
    {
      key: "approved",
      person: loadList.approvedByUser,
      date: loadList.approvedDate,
      label: "approvedBy",
    },
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="tabular-nums">{loadList.llNumber}</span>
            {statusText}
          </span>
        }
        subtitle={
          loadList.supplier && loadList.destinationBusinessUnit
            ? t("viewDescription", {
                supplier: loadList.supplier.name,
                destination: loadList.destinationBusinessUnit.name,
              })
            : undefined
        }
      />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 overflow-hidden rounded-xl border bg-card">
          <DocumentSection id="load-list-shipment" title={t("shipmentTitle")}>
            <dl className="grid gap-5 sm:grid-cols-2">
              <DocumentDetailField
                label={t("supplier")}
                value={loadList.supplier?.name}
                hint={loadList.supplier?.contactPerson}
                emptyLabel={noValue}
              />
              <DocumentDetailField
                label={t("destinationBusinessUnit")}
                value={loadList.destinationBusinessUnit?.name}
                hint={loadList.destinationBusinessUnit?.code}
                emptyLabel={noValue}
              />
              <DocumentDetailField
                label={t("sourceBusinessUnit")}
                value={loadList.sourceBusinessUnit?.name}
                hint={loadList.sourceBusinessUnit?.code}
                emptyLabel={noValue}
              />
              <DocumentDetailField
                label={t("supplierLlNumber")}
                value={loadList.supplierLlNumber}
                emptyLabel={noValue}
                numeric
              />
              <DocumentDetailField
                label={t("loadDate")}
                value={formatDate(loadList.loadDate)}
                emptyLabel={noValue}
                numeric
              />
            </dl>
          </DocumentSection>

          <DocumentSection id="load-list-container" title={t("containerTitle")}>
            <dl className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              <DocumentDetailField
                label={t("containerNumber")}
                value={loadList.containerNumber}
                emptyLabel={noValue}
                numeric
              />
              <DocumentDetailField
                label={t("sealNumber")}
                value={loadList.sealNumber}
                emptyLabel={noValue}
                numeric
              />
              <DocumentDetailField
                label={t("batchNumber")}
                value={loadList.batchNumber}
                emptyLabel={noValue}
              />
            </dl>
          </DocumentSection>

          {showTransit ? (
            <DocumentSection id="load-list-transit" title={t("transitTitle")}>
              <dl className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                <DocumentDetailField
                  label={t("linerName")}
                  value={loadList.linerName}
                  emptyLabel={noValue}
                />
                <DocumentDetailField
                  label={t("estimatedArrival")}
                  value={formatDate(loadList.estimatedArrivalDate)}
                  emptyLabel={noValue}
                  numeric
                />
                <DocumentDetailField
                  label={t("actualArrival")}
                  value={formatDate(loadList.actualArrivalDate)}
                  emptyLabel={t("notArrivedYet")}
                  numeric
                />
              </dl>
              {canEditTransitDetails ? (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4"
                  onClick={(event) => openTransitDialog("edit", event.currentTarget)}
                >
                  <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                  {t("editTransitDetails")}
                </Button>
              ) : null}
            </DocumentSection>
          ) : null}

          <section aria-labelledby="load-list-items" className="border-t px-5 pb-2 pt-6 sm:px-7">
            <div className="flex items-center gap-2">
              <h2 id="load-list-items" className="text-sm font-semibold">
                {t("itemsTitle")}
              </h2>
              <span className="rounded-full bg-primary/10 px-2 text-xs font-semibold tabular-nums">
                {loadList.items.length}
              </span>
            </div>
            <div className="mt-2">
              <DocumentLinesTable
                rows={loadList.items.map((item) => ({
                  key: item.id,
                  itemCode: item.item?.code ?? "",
                  itemName: item.item?.name ?? "",
                  itemStatus: item.isLinkedToStockRequisition ? (
                    <StatusText tone="green" className="text-xs font-semibold">
                      {t("itemLinked")}
                    </StatusText>
                  ) : undefined,
                  unitLabel: item.unitName,
                  uomCode: item.itemUnitOption?.uomCode || item.uomCode || "",
                  qtyPerUnit: item.qtyPerUnit,
                  quantity: item.loadListQty,
                  unitPrice: item.unitPrice,
                  lineTotal: item.totalPrice,
                }))}
                columns={columns}
                currency={currency}
                totalAmount={canViewTotalAmount ? (loadList.totalAmount ?? null) : null}
                emptyTitle={t("noItemsTitle")}
                emptyDescription={t("noItemsViewDescription")}
                itemNameFirst
              />
            </div>
          </section>

          <DocumentSection id="load-list-notes" title={t("notesTitle")}>
            <p
              className={
                loadList.notes
                  ? "max-w-prose whitespace-pre-line text-sm leading-relaxed"
                  : "text-sm text-muted-foreground"
              }
            >
              {loadList.notes || noValue}
            </p>
          </DocumentSection>
        </div>

        <DocumentSummaryPanel
          title={t("summaryTitle")}
          rows={[
            { key: "status", label: t("summaryStatus"), value: statusText },
            {
              key: "supplier",
              label: t("summarySupplier"),
              value: loadList.supplier?.name ?? t("noValue"),
            },
            {
              key: "destination",
              label: t("summaryDeliverTo"),
              value: loadList.destinationBusinessUnit?.name ?? t("noValue"),
            },
            {
              key: "loaded",
              label: t("summaryLoaded"),
              value: formatDate(loadList.loadDate) ?? t("noValue"),
            },
            ...(loadList.estimatedArrivalDate
              ? [
                  {
                    key: "arrives",
                    label: t("summaryArrives"),
                    value: formatDate(loadList.estimatedArrivalDate),
                  },
                ]
              : []),
            { key: "items", label: t("summaryItems"), value: loadList.items.length },
          ]}
          totalLabel={t("total")}
          total={
            canViewTotalAmount && loadList.totalAmount != null
              ? formatDocumentAmount(loadList.totalAmount, currency, locale)
              : null
          }
          actions={
            hasActions ? (
              <>
                {primaryAction}
                {actionHint ? <p className="text-xs text-muted-foreground">{actionHint}</p> : null}
                {canEdit ? (
                  <Button asChild variant="outline" className="h-11 w-full">
                    <Link href={`/purchasing/load-lists/${loadList.id}/edit`}>
                      <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                      {t("edit")}
                    </Link>
                  </Button>
                ) : null}
                {canLinkStockRequisitions ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full"
                    onClick={() => setLinkDialogOpen(true)}
                  >
                    <LinkIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                    {t("linkStockRequisitions")}
                  </Button>
                ) : null}
                {canReverseArrival ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full"
                    onClick={() => setReverseArrivalDialogOpen(true)}
                    disabled={updateStatusMutation.isPending}
                  >
                    {t("reverseToInTransit")}
                  </Button>
                ) : null}
              </>
            ) : null
          }
          footer={recordLines.map((record) => {
            const name = formatDocumentPerson(record.person);
            return name && record.date ? (
              <p key={record.key}>
                {t(record.label, { name, date: formatDocumentDate(record.date, locale) })}
              </p>
            ) : null;
          })}
        />
      </div>

      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("confirmDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                changeStatus({ status: "confirmed" }, () => setConfirmDialogOpen(false))
              }
              disabled={updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending ? t("confirming") : t("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={transitDialogOpen && initialTransitDetails.loadListId === loadList.id}
        onOpenChange={(open) => {
          if (!open && !isTransitDialogPending) closeTransitDialog();
        }}
      >
        <DialogContent
          hideCloseButton={isTransitDialogPending}
          onCloseAutoFocus={(event) => {
            if (transitDialogTrigger.current?.isConnected) {
              event.preventDefault();
              transitDialogTrigger.current.focus();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {isEditingTransitDetails ? t("editTransitDetails") : t("inTransitTitle")}
            </DialogTitle>
            <DialogDescription>
              {isEditingTransitDetails
                ? t("editTransitDetailsDescription")
                : t("inTransitDescription")}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submitTransitDetails}>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium" htmlFor="load-list-liner-name">
                  {t("linerName")}
                </label>
                <Input
                  id="load-list-liner-name"
                  value={transitDetails.linerName}
                  onChange={(event) => {
                    setTransitDetails({ ...transitDetails, linerName: event.target.value });
                    setTransitDetailsError(null);
                  }}
                  placeholder={t("linerNamePlaceholder")}
                  maxLength={150}
                  disabled={isTransitDialogPending}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium" htmlFor="load-list-estimated-arrival-date">
                  {t("estimatedArrival")}
                </label>
                <Input
                  id="load-list-estimated-arrival-date"
                  type="date"
                  min="0001-01-01"
                  max="9999-12-31"
                  value={estimatedArrivalDate}
                  onChange={(event) => {
                    setTransitDetails({
                      ...transitDetails,
                      estimatedArrivalDate: event.target.value,
                    });
                    setTransitDetailsError(null);
                  }}
                  disabled={isTransitDialogPending}
                />
              </div>
            </div>
            {transitDetailsError ? (
              <p role="alert" className="text-sm font-medium text-destructive">
                {transitDetailsError}
              </p>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeTransitDialog}
                disabled={isTransitDialogPending}
              >
                {t("cancel")}
              </Button>
              <Button
                type="submit"
                disabled={
                  isTransitDialogPending || (isEditingTransitDetails && !hasTransitDetailsChanges)
                }
              >
                {isTransitDialogPending
                  ? t("updating")
                  : isEditingTransitDetails
                    ? t("saveChanges")
                    : t("saveAndMarkInTransit")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={canMarkArrived && arrivedDialogOpen} onOpenChange={setArrivedDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("arrivedTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("arrivedDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => changeStatus({ status: "arrived" }, () => setArrivedDialogOpen(false))}
              disabled={updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending ? t("updating") : t("markArrived")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={canReverseArrival && reverseArrivalDialogOpen}
        onOpenChange={setReverseArrivalDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("reverseArrivalTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("reverseArrivalDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancelBack")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                changeStatus({ status: "in_transit" }, () => setReverseArrivalDialogOpen(false))
              }
              disabled={updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending ? t("updating") : t("confirmReverseArrival")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {canLinkStockRequisitions ? (
        <LinkStockRequisitionsDialog
          open={linkDialogOpen}
          onOpenChange={setLinkDialogOpen}
          loadList={loadList}
        />
      ) : null}
    </div>
  );
}
