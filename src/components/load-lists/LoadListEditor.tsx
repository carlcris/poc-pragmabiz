"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { BusinessUnitSelect } from "@/components/business-units/BusinessUnitSelect";
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
import { useCreateLoadList, useUpdateLoadList } from "@/hooks/useLoadLists";
import { useSuppliers } from "@/hooks/useSuppliers";
import type { LookupBusinessUnitOption } from "@/hooks/useLookups";
import { DocumentLineEntry } from "@/components/document-page/DocumentLineEntry";
import { DocumentLinesTable } from "@/components/document-page/DocumentLinesTable";
import { DocumentSection } from "@/components/document-page/DocumentSection";
import { DocumentSummaryPanel } from "@/components/document-page/DocumentSummaryPanel";
import { getDocumentLineColumns } from "@/components/document-page/document-line-columns";
import {
  formatDocumentAmount,
  formatDocumentDate,
  formatDocumentPerson,
} from "@/lib/documents/document-display";
import {
  LOAD_LIST_STATUS_LABEL_KEYS,
  LOAD_LIST_STATUS_TONES,
} from "@/lib/load-lists/load-list-display";
import { cn } from "@/lib/utils";
import { createLoadListFormSchema, type LoadListFormValues } from "@/lib/validations/load-list";
import type { DocumentFormLine } from "@/types/document-line";
import type { CreateLoadListRequest, LoadList, UpdateLoadListRequest } from "@/types/load-list";
import type { Supplier } from "@/types/supplier";

type LoadListEditorProps = {
  loadList: LoadList | null;
};

type SupplierOption = Pick<Supplier, "id" | "code" | "name">;

const LOAD_LIST_COST_CAPABILITY_KEYS = [
  GRANULAR_CAPABILITIES.LOAD_LISTS_TOTAL_AMOUNT,
  GRANULAR_CAPABILITIES.LOAD_LISTS_UNIT_PRICE,
] as const;

const toFormLines = (loadList: LoadList | null): DocumentFormLine[] =>
  loadList?.items.map((item) => ({
    key: item.id,
    savedLineId: item.id,
    itemId: item.itemId,
    itemCode: item.item?.code ?? "",
    itemName: item.item?.name ?? "",
    itemUnitOptionId: item.itemUnitOptionId || item.itemUnitOption?.id || "",
    uomId: item.uomId || "",
    unitLabel: item.unitName,
    uomCode: item.itemUnitOption?.uomCode || item.uomCode || "",
    qtyPerUnit: item.qtyPerUnit,
    quantity: item.loadListQty,
    unitPrice: item.unitPrice ?? 0,
    unitPriceCurrency: loadList.currency,
    notes: item.notes,
  })) ?? [];

const getLinesSignature = (lines: DocumentFormLine[]) =>
  JSON.stringify(
    lines.map((line) => [line.savedLineId, line.itemUnitOptionId, line.quantity, line.unitPrice])
  );

