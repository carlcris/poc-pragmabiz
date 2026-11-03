"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import { BusinessUnitSelect } from "@/components/business-units/BusinessUnitSelect";
import {
  DocumentLineEntry,
  type DocumentLineBatchField,
} from "@/components/document-page/DocumentLineEntry";
import { DocumentLinesTable } from "@/components/document-page/DocumentLinesTable";
import { DocumentSection } from "@/components/document-page/DocumentSection";
import { DocumentSummaryPanel } from "@/components/document-page/DocumentSummaryPanel";
import { getDocumentLineColumns } from "@/components/document-page/document-line-columns";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusText } from "@/components/shared/StatusText";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { LookupBusinessUnitOption } from "@/hooks/useLookups";
import { useCreateStockRequest, useUpdateStockRequest } from "@/hooks/useStockRequests";
import {
  formatDocumentDate,
  formatDocumentPerson,
  formatDocumentQuantity,
} from "@/lib/documents/document-display";
import {
  STOCK_REQUEST_PRIORITY_LABEL_KEYS,
  STOCK_REQUEST_STATUS_LABEL_KEYS,
  STOCK_REQUEST_STATUS_TONES,
} from "@/lib/stock-requests/stock-request-display";
import {
  createStockRequestFormSchema,
  type StockRequestFormValues,
} from "@/lib/validations/stock-request";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";
import type { DocumentFormLine } from "@/types/document-line";
import type {
  CreateStockRequestPayload,
  StockRequest,
  StockRequestFormLine,
  StockRequestLineBatch,
  StockRequestPriority,
} from "@/types/stock-request";
import { StockRequestBatchSelect } from "./StockRequestBatchSelect";

type StockRequestEditorProps = {
  stockRequest: StockRequest | null;
};

const PRIORITIES: readonly StockRequestPriority[] = ["low", "normal", "high", "urgent"];

const toFormLines = (stockRequest: StockRequest | null): StockRequestFormLine[] =>
  stockRequest?.stock_request_items?.map((item) => ({
    key: item.id,
    savedLineId: item.id,
    itemId: item.item_id,
    itemCode: item.items?.item_code ?? "",
    itemName: item.items?.item_name ?? "",
    itemUnitOptionId: item.item_unit_option_id || item.item_unit_option?.id || "",
    uomId: item.uom_id,
    unitLabel:
      item.item_unit_option?.optionLabel?.trim() ||
      item.item_unit_option?.uomName ||
      item.units_of_measure?.code ||
      "",
    uomCode: item.item_unit_option?.uomCode || item.units_of_measure?.code || "",
    qtyPerUnit: item.item_unit_option?.qtyPerUnit ?? 1,
    quantity: item.requested_qty,
    unitPrice: 0,
    unitPriceCurrency: null,
    notes: item.notes ?? undefined,
    batch: item.selected_item_batch
      ? {
          id: item.selected_item_batch.id,
          code: item.selected_item_batch.batch_code,
          warehouseCode: item.selected_item_batch.warehouse?.warehouse_code ?? "",
        }
      : null,
  })) ?? [];

const getLinesSignature = (lines: StockRequestFormLine[]) =>
  JSON.stringify(
    lines.map((line) => [line.savedLineId, line.itemUnitOptionId, line.quantity, line.batch?.id])
  );

const today = () => new Date().toISOString().split("T")[0];

