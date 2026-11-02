"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { DocumentLineEntry } from "@/components/document-page/DocumentLineEntry";
import { DocumentLinesTable } from "@/components/document-page/DocumentLinesTable";
import { DocumentSection } from "@/components/document-page/DocumentSection";
import { DocumentSummaryPanel } from "@/components/document-page/DocumentSummaryPanel";
import { getDocumentLineColumns } from "@/components/document-page/document-line-columns";
import { AsyncSearchCombobox } from "@/components/shared/AsyncSearchCombobox";
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
import { Textarea } from "@/components/ui/textarea";
import { GRANULAR_CAPABILITIES } from "@/constants/granular-permissions";
import { useCurrency } from "@/hooks/useCurrency";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useGranularCapabilities } from "@/hooks/useGranularCapabilities";
import { useCreateStockRequisition, useUpdateStockRequisition } from "@/hooks/useStockRequisitions";
import { useSuppliers } from "@/hooks/useSuppliers";
import {
  formatDocumentAmount,
  formatDocumentDate,
  formatDocumentPerson,
} from "@/lib/documents/document-display";
import {
  STOCK_REQUISITION_STATUS_LABEL_KEYS,
  STOCK_REQUISITION_STATUS_TONES,
} from "@/lib/stock-requisitions/stock-requisition-display";
import {
  createStockRequisitionFormSchema,
  type StockRequisitionFormValues,
} from "@/lib/validations/stock-requisition";
import { useStockRequisitionDraftStore } from "@/stores/stockRequisitionDraftStore";
import type { DocumentFormLine } from "@/types/document-line";
import type { CreateStockRequisitionRequest, StockRequisition } from "@/types/stock-requisition";
import type { Supplier } from "@/types/supplier";

type StockRequisitionEditorProps = {
  stockRequisition: StockRequisition | null;
};

type SupplierOption = Pick<Supplier, "id" | "code" | "name">;

const STOCK_REQUISITION_COST_CAPABILITY_KEYS = [
  GRANULAR_CAPABILITIES.STOCK_REQUISITIONS_TOTAL_AMOUNT,
  GRANULAR_CAPABILITIES.STOCK_REQUISITIONS_UNIT_COST,
] as const;

const toFormLines = (stockRequisition: StockRequisition): DocumentFormLine[] =>
  stockRequisition.items.map((item) => ({
    key: item.id,
    savedLineId: item.id,
    itemId: item.itemId,
    itemCode: item.item?.code ?? "",
    itemName: item.item?.name ?? "",
    itemUnitOptionId: item.itemUnitOptionId || item.itemUnitOption?.id || "",
    uomId: item.uomId,
    unitLabel:
      item.itemUnitOption?.optionLabel?.trim() ||
      item.itemUnitOption?.uomName ||
      item.uomCode ||
      "",
    uomCode: item.itemUnitOption?.uomCode || item.uomCode || "",
    qtyPerUnit: item.itemUnitOption?.qtyPerUnit ?? 1,
    quantity: item.requestedQty,
    unitPrice: item.unitPrice ?? 0,
    unitPriceCurrency: stockRequisition.currency,
    notes: item.notes,
  }));

const getLinesSignature = (lines: DocumentFormLine[]) =>
  JSON.stringify(
    lines.map((line) => [line.savedLineId, line.itemUnitOptionId, line.quantity, line.unitPrice])
  );

