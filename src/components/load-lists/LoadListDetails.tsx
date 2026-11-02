"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Link as LinkIcon, Pencil } from "lucide-react";
import { toast } from "sonner";
import { LinkStockRequisitionsDialog } from "@/components/load-lists/LinkStockRequisitionsDialog";
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
import { useUpdateLoadListStatus } from "@/hooks/useLoadLists";
import { useResourcePermissions } from "@/hooks/usePermissions";
import { canEditLoadList } from "@/lib/load-lists/editability";
import {
  LOAD_LIST_STATUS_LABEL_KEYS,
  LOAD_LIST_STATUS_TONES,
  formatLoadListAmount,
  formatLoadListDate,
  showsLoadListReceiptQuantities,
} from "@/lib/load-lists/load-list-display";
import type { LoadList, LoadListStatus } from "@/types/load-list";
import { LoadListDetailField } from "./LoadListDetailField";
import { LoadListLinesTable } from "./LoadListLinesTable";
import { LoadListSection } from "./LoadListSection";
import { LoadListSummaryPanel } from "./LoadListSummaryPanel";
import { getLoadListLineColumns } from "./load-list-line-columns";

type LoadListDetailsProps = {
  loadList: LoadList;
};

type LoadListPerson = { firstName?: string; lastName?: string; email?: string } | null | undefined;

const STOCK_REQUISITION_LINK_STATUSES: readonly LoadListStatus[] = [
  "draft",
  "confirmed",
  "in_transit",
  "arrived",
];
const PRE_TRANSIT_STATUSES: readonly LoadListStatus[] = ["draft", "confirmed", "cancelled"];

const formatPerson = (person: LoadListPerson) =>
  person ? [person.firstName, person.lastName].filter(Boolean).join(" ") || person.email : null;