export function LoadListEditor({ loadList }: LoadListEditorProps) {
  const t = useTranslations("loadListPage");
  const tValidation = useTranslations("loadListValidation");
  const locale = useLocale();
  const router = useRouter();
  const isEditMode = loadList != null;
  const { currentCurrency } = useCurrency();
  const createMutation = useCreateLoadList();
  const updateMutation = useUpdateLoadList();
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const { data: granularCapabilities } = useGranularCapabilities(LOAD_LIST_COST_CAPABILITY_KEYS);
  const canViewTotalAmount =
    loadList?.capabilities?.canViewTotalAmount ??
    granularCapabilities?.[GRANULAR_CAPABILITIES.LOAD_LISTS_TOTAL_AMOUNT] === true;
  const canViewUnitPrice =
    loadList?.capabilities?.canViewUnitPrice ??
    granularCapabilities?.[GRANULAR_CAPABILITIES.LOAD_LISTS_UNIT_PRICE] === true;
  const canShowAmounts = canViewTotalAmount && canViewUnitPrice;
  const columns = getDocumentLineColumns({
    trackingColumns: [],
    showUnitCost: canViewUnitPrice,
    showLineTotal: canShowAmounts,
    showAction: true,
  });

  const [lines, setLines] = useState<DocumentFormLine[]>(() => toFormLines(loadList));
  const [initialLinesSignature] = useState(() => getLinesSignature(toFormLines(loadList)));
  const [hasPendingEntry, setHasPendingEntry] = useState(false);
  const [linesError, setLinesError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const itemTriggerRef = useRef<HTMLButtonElement>(null);
  const loadDateInputRef = useRef<HTMLInputElement | null>(null);

  const [supplierSearch, setSupplierSearch] = useState("");
  const debouncedSupplierSearch = useDebouncedValue(supplierSearch.trim(), 300);
  const { data: suppliersData, isLoading: isLoadingSuppliers } = useSuppliers({
    search: debouncedSupplierSearch || undefined,
    limit: 10,
  });
  const supplierOptions = useMemo<SupplierOption[]>(
    () => suppliersData?.data ?? [],
    [suppliersData?.data]
  );
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierOption | null>(
    loadList?.supplier ?? null
  );
  const [destinationOption, setDestinationOption] = useState<LookupBusinessUnitOption | null>(
    loadList?.destinationBusinessUnit
      ? { ...loadList.destinationBusinessUnit, type: "", is_active: true }
      : null
  );

  const form = useForm<LoadListFormValues>({
    resolver: zodResolver(
      createLoadListFormSchema(
        (key) => tValidation(key),
        () => loadDateInputRef.current?.validity.badInput === true
      )
    ),
    defaultValues: {
      supplierId: loadList?.supplierId ?? "",
      destinationBusinessUnitId: loadList?.destinationBusinessUnitId ?? "",
      supplierLlNumber: loadList?.supplierLlNumber ?? "",
      containerNumber: loadList?.containerNumber ?? "",
      sealNumber: loadList?.sealNumber ?? "",
      batchNumber: loadList?.batchNumber ?? "",
      loadDate: loadList
        ? (loadList.loadDate?.split("T")[0] ?? "")
        : new Date().toISOString().split("T")[0],
      notes: loadList?.notes ?? "",
    },
    shouldFocusError: false,
  });

  const loadDate = form.watch("loadDate");
  const containerNumber = form.watch("containerNumber");
  const lockedCurrency = lines[0]?.unitPriceCurrency ?? null;
  const documentCurrency = lockedCurrency ?? loadList?.currency ?? currentCurrency.code;
  const totalAmount = canShowAmounts
    ? lines.reduce((sum, line) => sum + line.quantity * line.qtyPerUnit * line.unitPrice, 0)
    : null;
  const hasUnsavedChanges =
    isEditMode && (form.formState.isDirty || getLinesSignature(lines) !== initialLinesSignature);
  const viewHref = loadList ? `/purchasing/load-lists/${loadList.id}` : "/purchasing/load-lists";

  const handleAddLine = (line: DocumentFormLine) => {
    setLines((current) => [...current, line]);
    setLinesError(null);
    setSaveError(null);
  };

  const handleRemoveLine = (key: string) => {
    setLines((current) => current.filter((line) => line.key !== key));
    setSaveError(null);
  };

  const onSubmit = async (values: LoadListFormValues) => {
    setSaveError(null);
    if (lines.length === 0) {
      setLinesError(t("lineItemsRequired"));
      itemTriggerRef.current?.focus();
      return;
    }

    const sharedFields: UpdateLoadListRequest = {
      supplierId: values.supplierId,
      supplierLlNumber: values.supplierLlNumber,
      containerNumber: values.containerNumber,
      sealNumber: values.sealNumber,
      batchNumber: values.batchNumber,
      loadDate: values.loadDate,
      notes: values.notes,
      currency: documentCurrency,
      items: lines.map((line) => ({
        itemId: line.itemId,
        itemUnitOptionId: line.itemUnitOptionId,
        uomId: line.uomId,
        loadListQty: line.quantity,
        unitPrice: line.unitPrice,
        notes: line.notes,
      })),
    };

    try {
      if (loadList) {
        await updateMutation.mutateAsync({ id: loadList.id, data: sharedFields });
        toast.success(t("updateSuccess"));
        router.push(viewHref);
      } else {
        const createData: CreateLoadListRequest = {
          ...sharedFields,
          destinationBusinessUnitId: values.destinationBusinessUnitId,
        };
        const created = await createMutation.mutateAsync(createData);
        toast.success(t("createSuccess"));
        router.push(`/purchasing/load-lists/${created.id}`);
      }
    } catch (error) {
      const apiError = error instanceof Error ? error.cause : null;
      setSaveError(
        typeof apiError === "object" &&
          apiError !== null &&
          "error" in apiError &&
          typeof apiError.error === "string"
          ? apiError.error
          : t("saveError")
      );
    }
  };

  const handleInvalidSubmit = (errors: FieldErrors<LoadListFormValues>) => {
    setSaveError(null);
    const fieldOrder: (keyof LoadListFormValues)[] = [
      "supplierId",
      "destinationBusinessUnitId",
      "supplierLlNumber",
      "loadDate",
      "containerNumber",
      "sealNumber",
      "batchNumber",
      "notes",
    ];
    const firstInvalidField = fieldOrder.find((field) => errors[field]);
    if (firstInvalidField) form.setFocus(firstInvalidField);
  };

  const status = loadList?.status ?? "draft";
  const createdByName = formatDocumentPerson(loadList?.createdByUser);

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
              {loadList ? t("editTitle", { code: loadList.llNumber }) : t("createTitle")}
              <StatusText tone={LOAD_LIST_STATUS_TONES[status]} className="font-semibold">
                {t(LOAD_LIST_STATUS_LABEL_KEYS[status])}
              </StatusText>
            </span>
          }
          subtitle={loadList ? t("editDescription") : t("createDescription")}
        />

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          {/* Phones: full-bleed form (negative margin cancels the shell's p-4 gutter) instead of a card. */}
          <div className="-mx-4 min-w-0 flex-1 overflow-hidden border-y bg-card sm:mx-0 sm:rounded-xl sm:border">
            <DocumentSection
              id="load-list-shipment"
              title={t("shipmentTitle")}
              description={t("shipmentDescription")}
              headerBelowXl="hidden"
            >
              <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:gap-x-5">
                <FormField
                  control={form.control}
                  name="supplierId"
                  render={({ field }) => (
                    <FormItem className="col-span-2 space-y-1.5 sm:col-span-1">
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
                          buttonClassName="h-10 px-3"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="destinationBusinessUnitId"
                  render={({ field }) => (
                    <FormItem className="col-span-2 space-y-1.5 sm:col-span-1">
                      <FormLabel>{t("destinationBusinessUnit")}</FormLabel>
                      {isEditMode ? (
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
                                {destinationOption?.name ?? t("noValue")}
                              </span>
                              <Lock className="h-4 w-4 shrink-0 opacity-60" aria-hidden="true" />
                            </Button>
                          </FormControl>
                          <p className="text-xs text-muted-foreground">
                            {t("destinationLockedHint")}
                          </p>
                        </>
                      ) : (
                        <FormControl>
                          <BusinessUnitSelect
                            triggerRef={field.ref}
                            value={field.value}
                            onValueChange={field.onChange}
                            onOptionChange={setDestinationOption}
                            selectedOption={destinationOption}
                            labelVariant="warehouse"
                            buttonClassName="h-10 px-3"
                          />
                        </FormControl>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="supplierLlNumber"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel>{t("supplierLlNumber")}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder={t("supplierLlNumberPlaceholder")}
                          className="h-10"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="loadDate"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel>{t("loadDate")}</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          ref={(input) => {
                            field.ref(input);
                            loadDateInputRef.current = input;
                          }}
                          onKeyUp={() => {
                            if (form.getFieldState("loadDate").error) void form.trigger("loadDate");
                          }}
                          className="h-10"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </DocumentSection>

            <DocumentSection
              id="load-list-container"
              title={t("containerTitle")}
              description={t("containerDescription")}
              headerBelowXl="hidden"
            >
              <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:gap-x-5 xl:grid-cols-3">
                {(
                  [
                    ["containerNumber", t("containerNumber"), undefined],
                    ["sealNumber", t("sealNumber"), undefined],
                    ["batchNumber", t("batchNumber"), t("batchNumberPlaceholder")],
                  ] as const
                ).map(([name, label, placeholder]) => (
                  <FormField
                    key={name}
                    control={form.control}
                    name={name}
                    render={({ field }) => (
                      <FormItem
                        className={cn(
                          "space-y-1.5",
                          name === "batchNumber" && "col-span-2 sm:col-span-1"
                        )}
                      >
                        <FormLabel>{label}</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder={placeholder} className="h-10" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </DocumentSection>

            <section aria-labelledby="load-list-items" className="border-t">
              <DocumentLineEntry
                columns={columns}
                canViewUnitCost={canViewUnitPrice}
                lockedCurrency={lockedCurrency}
                mixedCurrencyMessage={t("mixedCurrencyNotAllowed")}
                itemTriggerRef={itemTriggerRef}
                linesError={linesError}
                onAdd={handleAddLine}
                onEntryChange={setHasPendingEntry}
              />
              <div className="px-4 pb-2 pt-5 sm:px-7">
                <div className="flex items-center gap-2">
                  <h2 id="load-list-items" className="text-sm font-semibold">
                    {t("itemsTitle")}
                  </h2>
                  <span className="rounded-full bg-primary/10 px-2 text-xs font-semibold tabular-nums">
                    {lines.length}
                  </span>
                </div>
                <div className="mt-2">
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
            </section>

            <DocumentSection
              id="load-list-notes"
              title={t("notesTitle")}
              description={t("notesDescription")}
              headerBelowXl="titleOnly"
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
                key: "destination",
                label: t("summaryDeliverTo"),
                value: destinationOption?.name ?? t("noValue"),
              },
              {
                key: "loadDate",
                label: t("summaryLoaded"),
                value: loadDate ? formatDocumentDate(loadDate, locale) : t("noValue"),
              },
              {
                key: "container",
                label: t("summaryContainer"),
                value: containerNumber?.trim() || t("noValue"),
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
                  {isSaving ? t("saving") : loadList ? t("saveChanges") : t("createAction")}
                </Button>
                <Button asChild variant="outline" className="h-11 w-full">
                  <Link href={viewHref}>{loadList ? t("discardChanges") : t("cancel")}</Link>
                </Button>
              </>
            }
            footer={
              <>
                {!loadList ? <p>{t("createNote")}</p> : null}
                {hasPendingEntry ? <p>{t("pendingEntryNote")}</p> : null}
                {loadList && createdByName ? (
                  <p>
                    {t("createdBy", {
                      name: createdByName,
                      date: formatDocumentDate(loadList.createdAt, locale),
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