export function StockRequisitionEditor({ stockRequisition }: StockRequisitionEditorProps) {
  const t = useTranslations("stockRequisitionPage");
  const tValidation = useTranslations("stockRequisitionValidation");
  const locale = useLocale();
  const router = useRouter();
  const isEditMode = stockRequisition != null;
  const { currentCurrency } = useCurrency();
  const createMutation = useCreateStockRequisition();
  const updateMutation = useUpdateStockRequisition();
  const isSaving = createMutation.isPending || updateMutation.isPending;
  const clearPendingLines = useStockRequisitionDraftStore((state) => state.clearPendingLines);

  const { data: granularCapabilities } = useGranularCapabilities(
    STOCK_REQUISITION_COST_CAPABILITY_KEYS
  );
  const canViewTotalAmount =
    stockRequisition?.capabilities?.canViewTotalAmount ??
    granularCapabilities?.[GRANULAR_CAPABILITIES.STOCK_REQUISITIONS_TOTAL_AMOUNT] === true;
  const canViewUnitCost =
    stockRequisition?.capabilities?.canViewUnitCost ??
    granularCapabilities?.[GRANULAR_CAPABILITIES.STOCK_REQUISITIONS_UNIT_COST] === true;
  const canShowAmounts = canViewTotalAmount && canViewUnitCost;
  const columns = getDocumentLineColumns({
    trackingColumns: [],
    showUnitCost: canViewUnitCost,
    showLineTotal: canShowAmounts,
    showAction: true,
  });

  // A new requisition can start from lines handed over by the reorder alerts screen.
  const [lines, setLines] = useState<DocumentFormLine[]>(() =>
    stockRequisition
      ? toFormLines(stockRequisition)
      : (useStockRequisitionDraftStore.getState().pendingLines ?? [])
  );
  const [initialLinesSignature] = useState(() => getLinesSignature(lines));
  const [hasPendingEntry, setHasPendingEntry] = useState(false);
  const [linesError, setLinesError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const itemTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isEditMode) clearPendingLines();
  }, [clearPendingLines, isEditMode]);

  const [supplierSearch, setSupplierSearch] = useState("");
  const debouncedSupplierSearch = useDebouncedValue(supplierSearch.trim(), 300);
  const { data: suppliersData, isLoading: isLoadingSuppliers } = useSuppliers({
    search: debouncedSupplierSearch || undefined,
    status: "active",
    limit: 10,
  });
  const supplierOptions = useMemo<SupplierOption[]>(
    () => suppliersData?.data ?? [],
    [suppliersData?.data]
  );
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierOption | null>(
    stockRequisition?.supplier ?? null
  );

  const form = useForm<StockRequisitionFormValues>({
    resolver: zodResolver(createStockRequisitionFormSchema((key) => tValidation(key))),
    defaultValues: {
      supplierId: stockRequisition?.supplierId ?? "",
      requisitionDate:
        stockRequisition?.requisitionDate.split("T")[0] ?? new Date().toISOString().split("T")[0],
      requiredByDate: stockRequisition?.requiredByDate?.split("T")[0] ?? "",
      notes: stockRequisition?.notes ?? "",
    },
    shouldFocusError: false,
  });

  const requisitionDate = form.watch("requisitionDate");
  const requiredByDate = form.watch("requiredByDate");
  const lockedCurrency = canViewUnitCost ? (lines[0]?.unitPriceCurrency ?? null) : null;
  const documentCurrency = lockedCurrency ?? stockRequisition?.currency ?? currentCurrency.code;
  const lineItemIds = useMemo(() => new Set(lines.map((line) => line.itemId)), [lines]);
  const totalAmount = canShowAmounts
    ? lines.reduce((sum, line) => sum + line.quantity * line.qtyPerUnit * line.unitPrice, 0)
    : null;
  const hasUnsavedChanges =
    isEditMode && (form.formState.isDirty || getLinesSignature(lines) !== initialLinesSignature);
  const viewHref = stockRequisition
    ? `/purchasing/stock-requisitions/${stockRequisition.id}`
    : "/purchasing/stock-requisitions";

  const handleAddLine = (line: DocumentFormLine) => {
    setLines((current) => [...current, line]);
    setLinesError(null);
    setSaveError(null);
  };

  const handleRemoveLine = (key: string) => {
    setLines((current) => current.filter((line) => line.key !== key));
    setSaveError(null);
  };

  const onSubmit = async (values: StockRequisitionFormValues) => {
    setSaveError(null);
    if (lines.length === 0) {
      setLinesError(t("lineItemsRequired"));
      itemTriggerRef.current?.focus();
      return;
    }

    // Users without unit cost access must not send costs; the API prices those lines itself.
    const requestData: CreateStockRequisitionRequest = {
      supplierId: values.supplierId,
      requisitionDate: values.requisitionDate,
      requiredByDate: values.requiredByDate,
      notes: values.notes,
      ...(canViewUnitCost ? { currency: documentCurrency } : {}),
      items: lines.map((line) => ({
        itemId: line.itemId,
        itemUnitOptionId: line.itemUnitOptionId,
        uomId: line.uomId,
        requestedQty: line.quantity,
        ...(canViewUnitCost ? { unitPrice: line.unitPrice } : {}),
        notes: line.notes,
      })),
    };

    try {
      if (stockRequisition) {
        await updateMutation.mutateAsync({ id: stockRequisition.id, data: requestData });
        toast.success(t("updateSuccess"));
        router.push(viewHref);
      } else {
        const created = await createMutation.mutateAsync(requestData);
        toast.success(t("createSuccess"));
        router.push(`/purchasing/stock-requisitions/${created.id}`);
      }
    } catch (error) {
      // The API client surfaces the route's safe error message.
      setSaveError(error instanceof Error && error.message ? error.message : t("saveError"));
    }
  };

  const handleInvalidSubmit = (errors: FieldErrors<StockRequisitionFormValues>) => {
    setSaveError(null);
    const fieldOrder: (keyof StockRequisitionFormValues)[] = [
      "supplierId",
      "requisitionDate",
      "requiredByDate",
      "notes",
    ];
    const firstInvalidField = fieldOrder.find((field) => errors[field]);
    if (firstInvalidField) form.setFocus(firstInvalidField);
  };

  const status = stockRequisition?.status ?? "draft";
  const createdByName = formatDocumentPerson(stockRequisition?.createdByUser);
  const formatDate = (value?: string) => (value ? formatDocumentDate(value, locale) : t("noValue"));

  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit(onSubmit, handleInvalidSubmit)}
        onChangeCapture={() => setSaveError(null)}
        className="space-y-6"
      >
        <PageHeader
          title={
            <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {stockRequisition
                ? t("editTitle", { code: stockRequisition.srNumber })
                : t("createTitle")}
              <StatusText tone={STOCK_REQUISITION_STATUS_TONES[status]} className="font-semibold">
                {t(STOCK_REQUISITION_STATUS_LABEL_KEYS[status])}
              </StatusText>
            </span>
          }
          subtitle={stockRequisition ? t("editDescription") : t("createDescription")}
        />

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1 overflow-hidden rounded-xl border bg-card">
            <DocumentSection
              id="stock-requisition-request"
              title={t("requestTitle")}
              description={t("requestDescription")}
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="supplierId"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>{t("supplier")}</FormLabel>
                      <FormControl>
                        <AsyncSearchCombobox
                          value={field.value}
                          onValueChange={(supplierId) => {
                            setSelectedSupplier(
                              supplierOptions.find((option) => option.id === supplierId) ?? null
                            );
                            field.onChange(supplierId);
                          }}
                          searchValue={supplierSearch}
                          onSearchValueChange={setSupplierSearch}
                          options={supplierOptions}
                          selectedOption={selectedSupplier}
                          getOptionValue={(supplier) => supplier.id}
                          getOptionLabel={(supplier) => supplier.name}
                          getOptionSearchValue={(supplier) => `${supplier.code} ${supplier.name}`}
                          renderOption={(supplier) => (
                            <div className="min-w-0">
                              <div className="truncate">{supplier.name}</div>
                              <div className="text-xs text-muted-foreground">{supplier.code}</div>
                            </div>
                          )}
                          placeholder={t("selectSupplier")}
                          searchPlaceholder={t("searchSupplier")}
                          emptyMessage={t("noSupplierFound")}
                          loadingMessage={t("loadingSuppliers")}
                          isLoading={isLoadingSuppliers}
                          triggerRef={field.ref}
                          buttonClassName="h-10"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="requisitionDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("requisitionDate")}</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} className="h-10" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="requiredByDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("requiredByDate")}</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} className="h-10" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </DocumentSection>

            <section aria-labelledby="stock-requisition-items" className="border-t">
              <DocumentLineEntry
                columns={columns}
                canViewUnitCost={canViewUnitCost}
                lockedCurrency={lockedCurrency}
                mixedCurrencyMessage={t("mixedCurrencyNotAllowed")}
                existingItemIds={lineItemIds}
                itemTriggerRef={itemTriggerRef}
                linesError={linesError}
                onAdd={handleAddLine}
                onEntryChange={setHasPendingEntry}
              />
              <div className="px-5 pb-2 pt-5 sm:px-7">
                <div className="flex items-center gap-2">
                  <h2 id="stock-requisition-items" className="text-sm font-semibold">
                    {t("itemsTitle")}
                  </h2>
                  <span className="rounded-full bg-primary/10 px-2 text-xs font-semibold tabular-nums">
                    {lines.length}
                  </span>
                </div>
                {/* Seven columns stay readable on phones by scrolling instead of squeezing. */}
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
                        unitPrice: line.unitPrice,
                        lineTotal: line.quantity * line.qtyPerUnit * line.unitPrice,
                        isUnsaved: isEditMode && !line.savedLineId,
                      }))}
                      columns={columns}
                      currency={documentCurrency}
                      totalAmount={totalAmount}
                      emptyTitle={t("noItemsTitle")}
                      emptyDescription={t("noItemsDescription")}
                      onRemove={handleRemoveLine}
                    />
                  </div>
                </div>
              </div>
            </section>

            <DocumentSection
              id="stock-requisition-notes"
              title={t("notesTitle")}
              description={t("notesDescription")}
            >
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="sr-only">{t("notesTitle")}</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={4} placeholder={t("notesPlaceholder")} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                key: "supplier",
                label: t("summarySupplier"),
                value: selectedSupplier?.name ?? t("noValue"),
              },
              {
                key: "requested",
                label: t("summaryRequested"),
                value: formatDate(requisitionDate),
              },
              {
                key: "requiredBy",
                label: t("summaryRequiredBy"),
                value: formatDate(requiredByDate),
              },
              { key: "items", label: t("summaryItems"), value: lines.length },
            ]}
            totalLabel={t("total")}
            total={
              totalAmount == null
                ? null
                : formatDocumentAmount(totalAmount, documentCurrency, locale)
            }
            actions={
              <>
                {saveError ? (
                  <p role="alert" className="text-sm font-medium text-destructive">
                    {saveError}
                  </p>
                ) : null}
                <Button type="submit" disabled={isSaving} className="h-11 w-full">
                  {isSaving ? t("saving") : stockRequisition ? t("saveChanges") : t("createAction")}
                </Button>
                <Button asChild variant="outline" className="h-11 w-full">
                  <Link href={viewHref}>
                    {stockRequisition ? t("discardChanges") : t("cancel")}
                  </Link>
                </Button>
              </>
            }
            footer={
              <>
                {!stockRequisition ? <p>{t("createNote")}</p> : null}
                {hasPendingEntry ? <p>{t("pendingEntryNote")}</p> : null}
                {stockRequisition && createdByName ? (
                  <p>
                    {t("createdBy", {
                      name: createdByName,
                      date: formatDocumentDate(stockRequisition.createdAt, locale),
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