export function LoadListDetails({ loadList }: LoadListDetailsProps) {
  const t = useTranslations("loadListPage");
  const locale = useLocale();
  const { currentCurrency } = useCurrency();
  const updateStatusMutation = useUpdateLoadListStatus();
  const { canEdit: canEditResource } = useResourcePermissions(RESOURCES.LOAD_LISTS);

  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [inTransitDialogOpen, setInTransitDialogOpen] = useState(false);
  const [arrivedDialogOpen, setArrivedDialogOpen] = useState(false);
  const [reverseArrivalDialogOpen, setReverseArrivalDialogOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [inTransitEstimatedArrivalDate, setInTransitEstimatedArrivalDate] = useState("");
  const [inTransitLinerName, setInTransitLinerName] = useState("");

  const capabilities = loadList.capabilities;
  const canViewUnitPrice = capabilities?.canViewUnitPrice === true;
  const canViewTotalAmount = capabilities?.canViewTotalAmount === true;
  const currency = loadList.currency ?? currentCurrency.code;
  const status = loadList.status;
  const noValue = t("notProvided");

  const canEdit = canEditLoadList(loadList, canEditResource);
  const canConfirm = loadList.isSourceBusinessUnit && canEditResource && status === "draft";
  const canMarkInTransit =
    loadList.isSourceBusinessUnit &&
    capabilities?.canMarkInTransit === true &&
    status === "confirmed";
  const canMarkArrived =
    loadList.isTargetBusinessUnit &&
    capabilities?.canMarkArrived === true &&
    status === "in_transit";
  const canReverseArrival = loadList.isTargetBusinessUnit && status === "arrived";
  const canLinkStockRequisitions =
    loadList.isSourceBusinessUnit &&
    capabilities?.canLinkStockRequisitions === true &&
    STOCK_REQUISITION_LINK_STATUSES.includes(status);

  const columns = getLoadListLineColumns({
    showReceipt: showsLoadListReceiptQuantities(status),
    showUnitCost: canViewUnitPrice,
    showLineTotal: canViewTotalAmount,
    showAction: false,
  });
  const showTransit =
    !PRE_TRANSIT_STATUSES.includes(status) ||
    Boolean(loadList.linerName || loadList.estimatedArrivalDate || loadList.actualArrivalDate);
  const formatDate = (value?: string | null) => (value ? formatLoadListDate(value, locale) : null);
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

  const openInTransitDialog = () => {
    setInTransitEstimatedArrivalDate(loadList.estimatedArrivalDate?.split("T")[0] ?? "");
    setInTransitLinerName(loadList.linerName ?? "");
    setInTransitDialogOpen(true);
  };

  const primaryAction = canConfirm ? (
    <Button type="button" className="h-11 w-full" onClick={() => setConfirmDialogOpen(true)}>
      {t("confirm")}
    </Button>
  ) : canMarkInTransit ? (
    <Button type="button" className="h-11 w-full" onClick={openInTransitDialog}>
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
          <LoadListSection id="load-list-shipment" title={t("shipmentTitle")}>
            <dl className="grid gap-5 sm:grid-cols-2">
              <LoadListDetailField
                label={t("supplier")}
                value={loadList.supplier?.name}
                hint={[loadList.supplier?.code, loadList.supplier?.contactPerson]
                  .filter(Boolean)
                  .join(" · ")}
                emptyLabel={noValue}
              />
              <LoadListDetailField
                label={t("destinationBusinessUnit")}
                value={loadList.destinationBusinessUnit?.name}
                hint={loadList.destinationBusinessUnit?.code}
                emptyLabel={noValue}
              />
              <LoadListDetailField
                label={t("sourceBusinessUnit")}
                value={loadList.sourceBusinessUnit?.name}
                hint={loadList.sourceBusinessUnit?.code}
                emptyLabel={noValue}
              />
              <LoadListDetailField
                label={t("supplierLlNumber")}
                value={loadList.supplierLlNumber}
                emptyLabel={noValue}
                numeric
              />
              <LoadListDetailField
                label={t("loadDate")}
                value={formatDate(loadList.loadDate)}
                emptyLabel={noValue}
                numeric
              />
            </dl>
          </LoadListSection>

          <LoadListSection id="load-list-container" title={t("containerTitle")}>
            <dl className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              <LoadListDetailField
                label={t("containerNumber")}
                value={loadList.containerNumber}
                emptyLabel={noValue}
                numeric
              />
              <LoadListDetailField
                label={t("sealNumber")}
                value={loadList.sealNumber}
                emptyLabel={noValue}
                numeric
              />
              <LoadListDetailField
                label={t("batchNumber")}
                value={loadList.batchNumber}
                emptyLabel={noValue}
              />
            </dl>
          </LoadListSection>

          {showTransit ? (
            <LoadListSection
              id="load-list-transit"
              title={t("transitTitle")}
              description={t("transitDescription")}
            >
              <dl className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                <LoadListDetailField
                  label={t("linerName")}
                  value={loadList.linerName}
                  emptyLabel={noValue}
                />
                <LoadListDetailField
                  label={t("estimatedArrival")}
                  value={formatDate(loadList.estimatedArrivalDate)}
                  emptyLabel={noValue}
                  numeric
                />
                <LoadListDetailField
                  label={t("actualArrival")}
                  value={formatDate(loadList.actualArrivalDate)}
                  emptyLabel={t("notArrivedYet")}
                  numeric
                />
              </dl>
            </LoadListSection>
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
            {/* Receipt columns add width, so phones scroll the table instead of squeezing it. */}
            <div className="mt-2 overflow-x-auto">
              <div className="min-w-[44rem]">
                <LoadListLinesTable
                  rows={loadList.items.map((item) => ({
                    key: item.id,
                    itemCode: item.item?.code ?? "",
                    itemName: item.item?.name ?? "",
                    unitLabel: item.unitName,
                    qtyPerUnit: item.qtyPerUnit,
                    loadListQty: item.loadListQty,
                    unitPrice: item.unitPrice,
                    lineTotal: item.totalPrice,
                    receivedQty: item.receivedQty,
                    damagedQty: item.damagedQty,
                    shortageQty: item.shortageQty,
                  }))}
                  columns={columns}
                  currency={currency}
                  totalAmount={canViewTotalAmount ? (loadList.totalAmount ?? null) : null}
                  emptyTitle={t("noItemsTitle")}
                  emptyDescription={t("noItemsViewDescription")}
                />
              </div>
            </div>
          </section>

          <LoadListSection id="load-list-notes" title={t("notesTitle")}>
            <p
              className={
                loadList.notes
                  ? "max-w-prose whitespace-pre-line text-sm leading-relaxed"
                  : "text-sm text-muted-foreground"
              }
            >
              {loadList.notes || noValue}
            </p>
          </LoadListSection>
        </div>

        <LoadListSummaryPanel
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
              ? formatLoadListAmount(loadList.totalAmount, currency, locale)
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
            const name = formatPerson(record.person);
            return name && record.date ? (
              <p key={record.key}>
                {t(record.label, { name, date: formatLoadListDate(record.date, locale) })}
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

      <Dialog open={inTransitDialogOpen} onOpenChange={setInTransitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("inTransitTitle")}</DialogTitle>
            <DialogDescription>{t("inTransitDescription")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="load-list-liner-name">
                {t("linerName")}
              </label>
              <Input
                id="load-list-liner-name"
                value={inTransitLinerName}
                onChange={(event) => setInTransitLinerName(event.target.value)}
                placeholder={t("linerNamePlaceholder")}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="load-list-estimated-arrival-date">
                {t("estimatedArrival")}
              </label>
              <Input
                id="load-list-estimated-arrival-date"
                type="date"
                value={inTransitEstimatedArrivalDate}
                onChange={(event) => setInTransitEstimatedArrivalDate(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInTransitDialogOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              onClick={() =>
                changeStatus(
                  {
                    status: "in_transit",
                    estimatedArrivalDate: inTransitEstimatedArrivalDate || undefined,
                    linerName: inTransitLinerName.trim() || undefined,
                  },
                  () => setInTransitDialogOpen(false)
                )
              }
              disabled={updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending ? t("updating") : t("saveAndMarkInTransit")}
            </Button>
          </DialogFooter>
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