export function StockRequestEditor({ stockRequest }: StockRequestEditorProps) {
  const t = useTranslations("stockRequestPage");
  const tValidation = useTranslations("stockRequestValidation");
  const locale = useLocale();
  const router = useRouter();
  const isEditMode = stockRequest != null;
  const currentBusinessUnit = useBusinessUnitStore((state) => state.currentBusinessUnit);

  const draftMutationMessages = (success: string) => ({
    success,
    fallbackError: t("saveFailed"),
    errors: {
      STOCK_REQUEST_SAVE_FAILED: t("saveFailed"),
      STOCK_REQUEST_UNAUTHORIZED: t("authenticationRequired"),
      STOCK_REQUEST_FORBIDDEN: t("saveForbidden"),
      STOCK_REQUEST_CONTEXT_INVALID: t("contextRequired"),
      STOCK_REQUEST_NOT_DRAFT: t("notDraft"),
      STOCK_REQUEST_HEADER_INVALID: t("invalidDetails"),
      STOCK_REQUEST_BUSINESS_UNITS_MUST_DIFFER: t("businessUnitsMustDiffer"),
      STOCK_REQUEST_FULFILLING_BUSINESS_UNIT_INVALID: t("businessUnitUnavailable"),
      STOCK_REQUEST_FULFILLING_BUSINESS_UNIT_IMMUTABLE: t("businessUnitImmutable"),
      STOCK_REQUEST_ITEMS_INVALID: t("invalidItems"),
      STOCK_REQUEST_LINE_INVALID: t("invalidLine"),
      STOCK_REQUEST_ITEM_UNAVAILABLE: t("itemUnavailable"),
      STOCK_REQUEST_UNIT_OPTION_UNAVAILABLE: t("unitUnavailable"),
      STOCK_REQUEST_UNIT_OPTION_MISMATCH: t("unitMismatch"),
      STOCK_REQUEST_SELECTED_BATCH_UNAVAILABLE: t("batchUnavailable"),
      STOCK_REQUEST_SELECTED_BATCH_ITEM_MISMATCH: t("batchUnavailable"),
      STOCK_REQUEST_SELECTED_BATCH_BUSINESS_UNIT_MISMATCH: t("batchUnavailable"),
      STOCK_REQUEST_SELECTED_BATCH_INSUFFICIENT: t("batchQuantityUnavailable"),
    },
  });
  const createMutation = useCreateStockRequest(draftMutationMessages(t("createSuccess")));
  const updateMutation = useUpdateStockRequest(draftMutationMessages(t("updateSuccess")));
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const columns = getDocumentLineColumns({
    trackingColumns: [],
    showBatch: true,
    showUnitCost: false,
    showLineTotal: false,
    showAction: true,
  });

  const [lines, setLines] = useState<StockRequestFormLine[]>(() => toFormLines(stockRequest));
  const [initialLinesSignature] = useState(() => getLinesSignature(toFormLines(stockRequest)));
  const [hasPendingEntry, setHasPendingEntry] = useState(false);
  const [linesError, setLinesError] = useState<string | null>(null);
  const itemTriggerRef = useRef<HTMLButtonElement>(null);
  const [fulfillingOption, setFulfillingOption] = useState<LookupBusinessUnitOption | null>(
    stockRequest?.fulfilling_business_unit
      ? { ...stockRequest.fulfilling_business_unit, type: "", is_active: true }
      : null
  );

  const form = useForm<StockRequestFormValues>({
    resolver: zodResolver(createStockRequestFormSchema((key) => tValidation(key))),
    defaultValues: {
      requestDate: stockRequest?.request_date ?? today(),
      requiredDate: stockRequest?.required_date ?? today(),
      fulfillingBusinessUnitId: stockRequest?.fulfilling_business_unit_id ?? "",
      priority: stockRequest?.priority ?? "normal",
      purpose: stockRequest?.purpose ?? "",
      notes: stockRequest?.notes ?? "",
    },
    shouldFocusError: false,
  });

  const fulfillingBusinessUnitId = form.watch("fulfillingBusinessUnitId");
  const requiredDate = form.watch("requiredDate");
  const priority = form.watch("priority");
  const requestingBusinessUnit = stockRequest
    ? stockRequest.requesting_business_unit
    : currentBusinessUnit;
  // Pinned batches belong to the fulfilling unit, so it stays fixed while any line pins one.
  const hasPinnedBatch = lines.some((line) => line.batch != null);
  const hasUnsavedChanges =
    isEditMode && (form.formState.isDirty || getLinesSignature(lines) !== initialLinesSignature);
  const viewHref = stockRequest
    ? `/inventory/stock-requests/${stockRequest.id}`
    : "/inventory/stock-requests";

  const batchField = useMemo<DocumentLineBatchField<StockRequestLineBatch>>(
    () => ({
      render: (state) => (
        <StockRequestBatchSelect {...state} fulfillingBusinessUnitId={fulfillingBusinessUnitId} />
      ),
      validate: (batch, baseQuantity) =>
        batch?.availableBaseQty !== undefined && batch.availableBaseQty < baseQuantity
          ? t("batchInsufficient", {
              available: formatDocumentQuantity(batch.availableBaseQty, locale),
              required: formatDocumentQuantity(baseQuantity, locale),
            })
          : null,
    }),
    [fulfillingBusinessUnitId, locale, t]
  );

  const handleAddLine = (line: DocumentFormLine, batch: StockRequestLineBatch | null) => {
    setLines((current) => [...current, { ...line, batch }]);
    setLinesError(null);
  };

  const handleRemoveLine = (key: string) => {
    setLines((current) => current.filter((line) => line.key !== key));
  };

  const onSubmit = async (values: StockRequestFormValues) => {
    if (lines.length === 0) {
      setLinesError(t("lineItemsRequired"));
      itemTriggerRef.current?.focus();
      return;
    }

    const items: CreateStockRequestPayload["items"] = lines.map((line) => ({
      item_id: line.itemId,
      requested_qty: line.quantity,
      item_unit_option_id: line.itemUnitOptionId,
      selected_item_batch_id: line.batch?.id ?? null,
      uom_id: line.uomId,
      notes: line.notes,
    }));
    const sharedFields = {
      request_date: values.requestDate,
      required_date: values.requiredDate,
      priority: values.priority,
      purpose: values.purpose,
      notes: values.notes,
      items,
    };

    // The mutation hooks toast both outcomes; failures keep the page open for correction.
    try {
      if (stockRequest) {
        // The fulfilling unit is insert-only, so updates never send it.
        await updateMutation.mutateAsync({ id: stockRequest.id, data: sharedFields });
        router.push(viewHref);
      } else {
        const created = await createMutation.mutateAsync({
          ...sharedFields,
          fulfilling_business_unit_id: values.fulfillingBusinessUnitId,
        });
        router.push(`/inventory/stock-requests/${created.id}`);
      }
    } catch {
      return;
    }
  };

  const handleInvalidSubmit = (errors: FieldErrors<StockRequestFormValues>) => {
    const fieldOrder: (keyof StockRequestFormValues)[] = [
      "fulfillingBusinessUnitId",
      "requestDate",
      "requiredDate",
      "priority",
      "purpose",
      "notes",
    ];
    const firstInvalidField = fieldOrder.find((field) => errors[field]);
    if (firstInvalidField) form.setFocus(firstInvalidField);
  };

  const status = stockRequest?.status ?? "draft";
  const createdByName = formatDocumentPerson(
    stockRequest?.requested_by_user
      ? {
          firstName: stockRequest.requested_by_user.first_name ?? undefined,
          lastName: stockRequest.requested_by_user.last_name ?? undefined,
          email: stockRequest.requested_by_user.email,
        }
      : null
  );
  const formatBusinessUnit = (unit?: { code: string; name: string } | null) =>
    unit ? unit.name : t("noValue");

  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit(onSubmit, handleInvalidSubmit)}
        className="space-y-6"
      >
        <PageHeader
          title={
            <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {stockRequest
                ? t("editTitle", { code: stockRequest.request_code })
                : t("createTitle")}
              <StatusText tone={STOCK_REQUEST_STATUS_TONES[status]} className="font-semibold">
                {t(STOCK_REQUEST_STATUS_LABEL_KEYS[status])}
              </StatusText>
            </span>
          }
          subtitle={stockRequest ? t("editDescription") : t("createDescription")}
        />

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1 overflow-hidden rounded-xl border bg-card">
            <DocumentSection
              id="stock-request-transfer"
              title={t("transferTitle")}
              description={t("transferDescription")}
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="stock-request-requested-by" className="text-sm font-medium">
                    {t("requestedBy")}
                  </label>
                  <Input
                    id="stock-request-requested-by"
                    value={requestingBusinessUnit?.name ?? ""}
                    readOnly
                    className="h-10 bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">{t("requestedByHint")}</p>
                </div>

                <FormField
                  control={form.control}
                  name="fulfillingBusinessUnitId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("requestedTo")}</FormLabel>
                      {isEditMode || hasPinnedBatch ? (
                        <>
                          <FormControl>
                            <Button
                              ref={field.ref}
                              type="button"
                              variant="outline"
                              disabled
                              className="h-10 w-full justify-between bg-muted font-normal"
                            >
                              <span className="truncate">
                                {fulfillingOption?.name ?? t("noValue")}
                              </span>
                              <Lock className="h-4 w-4 shrink-0 opacity-60" aria-hidden="true" />
                            </Button>
                          </FormControl>
                          <p className="text-xs text-muted-foreground">
                            {isEditMode ? t("requestedToLockedHint") : t("requestedToBatchHint")}
                          </p>
                        </>
                      ) : (
                        <FormControl>
                          <BusinessUnitSelect
                            triggerRef={field.ref}
                            value={field.value}
                            onValueChange={field.onChange}
                            onOptionChange={setFulfillingOption}
                            selectedOption={fulfillingOption}
                            excludeId={currentBusinessUnit?.id}
                            labelVariant="warehouse"
                            buttonClassName="h-10"
                          />
                        </FormControl>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="requestDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("requestDate")}</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} className="h-10" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="requiredDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("requiredDate")}</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} className="h-10" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("priority")}</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger ref={field.ref} className="h-10">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PRIORITIES.map((value) => (
                            <SelectItem key={value} value={value}>
                              {t(STOCK_REQUEST_PRIORITY_LABEL_KEYS[value])}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </DocumentSection>

            <section aria-labelledby="stock-request-items" className="border-t">
              <DocumentLineEntry<StockRequestLineBatch>
                columns={columns}
                canViewUnitCost={false}
                lockedCurrency={null}
                mixedCurrencyMessage=""
                batchField={batchField}
                itemTriggerRef={itemTriggerRef}
                linesError={linesError}
                onAdd={handleAddLine}
                onEntryChange={setHasPendingEntry}
              />
              <div className="px-5 pb-2 pt-5 sm:px-7">
                <div className="flex items-center gap-2">
                  <h2 id="stock-request-items" className="text-sm font-semibold">
                    {t("itemsTitle")}
                  </h2>
                  <span className="rounded-full bg-primary/10 px-2 text-xs font-semibold tabular-nums">
                    {lines.length}
                  </span>
                </div>
                {/* Six columns stay readable on phones by scrolling instead of squeezing. */}
                <div className="mt-2 overflow-x-auto">
                  <div className="min-w-[44rem]">
                    <DocumentLinesTable
                      rows={lines.map((line) => ({
                        key: line.key,
                        itemCode: line.itemCode,
                        itemName: line.itemName,
                        unitLabel: line.unitLabel,
                        uomCode: line.uomCode,
                        qtyPerUnit: line.qtyPerUnit,
                        quantity: line.quantity,
                        unitPrice: null,
                        lineTotal: null,
                        batch: line.batch,
                        note: line.notes,
                        isUnsaved: isEditMode && !line.savedLineId,
                      }))}
                      columns={columns}
                      currency=""
                      totalAmount={null}
                      emptyTitle={t("noItemsTitle")}
                      emptyDescription={t("noItemsDescription")}
                      onRemove={handleRemoveLine}
                    />
                  </div>
                </div>
              </div>
            </section>

            <DocumentSection
              id="stock-request-notes"
              title={t("notesTitle")}
              description={t("notesDescription")}
            >
              <div className="space-y-5">
                <FormField
                  control={form.control}
                  name="purpose"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("purpose")}</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder={t("purposePlaceholder")} className="h-10" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("notes")}</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={4} placeholder={t("notesPlaceholder")} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </DocumentSection>
          </div>

          <DocumentSummaryPanel
            title={t("summaryTitle")}
            headerAside={
              hasUnsavedChanges ? (
                <span
                  role="status"
                  className="text-sm font-semibold text-amber-700 dark:text-amber-400"
                >
                  {t("unsavedChanges")}
                </span>
              ) : null
            }
            rows={[
              {
                key: "from",
                label: t("summaryFrom"),
                value: formatBusinessUnit(fulfillingOption),
              },
              {
                key: "to",
                label: t("summaryTo"),
                value: formatBusinessUnit(requestingBusinessUnit),
              },
              {
                key: "requiredDate",
                label: t("summaryRequiredBy"),
                value: requiredDate ? formatDocumentDate(requiredDate, locale) : t("noValue"),
              },
              {
                key: "priority",
                label: t("summaryPriority"),
                value: t(STOCK_REQUEST_PRIORITY_LABEL_KEYS[priority]),
              },
              { key: "items", label: t("summaryItems"), value: lines.length },
            ]}
            totalLabel=""
            total={null}
            actions={
              <>
                <Button type="submit" disabled={isSaving} className="h-11 w-full">
                  {isSaving ? t("saving") : stockRequest ? t("saveChanges") : t("createAction")}
                </Button>
                <Button asChild variant="outline" className="h-11 w-full">
                  <Link href={viewHref}>{stockRequest ? t("discardChanges") : t("cancel")}</Link>
                </Button>
              </>
            }
            footer={
              <>
                {!stockRequest ? <p>{t("createNote")}</p> : null}
                {hasPendingEntry ? <p>{t("pendingEntryNote")}</p> : null}
                {stockRequest && createdByName ? (
                  <p>
                    {t("createdBy", {
                      name: createdByName,
                      date: formatDocumentDate(stockRequest.created_at, locale),
                    })}
                  </p>
                ) : null}
              </>
            }
          />
        </div>
      </form>
    </Form>
  );
}
