"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { RESOURCES } from "@/constants/resources";
import { useResourcePermissions } from "@/hooks/usePermissions";
import {
  useApproveStockRequest,
  useCancelStockRequest,
  useDeleteStockRequest,
  useRejectStockRequest,
  useSubmitStockRequest,
} from "@/hooks/useStockRequests";
import { formatDocumentDate } from "@/lib/documents/document-display";
import {
  canEditStockRequest,
  isFulfillingBusinessUnit,
  isRequestingBusinessUnit,
} from "@/lib/stock-requests/stock-request-access";
import {
  STOCK_REQUEST_PRIORITY_LABEL_KEYS,
  STOCK_REQUEST_PRIORITY_TONES,
  STOCK_REQUEST_STATUS_LABEL_KEYS,
  STOCK_REQUEST_STATUS_TONES,
  showsStockRequestDelivery,
} from "@/lib/stock-requests/stock-request-display";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";
import type { StockRequest, StockRequestStatus } from "@/types/stock-request";

type StockRequestDetailsProps = {
  stockRequest: StockRequest;
};

type StockRequestAction = "submit" | "approve" | "reject" | "cancel" | "delete";

const CANCELLABLE_STATUSES: readonly StockRequestStatus[] = ["draft", "submitted", "approved"];
const REASON_ACTIONS: readonly StockRequestAction[] = ["reject", "cancel"];

const formatUser = (
  user?: { email: string; full_name?: string | null; first_name?: string | null } | null
) => user?.full_name || user?.email || null;

export function StockRequestDetails({ stockRequest }: StockRequestDetailsProps) {
  const t = useTranslations("stockRequestPage");
  const locale = useLocale();
  const router = useRouter();
  const currentBusinessUnitId = useBusinessUnitStore((state) => state.currentBusinessUnit?.id);
  const { canEdit: canEditResource } = useResourcePermissions(RESOURCES.STOCK_REQUESTS);
  const submitMutation = useSubmitStockRequest();
  const approveMutation = useApproveStockRequest();
  const rejectMutation = useRejectStockRequest();
  const cancelMutation = useCancelStockRequest();
  const deleteMutation = useDeleteStockRequest();
  const [pendingAction, setPendingAction] = useState<StockRequestAction | null>(null);
  const [actionReason, setActionReason] = useState("");

  const status = stockRequest.status;
  const noValue = t("notProvided");
  const isRequesting = isRequestingBusinessUnit(stockRequest, currentBusinessUnitId);
  const isFulfilling = isFulfillingBusinessUnit(stockRequest, currentBusinessUnitId);
  const canEdit = canEditStockRequest(stockRequest, currentBusinessUnitId, canEditResource);
  const canSubmit = isRequesting && status === "draft";
  const canApprove = isFulfilling && status === "submitted";
  const canReject = isFulfilling && status === "submitted";
  const canCancel = isRequesting && CANCELLABLE_STATUSES.includes(status);
  const canDelete = isRequesting && status === "draft";
  const isActionPending =
    submitMutation.isPending ||
    approveMutation.isPending ||
    rejectMutation.isPending ||
    cancelMutation.isPending ||
    deleteMutation.isPending;

  const items = stockRequest.stock_request_items ?? [];
  const columns = getDocumentLineColumns({
    trackingColumns: showsStockRequestDelivery(status) ? ["deliveredQty"] : [],
    showBatch: true,
    showUnitCost: false,
    showLineTotal: false,
    showAction: false,
  });
  const formatDate = (value?: string | null) => (value ? formatDocumentDate(value, locale) : null);
  const statusText = (
    <StatusText tone={STOCK_REQUEST_STATUS_TONES[status]} className="font-semibold">
      {t(STOCK_REQUEST_STATUS_LABEL_KEYS[status])}
    </StatusText>
  );
  const priorityText = (
    <StatusText tone={STOCK_REQUEST_PRIORITY_TONES[stockRequest.priority]}>
      {t(STOCK_REQUEST_PRIORITY_LABEL_KEYS[stockRequest.priority])}
    </StatusText>
  );
  const fromUnit = stockRequest.fulfilling_business_unit;
  const toUnit = stockRequest.requesting_business_unit;
  const deliveryNotes =
    stockRequest.fulfilling_delivery_notes && stockRequest.fulfilling_delivery_notes.length > 0
      ? stockRequest.fulfilling_delivery_notes
      : stockRequest.fulfilling_delivery_note
        ? [stockRequest.fulfilling_delivery_note]
        : [];
  const requestedByName = formatUser(stockRequest.requested_by_user);
  const receivedByName = formatUser(stockRequest.received_by_user);

  const openAction = (action: StockRequestAction) => {
    setActionReason("");
    setPendingAction(action);
  };

  const confirmAction = async () => {
    const id = stockRequest.id;
    const reason = actionReason.trim();
    // The mutation hooks toast the outcome; a failure keeps the dialog open to retry.
    try {
      switch (pendingAction) {
        case "submit":
          await submitMutation.mutateAsync(id);
          break;
        case "approve":
          await approveMutation.mutateAsync(id);
          break;
        case "reject":
          await rejectMutation.mutateAsync({ id, reason });
          break;
        case "cancel":
          await cancelMutation.mutateAsync({ id, reason });
          break;
        case "delete":
          await deleteMutation.mutateAsync(id);
          router.push("/inventory/stock-requests");
          break;
      }
      setPendingAction(null);
    } catch {
      return;
    }
  };

  const actionCopy: Record<
    StockRequestAction,
    { title: string; description: string; confirm: string; destructive: boolean }
  > = {
    submit: {
      title: t("submitTitle"),
      description: t("submitDescription"),
      confirm: t("submit"),
      destructive: false,
    },
    approve: {
      title: t("approveTitle"),
      description: t("approveDescription"),
      confirm: t("approve"),
      destructive: false,
    },
    reject: {
      title: t("rejectTitle"),
      description: t("rejectDescription"),
      confirm: t("reject"),
      destructive: true,
    },
    cancel: {
      title: t("cancelTitle"),
      description: t("cancelDescription"),
      confirm: t("cancelTransfer"),
      destructive: true,
    },
    delete: {
      title: t("deleteTitle"),
      description: t("deleteDescription", { code: stockRequest.request_code }),
      confirm: t("delete"),
      destructive: true,
    },
  };
  const dialogCopy = pendingAction ? actionCopy[pendingAction] : null;
  const needsReason = pendingAction != null && REASON_ACTIONS.includes(pendingAction);

  const primaryAction = canSubmit ? (
    <Button type="button" className="h-11 w-full" onClick={() => openAction("submit")}>
      {t("submit")}
    </Button>
  ) : canApprove ? (
    <Button type="button" className="h-11 w-full" onClick={() => openAction("approve")}>
      {t("approve")}
    </Button>
  ) : null;
  const secondaryActions = (
    [canReject ? "reject" : null, canCancel ? "cancel" : null, canDelete ? "delete" : null] as const
  ).filter((action): action is "reject" | "cancel" | "delete" => action != null);
  const secondaryActionLabels = {
    reject: t("reject"),
    cancel: t("cancelTransfer"),
    delete: t("delete"),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="tabular-nums">{stockRequest.request_code}</span>
            {statusText}
          </span>
        }
        subtitle={
          fromUnit && toUnit
            ? t("viewDescription", { from: fromUnit.name, to: toUnit.name })
            : undefined
        }
      />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 overflow-hidden rounded-xl border bg-card">
          <DocumentSection id="stock-request-transfer" title={t("transferTitle")}>
            <dl className="grid gap-5 sm:grid-cols-2">
              <DocumentDetailField
                label={t("requestedBy")}
                value={toUnit?.name}
                hint={toUnit?.code}
                emptyLabel={noValue}
              />
              <DocumentDetailField
                label={t("requestedTo")}
                value={fromUnit?.name}
                hint={fromUnit?.code}
                emptyLabel={noValue}
              />
              <DocumentDetailField
                label={t("requestDate")}
                value={formatDate(stockRequest.request_date)}
                emptyLabel={noValue}
                numeric
              />
              <DocumentDetailField
                label={t("requiredDate")}
                value={formatDate(stockRequest.required_date)}
                emptyLabel={noValue}
                numeric
              />
              <DocumentDetailField
                label={t("priority")}
                value={priorityText}
                emptyLabel={noValue}
              />
              <DocumentDetailField
                label={t("requestedByUser")}
                value={requestedByName}
                emptyLabel={noValue}
              />
              {stockRequest.received_at || receivedByName ? (
                <>
                  <DocumentDetailField
                    label={t("receivedDate")}
                    value={formatDate(stockRequest.received_at)}
                    emptyLabel={noValue}
                    numeric
                  />
                  <DocumentDetailField
                    label={t("receivedBy")}
                    value={receivedByName}
                    emptyLabel={noValue}
                  />
                </>
              ) : null}
            </dl>
          </DocumentSection>

          <section
            aria-labelledby="stock-request-items"
            className="border-t px-5 pb-2 pt-6 sm:px-7"
          >
            <div className="flex items-center gap-2">
              <h2 id="stock-request-items" className="text-sm font-semibold">
                {t("itemsTitle")}
              </h2>
              <span className="rounded-full bg-primary/10 px-2 text-xs font-semibold tabular-nums">
                {items.length}
              </span>
            </div>
            <div className="mt-2">
              <DocumentLinesTable
                rows={items.map((item) => ({
                  key: item.id,
                  itemCode: item.items?.item_code ?? "",
                  itemName: item.items?.item_name ?? "",
                  unitLabel:
                    item.item_unit_option?.optionLabel?.trim() ||
                    item.item_unit_option?.uomName ||
                    item.units_of_measure?.code ||
                    "",
                  uomCode: item.item_unit_option?.uomCode || item.units_of_measure?.code || "",
                  qtyPerUnit: item.item_unit_option?.qtyPerUnit ?? 1,
                  quantity: item.requested_qty,
                  unitPrice: null,
                  lineTotal: null,
                  tracking: { deliveredQty: item.dispatch_qty ?? item.received_qty ?? 0 },
                  batch: item.selected_item_batch
                    ? {
                        code: item.selected_item_batch.batch_code,
                        warehouseCode: item.selected_item_batch.warehouse?.warehouse_code,
                      }
                    : null,
                  note: item.notes ?? undefined,
                }))}
                columns={columns}
                currency=""
                totalAmount={null}
                emptyTitle={t("noItemsTitle")}
                emptyDescription={t("noItemsViewDescription")}
              />
            </div>
          </section>

          {showsStockRequestDelivery(status) || deliveryNotes.length > 0 ? (
            <DocumentSection id="stock-request-delivery" title={t("deliveryNotesTitle")}>
              {deliveryNotes.length > 0 ? (
                <ul className="space-y-2 text-sm">
                  {deliveryNotes.map((note) => (
                    <li key={note.id} className="flex items-baseline justify-between gap-4">
                      <Link
                        href={`/inventory/delivery-notes/${note.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {note.dn_no}
                      </Link>
                      <span className="capitalize text-muted-foreground">
                        {String(note.status).replace(/_/g, " ")}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">{t("noDeliveryNotes")}</p>
              )}
            </DocumentSection>
          ) : null}

          <DocumentSection id="stock-request-notes" title={t("notesTitle")}>
            <dl className="grid gap-5">
              <DocumentDetailField
                label={t("purpose")}
                value={stockRequest.purpose}
                emptyLabel={noValue}
              />
              <div>
                <dt className="text-sm text-muted-foreground">{t("notes")}</dt>
                <dd
                  className={
                    stockRequest.notes
                      ? "mt-1 max-w-prose whitespace-pre-line text-sm leading-relaxed"
                      : "mt-1 text-sm text-muted-foreground"
                  }
                >
                  {stockRequest.notes || noValue}
                </dd>
              </div>
            </dl>
          </DocumentSection>
        </div>

        <DocumentSummaryPanel
          title={t("summaryTitle")}
          rows={[
            { key: "status", label: t("summaryStatus"), value: statusText },
            { key: "from", label: t("summaryFrom"), value: fromUnit?.name ?? t("noValue") },
            { key: "to", label: t("summaryTo"), value: toUnit?.name ?? t("noValue") },
            {
              key: "requiredDate",
              label: t("summaryRequiredBy"),
              value: formatDate(stockRequest.required_date) ?? t("noValue"),
            },
            { key: "priority", label: t("summaryPriority"), value: priorityText },
            { key: "items", label: t("summaryItems"), value: items.length },
          ]}
          totalLabel=""
          total={null}
          actions={
            primaryAction || canEdit || secondaryActions.length > 0 ? (
              <>
                {primaryAction}
                {canSubmit ? (
                  <p className="text-xs text-muted-foreground">{t("submitHint")}</p>
                ) : null}
                {canEdit ? (
                  <Button asChild variant="outline" className="h-11 w-full">
                    <Link href={`/inventory/stock-requests/${stockRequest.id}/edit`}>
                      <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                      {t("edit")}
                    </Link>
                  </Button>
                ) : null}
                {secondaryActions.map((action) => (
                  <Button
                    key={action}
                    type="button"
                    variant="outline"
                    className="h-11 w-full text-destructive hover:text-destructive"
                    onClick={() => openAction(action)}
                  >
                    {secondaryActionLabels[action]}
                  </Button>
                ))}
              </>
            ) : null
          }
          footer={
            requestedByName ? (
              <p>
                {t("createdBy", {
                  name: requestedByName,
                  date: formatDocumentDate(stockRequest.created_at, locale),
                })}
              </p>
            ) : null
          }
        />
      </div>

      <AlertDialog
        open={dialogCopy != null}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogCopy?.title}</AlertDialogTitle>
            <AlertDialogDescription>{dialogCopy?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          {needsReason ? (
            <div className="space-y-2">
              <label htmlFor="stock-request-action-reason" className="text-sm font-medium">
                {t("reason")}
              </label>
              <Textarea
                id="stock-request-action-reason"
                value={actionReason}
                onChange={(event) => setActionReason(event.target.value)}
                placeholder={t("reasonPlaceholder")}
              />
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>{t("goBack")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void confirmAction();
              }}
              disabled={isActionPending || (needsReason && !actionReason.trim())}
              className={
                dialogCopy?.destructive
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : undefined
              }
            >
              {isActionPending ? t("processing") : dialogCopy?.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
