"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { useCreateTransformationOrder } from "@/hooks/useTransformationOrders";
import { useActiveTransformationTemplateOptions } from "@/hooks/useTransformationTemplates";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { getApiErrorCode } from "@/lib/api";
import { AsyncSearchCombobox } from "@/components/shared/AsyncSearchCombobox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { WarehouseSelect } from "@/components/warehouses/WarehouseSelect";
import type { TransformationOrderCreateErrorCode } from "@/types/transformation-order";
import type { TransformationTemplateListItemApi } from "@/types/transformation-template";

type FormValues = {
  templateId: string;
  warehouseId: string;
  orderDate: string;
  plannedDate: string;
  notes: string;
};

type FormErrors = {
  templateId?: string;
  warehouseId?: string;
  plannedQuantity?: string;
  orderDate?: string;
  root?: string;
};

export type PlannedQuantityLine = {
  key: string;
  direction: "input" | "output";
  itemCode?: string | null;
  itemName?: string | null;
  /** Configured base unit of measure, when the list response carries one. */
  uomLabel?: string | null;
  baseQuantity: string;
};

type PlannedQuantityCalculation = {
  scale: string;
  quantities: bigint[];
};

const toDateInputValue = (value: Date) => {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// A numeric draft that is not yet a number: "", "-", ".", "-." or a trailing
// dot such as "1.". The shared Input swallows exactly these before calling
// `onChange`, so the entry fields read them off the DOM event instead.
const INCOMPLETE_QUANTITY = /^-?(?:\d*\.)?$/;

const BIGINT_ZERO = BigInt(0);
const BIGINT_TWO = BigInt(2);
const PLANNED_QUANTITY_DECIMAL_FACTOR = BigInt(10_000);
const PLANNED_QUANTITY_PRODUCT_FACTOR =
  PLANNED_QUANTITY_DECIMAL_FACTOR * PLANNED_QUANTITY_DECIMAL_FACTOR;

const parseScaledDecimal = (value: string): bigint | null => {
  const match = /^(\d+)(?:\.(\d{1,4}))?$/.exec(value.trim());
  if (!match) return null;

  const fractionalDigits = (match[2] ?? "").padEnd(4, "0");
  return BigInt(match[1]) * PLANNED_QUANTITY_DECIMAL_FACTOR + BigInt(fractionalDigits || "0");
};

const parsePositiveWholeQuantity = (value: string): bigint | null => {
  const match = /^(\d+)(?:\.(0+))?$/.exec(value.trim());
  if (!match) return null;

  const quantity = BigInt(match[1]);
  return quantity > BIGINT_ZERO ? quantity : null;
};

const formatScaledDecimal = (value: bigint) => {
  const whole = value / PLANNED_QUANTITY_DECIMAL_FACTOR;
  const fractional = (value % PLANNED_QUANTITY_DECIMAL_FACTOR)
    .toString()
    .padStart(4, "0")
    .replace(/0+$/, "");
  return fractional ? `${whole}.${fractional}` : whole.toString();
};

const calculatePlannedQuantities = (
  lines: PlannedQuantityLine[],
  referenceLine: PlannedQuantityLine,
  referenceQuantity: bigint
): PlannedQuantityCalculation | null => {
  const referenceBaseQuantity = parseScaledDecimal(referenceLine.baseQuantity);
  if (!referenceBaseQuantity || referenceBaseQuantity <= BIGINT_ZERO) return null;

  const scale =
    (referenceQuantity * PLANNED_QUANTITY_PRODUCT_FACTOR + referenceBaseQuantity / BIGINT_TWO) /
    referenceBaseQuantity;
  if (scale <= BIGINT_ZERO) return null;

  const quantities: bigint[] = [];
  for (const line of lines) {
    const baseQuantity = parseScaledDecimal(line.baseQuantity);
    if (!baseQuantity || baseQuantity <= BIGINT_ZERO) return null;

    const product = baseQuantity * scale;
    if (product % PLANNED_QUANTITY_PRODUCT_FACTOR !== BIGINT_ZERO) return null;
    quantities.push(product / PLANNED_QUANTITY_PRODUCT_FACTOR);
  }

  const referenceIndex = lines.findIndex((line) => line.key === referenceLine.key);
  if (referenceIndex < 0 || quantities[referenceIndex] !== referenceQuantity) return null;

  return {
    scale: formatScaledDecimal(scale),
    quantities,
  };
};

const uomLabelOf = (uom?: { code?: string | null; name?: string | null } | null) =>
  uom?.code ?? uom?.name ?? null;

export const getPlannedQuantityLines = (
  template?: TransformationTemplateListItemApi
): PlannedQuantityLine[] => {
  if (!template) return [];

  const inputs = [...(template.inputs ?? [])]
    .sort((left, right) => (left.sequence ?? 1) - (right.sequence ?? 1))
    .map((input) => ({
      key: `input:${input.id}`,
      direction: "input" as const,
      itemCode: input.items?.item_code,
      itemName: input.items?.item_name,
      uomLabel: uomLabelOf(input.uom ?? input.items?.uom),
      baseQuantity: String(input.quantity),
    }));

  const primaryOutputs = [...(template.outputs ?? [])]
    .sort((left, right) => (left.sequence ?? 1) - (right.sequence ?? 1))
    .map((output) => ({
      key: `primary-output:${output.id}`,
      direction: "output" as const,
      itemCode: output.items?.item_code,
      itemName: output.items?.item_name,
      uomLabel: uomLabelOf(output.uom ?? output.items?.uom),
      baseQuantity: String(output.quantity),
    }));

  const additionalOutputs = [...(template.additional_outputs ?? [])]
    .sort((left, right) => left.sequence - right.sequence)
    .map((output) => ({
      key: `additional-output:${output.id}`,
      direction: "output" as const,
      itemCode: output.items?.item_code,
      itemName: output.items?.item_name,
      uomLabel: uomLabelOf(output.uom ?? output.items?.uom),
      baseQuantity: String(output.quantity),
    }));

  return [...inputs, ...primaryOutputs, ...additionalOutputs];
};

export type PlannedQuantityPlanError = "wholeNumbersOnly" | "invalidRatio";

/**
 * The one validated reading of the current entries against the current template
 * lines: the multiplier the order is submitted with and the yield the preview
 * shows, from the same arithmetic. A plan exists only while every entry is a
 * positive whole number on the template ratio, so an invalid, blank, zero, or
 * non-dividing edit produces an error instead — the same condition that blocks
 * the POST, so the preview can never show a yield the form would not submit,
 * and the submitted multiplier can never lag a re-scaled ratio.
 */
export const getPlannedQuantityPlan = (
  lines: PlannedQuantityLine[],
  quantityValues: Record<string, string>
):
  | { multiplier: string; outputYield: Array<{ line: PlannedQuantityLine; quantity: bigint }> }
  | { error: PlannedQuantityPlanError }
  | null => {
  if (lines.length === 0) return null;

  const quantities = lines.map((line) =>
    parsePositiveWholeQuantity(quantityValues[line.key] ?? "")
  );
  const referenceQuantity = quantities[0];
  if (referenceQuantity === null || quantities.some((quantity) => quantity === null)) {
    return { error: "wholeNumbersOnly" };
  }

  const calculation = calculatePlannedQuantities(lines, lines[0], referenceQuantity);
  if (
    !calculation ||
    calculation.quantities.some((quantity, index) => quantity !== quantities[index])
  ) {
    return { error: "invalidRatio" };
  }

  const outputYield = lines.flatMap((line, index) =>
    line.direction === "output" ? [{ line, quantity: calculation.quantities[index] }] : []
  );

  return { multiplier: calculation.scale, outputYield };
};

export const getPlannedQuantityValidationError = (
  lines: PlannedQuantityLine[],
  quantityValues: Record<string, string>
): PlannedQuantityPlanError | null => {
  const plan = getPlannedQuantityPlan(lines, quantityValues);
  return plan && "error" in plan ? plan.error : null;
};

/**
 * The expected yield of the entered quantities: every output line with the
 * quantity the current entries actually produce, read from the validated plan.
 */
export const getExpectedOutputYield = (
  lines: PlannedQuantityLine[],
  quantityValues: Record<string, string>
): Array<{ line: PlannedQuantityLine; quantity: bigint }> | null => {
  const plan = getPlannedQuantityPlan(lines, quantityValues);
  if (!plan || "error" in plan) return null;

  return plan.outputYield.length > 0 ? plan.outputYield : null;
};

const transformationOrderCreateErrorCodes = [
  "TRANSFORMATION_CONTEXT_INVALID",
  "TRANSFORMATION_CREATE_FORBIDDEN",
  "TRANSFORMATION_PLANNED_QUANTITY_INVALID",
  "TRANSFORMATION_PLANNED_QUANTITY_RATIO_INVALID",
  "TRANSFORMATION_TEMPLATE_UNAVAILABLE",
  "TRANSFORMATION_WAREHOUSE_UNAVAILABLE",
  "TRANSFORMATION_TEMPLATE_LINES_REQUIRED",
  "TRANSFORMATION_TEMPLATE_ITEM_UNAVAILABLE",
] as const satisfies readonly TransformationOrderCreateErrorCode[];

export function TransformationOrderCreateForm() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("transformation");
  const tCommon = useTranslations("common");

  const createOrder = useCreateTransformationOrder();

  const [templateSearch, setTemplateSearch] = useState("");
  const debouncedTemplateSearch = useDebouncedValue(templateSearch.trim(), 400);
  const searchIsSettling = templateSearch.trim() !== debouncedTemplateSearch;
  // A snapshot of the chosen template, so the form keeps a definition to plan
  // against when the current search or page no longer contains that row.
  const [selectedTemplateSnapshot, setSelectedTemplateSnapshot] =
    useState<TransformationTemplateListItemApi | null>(null);

  const {
    data: templatesData,
    isFetching: templatesFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isError: templatesError,
    isFetchNextPageError,
  } = useActiveTransformationTemplateOptions(debouncedTemplateSearch);

  const templateOptions = useMemo(() => {
    const pages = templatesData?.pages;
    if (!pages) return [];
    // Pages are appended in order. The server order is deterministic, so a
    // later page cannot repeat an earlier row unless a template was created
    // between two requests, which is why rows are deduplicated by id.
    const seen = new Set<string>();
    return pages.flatMap((page) =>
      page.data.filter((template) => {
        if (seen.has(template.id)) return false;
        seen.add(template.id);
        return true;
      })
    );
  }, [templatesData?.pages]);

  const [values, setValues] = useState<FormValues>({
    templateId: "",
    warehouseId: "",
    orderDate: toDateInputValue(new Date()),
    plannedDate: "",
    notes: "",
  });
  const [plannedQuantityValues, setPlannedQuantityValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<FormErrors>({});

  // The loaded options are the fresher reading of the chosen template, so the
  // planner follows a definition edited since it was picked. The snapshot only
  // covers the case where the current search or page excludes that row.
  const loadedSelectedTemplate = useMemo(
    () =>
      values.templateId
        ? (templateOptions.find((template) => template.id === values.templateId) ?? null)
        : null,
    [templateOptions, values.templateId]
  );
  const selectedTemplate = loadedSelectedTemplate ?? selectedTemplateSnapshot;

  // Retains the refreshed row, so a later search that drops it keeps planning
  // against the newest definition rather than the one picked earlier.
  useEffect(() => {
    if (!loadedSelectedTemplate) return;

    setSelectedTemplateSnapshot((previous) =>
      previous === loadedSelectedTemplate ? previous : loadedSelectedTemplate
    );
  }, [loadedSelectedTemplate]);

  const plannedQuantityLines = useMemo(
    () => getPlannedQuantityLines(selectedTemplate ?? undefined),
    [selectedTemplate]
  );
  const inputQuantityLines = useMemo(
    () => plannedQuantityLines.filter((line) => line.direction === "input"),
    [plannedQuantityLines]
  );
  const outputQuantityLines = useMemo(
    () => plannedQuantityLines.filter((line) => line.direction === "output"),
    [plannedQuantityLines]
  );
  // One plan feeds the read-only yield summary, the validation that gates the
  // POST, and the multiplier the POST carries, so the three can never disagree.
  const plannedQuantityPlan = useMemo(
    () => getPlannedQuantityPlan(plannedQuantityLines, plannedQuantityValues),
    [plannedQuantityLines, plannedQuantityValues]
  );
  const validPlan =
    plannedQuantityPlan && !("error" in plannedQuantityPlan) ? plannedQuantityPlan : null;
  const expectedOutputYield =
    validPlan && validPlan.outputYield.length > 0 ? validPlan.outputYield : null;
  const submittedMultiplier = validPlan ? Number(validPlan.multiplier) : null;

  const planErrorMessage = (error: PlannedQuantityPlanError) =>
    error === "wholeNumbersOnly"
      ? t("plannedQuantityWholeNumbersOnly")
      : t("plannedQuantityInvalidRatio");

  // The definition the planner is actually bound to: its line keys and base
  // quantities. A refetch that returns the same recipe under a new object, or
  // with only a changed usage count, leaves this unchanged, so the entered
  // amounts survive it.
  const plannedQuantityBasis = useMemo(
    () => plannedQuantityLines.map((line) => `${line.key}=${line.baseQuantity}`).join("|"),
    [plannedQuantityLines]
  );

  // A definition refreshed under the open form can change line quantities or
  // the line set itself. The entered quantities are re-checked against the new
  // basis, and an entry set it cannot accept is reported with the same
  // localized message the live editing path uses, which also clears the yield
  // and blocks the POST until the entries are valid again.
  useEffect(() => {
    setErrors((previous) => {
      const basisError =
        plannedQuantityPlan && "error" in plannedQuantityPlan
          ? planErrorMessage(plannedQuantityPlan.error)
          : undefined;

      return previous.plannedQuantity === basisError
        ? previous
        : { ...previous, plannedQuantity: basisError };
    });
    // Runs on a changed basis only. Live typing owns its own messages, so a
    // keystroke must not be re-reported here while the person is mid-entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plannedQuantityBasis]);

  const lineLabel = (line: PlannedQuantityLine) =>
    line.itemName && line.itemCode
      ? `${line.itemCode} — ${line.itemName}`
      : (line.itemName ?? line.itemCode ?? t("notAvailable"));

  const formatQuantity = (quantity: bigint) => Number(quantity).toLocaleString(locale);

  const validate = (): FormErrors => {
    const nextErrors: FormErrors = {};

    if (!values.templateId) nextErrors.templateId = t("templateRequired");
    if (!values.warehouseId) nextErrors.warehouseId = t("warehouseRequired");
    if (!values.orderDate) nextErrors.orderDate = t("orderDateRequired");

    if (plannedQuantityPlan && "error" in plannedQuantityPlan) {
      nextErrors.plannedQuantity = planErrorMessage(plannedQuantityPlan.error);
    } else if (!plannedQuantityPlan && values.templateId) {
      // A chosen template whose lines are missing leaves nothing to plan
      // against, so the form says so instead of posting an unscaled order.
      nextErrors.plannedQuantity = t("createOrderTemplateLinesRequired");
    } else if (
      submittedMultiplier !== null &&
      (!Number.isFinite(submittedMultiplier) || submittedMultiplier <= 0)
    ) {
      nextErrors.plannedQuantity = t("plannedQuantityGreaterThanZero");
    }

    return nextErrors;
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (createOrder.isPending) return;

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    // Validation above guarantees a plan, so the multiplier the POST carries is
    // always the one the live fields and the yield preview were just checked as.
    if (submittedMultiplier === null) return;

    try {
      await createOrder.mutateAsync({
        templateId: values.templateId,
        warehouseId: values.warehouseId,
        plannedQuantity: submittedMultiplier,
        orderDate: values.orderDate,
        plannedDate: values.plannedDate || undefined,
        notes: values.notes || undefined,
      });

      toast.success(t("orderCreatedSuccessfully"));
      router.push("/manufacturing/transformations");
    } catch (error) {
      const errorCode = getApiErrorCode(error, transformationOrderCreateErrorCodes);
      const errorMessages: Record<TransformationOrderCreateErrorCode, string> = {
        TRANSFORMATION_CONTEXT_INVALID: t("createOrderBusinessUnitUnavailable"),
        TRANSFORMATION_CREATE_FORBIDDEN: t("createOrderPermissionLost"),
        TRANSFORMATION_PLANNED_QUANTITY_INVALID: t("plannedQuantityGreaterThanZero"),
        TRANSFORMATION_PLANNED_QUANTITY_RATIO_INVALID: t("plannedQuantityInvalidRatio"),
        TRANSFORMATION_TEMPLATE_UNAVAILABLE: t("createOrderTemplateUnavailable"),
        TRANSFORMATION_WAREHOUSE_UNAVAILABLE: t("createOrderWarehouseUnavailable"),
        TRANSFORMATION_TEMPLATE_LINES_REQUIRED: t("createOrderTemplateLinesRequired"),
        TRANSFORMATION_TEMPLATE_ITEM_UNAVAILABLE: t("createOrderTemplateItemUnavailable"),
      };
      setErrors({
        root: errorCode ? errorMessages[errorCode] : t("failedCreateTransformationOrder"),
      });
    }
  };

  const onFieldChange = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined, root: undefined }));
  };

  const onTemplateChange = (templateId: string) => {
    // The combobox keeps the current selection visible even when it falls
    // outside the fetched page, so re-picking it must leave the entered
    // quantities alone rather than resetting the form.
    if (templateId === values.templateId) return;

    const template = templateOptions.find((entry) => entry.id === templateId) ?? null;
    const quantityLines = getPlannedQuantityLines(template ?? undefined);

    setSelectedTemplateSnapshot(template);
    setValues((previous) => ({
      ...previous,
      templateId: template ? templateId : "",
    }));
    setPlannedQuantityValues(
      Object.fromEntries(quantityLines.map((line) => [line.key, line.baseQuantity]))
    );
    const hasFractionalBaseQuantity = quantityLines.some(
      (line) => parsePositiveWholeQuantity(line.baseQuantity) === null
    );
    setErrors((previous) => ({
      ...previous,
      templateId: undefined,
      plannedQuantity: hasFractionalBaseQuantity ? t("plannedQuantityWholeNumbersOnly") : undefined,
      root: undefined,
    }));
  };

  const onPlannedQuantityChange = (changedLine: PlannedQuantityLine, value: string) => {
    setPlannedQuantityValues((previous) => ({
      ...previous,
      [changedLine.key]: value,
    }));
    setErrors((previous) => ({
      ...previous,
      plannedQuantity: undefined,
      root: undefined,
    }));

    if (value.trim() === "") return;

    const changedQuantity = parsePositiveWholeQuantity(value);
    if (changedQuantity === null) {
      setErrors((previous) => ({
        ...previous,
        plannedQuantity: t("plannedQuantityWholeNumbersOnly"),
      }));
      return;
    }

    const calculation = calculatePlannedQuantities(
      plannedQuantityLines,
      changedLine,
      changedQuantity
    );
    if (!calculation) {
      setErrors((previous) => ({
        ...previous,
        plannedQuantity: t("plannedQuantityInvalidRatio"),
      }));
      return;
    }

    // Only the line entries are stored. The multiplier is read back from them
    // through the plan, so it can never fall out of step with the ratio.
    setPlannedQuantityValues(
      Object.fromEntries(
        plannedQuantityLines.map((line, index) => [
          line.key,
          calculation.quantities[index].toString(),
        ])
      )
    );
  };

  const hasTemplateSearch = debouncedTemplateSearch.length > 0;

  const plannedQuantityErrorId = "planned-quantity-error";

  const plannedQuantityColumnId = "planned-quantity-column";

  const formatBaseQuantity = (baseQuantity: string) => {
    const value = Number(baseQuantity);
    return Number.isFinite(value) ? value.toLocaleString(locale) : baseQuantity;
  };

  // One table row group per direction. Every line shows the item it names, its
  // per-run template quantity, the planned quantity, and the unit, so an entry
  // is never made against a bare item code and any line count fits one table.
  // The group label takes the app's stock-out (consumed) or stock-in (produced)
  // hue, in shades dark enough for text.
  const quantityLineGroupTitleClass: Record<PlannedQuantityLine["direction"], string> = {
    input: "text-orange-700 dark:text-orange-400",
    output: "text-blue-700 dark:text-blue-400",
  };

  const quantityLineGroup = (
    lines: PlannedQuantityLine[],
    direction: PlannedQuantityLine["direction"],
    title: string
  ) => (
    <TableBody>
      <TableRow className="hover:bg-transparent">
        <TableHead scope="colgroup" colSpan={5} className="h-10 text-foreground">
          <span className={`font-semibold ${quantityLineGroupTitleClass[direction]}`}>{title}</span>{" "}
          <span className="font-normal text-muted-foreground">
            {t("plannedLineCount", { count: lines.length })}
          </span>
        </TableHead>
      </TableRow>
      {lines.map((line) => {
        const itemId = `${line.key}-item`;
        const unitId = `${line.key}-unit`;
        const describedBy = [
          line.uomLabel ? unitId : null,
          errors.plannedQuantity ? plannedQuantityErrorId : null,
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <TableRow key={line.key} className="hover:bg-transparent">
            <TableCell id={itemId} className="whitespace-nowrap py-2 font-medium">
              {line.itemCode || t("notAvailable")}
            </TableCell>
            <TableCell
              className="w-full max-w-0 truncate py-2 text-muted-foreground"
              title={line.itemName ?? undefined}
            >
              {line.itemName ?? t("dash")}
            </TableCell>
            <TableCell className="whitespace-nowrap py-2 text-right tabular-nums text-muted-foreground">
              {formatBaseQuantity(line.baseQuantity)}
            </TableCell>
            <TableCell className="py-2">
              <Input
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                value={plannedQuantityValues[line.key] ?? ""}
                // An emptied or still-unfinished entry keeps the shared Input's own
                // display state and never reaches `onChange`, which would leave the
                // previous yield on screen and submittable. `onInput` is forwarded
                // untouched, so the draft is captured here and `onChange` still owns
                // every completed numeric value.
                onInput={(event) => {
                  const draft = event.currentTarget.value;
                  if (!INCOMPLETE_QUANTITY.test(draft)) return;
                  onPlannedQuantityChange(line, draft);
                }}
                onChange={(event) => onPlannedQuantityChange(line, event.target.value)}
                aria-labelledby={`${plannedQuantityColumnId} ${itemId}`}
                aria-invalid={Boolean(errors.plannedQuantity)}
                aria-describedby={describedBy || undefined}
                className={`ml-auto w-28 text-right font-medium tabular-nums ${
                  errors.plannedQuantity ? "border-destructive" : ""
                }`}
              />
            </TableCell>
            <TableCell id={unitId} className="whitespace-nowrap py-2 text-muted-foreground">
              {line.uomLabel ?? ""}
            </TableCell>
          </TableRow>
        );
      })}
    </TableBody>
  );

  const expectedYieldAnnouncement = expectedOutputYield
    ? t("expectedYieldAnnouncement", {
        lines: new Intl.ListFormat(locale, { type: "conjunction" }).format(
          expectedOutputYield.map(({ line, quantity }) =>
            t("expectedYieldLine", {
              item: lineLabel(line),
              quantity: line.uomLabel
                ? t("expectedYieldQuantityWithUom", {
                    quantity: formatQuantity(quantity),
                    uom: line.uomLabel,
                  })
                : formatQuantity(quantity),
            })
          )
        ),
      })
    : "";

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("orderDetails")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-12">
            <div className="space-y-2 xl:col-span-4">
              <label htmlFor="transformation-template" className="text-sm font-medium">
                {t("transformationTemplate")} <span className="text-destructive">*</span>
              </label>
              <AsyncSearchCombobox
                triggerId="transformation-template"
                value={values.templateId}
                onValueChange={onTemplateChange}
                searchValue={templateSearch}
                onSearchValueChange={setTemplateSearch}
                options={templateOptions}
                selectedOption={selectedTemplate}
                getOptionValue={(template) => template.id}
                getOptionLabel={(template) =>
                  `${template.template_code} — ${template.template_name}`
                }
                getOptionSearchValue={(template) =>
                  `${template.template_code} ${template.template_name}`
                }
                placeholder={t("selectTemplate")}
                searchPlaceholder={t("searchTemplatesPlaceholder")}
                emptyMessage={
                  templatesError
                    ? t("templateListError")
                    : hasTemplateSearch
                      ? t("noMatchingTemplates")
                      : t("noActiveTemplates")
                }
                loadingMessage={t("loadingTemplates")}
                isLoading={(templatesFetching && !isFetchingNextPage) || searchIsSettling}
                invalid={Boolean(errors.templateId)}
                describedBy={errors.templateId ? "transformation-template-error" : undefined}
                pagination={{
                  hasMore: hasNextPage,
                  isFetchingMore: isFetchingNextPage,
                  // A pending request or a search still settling owns the next
                  // page, so scrolling cannot queue obsolete requests.
                  canFetchMore: !templatesFetching && !searchIsSettling,
                  // Only a failed next-page request turns the row into a retry.
                  // A failed first page leaves no rows and is reported by the
                  // empty state instead.
                  hasError: isFetchNextPageError,
                  onFetchMore: () => {
                    void fetchNextPage({ cancelRefetch: false });
                  },
                  loadMoreLabel: tCommon("loadMore"),
                  retryLabel: t("retryLoadingTemplates"),
                  loadingMoreLabel: t("loadingTemplates"),
                }}
                footer={
                  <div className="border-t p-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full justify-center text-xs font-normal text-muted-foreground"
                      asChild
                    >
                      <Link href="/manufacturing/transformations/templates">
                        {t("manageTemplates")}
                      </Link>
                    </Button>
                  </div>
                }
              />
              {errors.templateId && (
                <p
                  id="transformation-template-error"
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {errors.templateId}
                </p>
              )}
            </div>

            <div className="space-y-2 xl:col-span-3">
              <label htmlFor="transformation-warehouse" className="text-sm font-medium">
                {tCommon("warehouse")} <span className="text-destructive">*</span>
              </label>
              <WarehouseSelect
                triggerId="transformation-warehouse"
                scope="current_business_unit"
                value={values.warehouseId}
                onValueChange={(value) => onFieldChange("warehouseId", value)}
                invalid={Boolean(errors.warehouseId)}
                describedBy={errors.warehouseId ? "transformation-warehouse-error" : undefined}
                buttonClassName="w-full"
              />
              {errors.warehouseId && (
                <p
                  id="transformation-warehouse-error"
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {errors.warehouseId}
                </p>
              )}
            </div>

            <div className="space-y-2 xl:col-span-2">
              <label htmlFor="transformation-order-date" className="text-sm font-medium">
                {t("orderDate")} <span className="text-destructive">*</span>
              </label>
              <Input
                id="transformation-order-date"
                type="date"
                value={values.orderDate}
                onChange={(event) => onFieldChange("orderDate", event.target.value)}
                aria-invalid={Boolean(errors.orderDate)}
                aria-describedby={errors.orderDate ? "transformation-order-date-error" : undefined}
                className={errors.orderDate ? "border-destructive" : ""}
              />
              {errors.orderDate && (
                <p
                  id="transformation-order-date-error"
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {errors.orderDate}
                </p>
              )}
            </div>

            <div className="space-y-2 xl:col-span-3">
              <label htmlFor="transformation-planned-date" className="text-sm font-medium">
                {t("plannedExecutionDate")}
              </label>
              <Input
                id="transformation-planned-date"
                type="date"
                value={values.plannedDate}
                onChange={(event) => onFieldChange("plannedDate", event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="transformation-notes" className="text-sm font-medium">
              {tCommon("notes")}
            </label>
            <Textarea
              id="transformation-notes"
              placeholder={t("orderNotesPlaceholder")}
              rows={1}
              className="min-h-10 resize-y"
              value={values.notes}
              onChange={(event) => onFieldChange("notes", event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-4 space-y-0">
          <div className="space-y-1.5">
            <CardTitle>{t("plannedQuantity")}</CardTitle>
            {plannedQuantityLines.length > 0 && (
              <CardDescription>{t("plannedQuantityRatioHint")}</CardDescription>
            )}
          </div>
          {plannedQuantityLines.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {t("plannedScale")}{" "}
              <span className="font-semibold tabular-nums text-foreground">
                {validPlan
                  ? t("plannedScaleValue", {
                      multiplier: Number(validPlan.multiplier).toLocaleString(locale),
                    })
                  : t("dash")}
              </span>
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedTemplate ? (
            <div className="rounded-lg border border-dashed bg-muted/30 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                {t("selectTemplateForPlannedQuantities")}
              </p>
            </div>
          ) : plannedQuantityLines.length === 0 ? (
            // The chosen template carries no usable line, so there is nothing
            // to plan. The same message the API returns for it is shown here,
            // without asking the server again.
            <div className="rounded-lg border border-dashed bg-muted/30 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                {t("createOrderTemplateLinesRequired")}
              </p>
            </div>
          ) : (
            <>
              <Table containerClassName="rounded-md border">
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-10 whitespace-nowrap">{t("itemColumn")}</TableHead>
                    <TableHead className="h-10">{tCommon("description")}</TableHead>
                    <TableHead className="h-10 whitespace-nowrap text-right">
                      {t("perRunColumn")}
                    </TableHead>
                    <TableHead
                      id={plannedQuantityColumnId}
                      className="h-10 whitespace-nowrap text-right"
                    >
                      {t("plannedQuantityColumn")}
                    </TableHead>
                    <TableHead className="h-10 whitespace-nowrap">{t("unitColumn")}</TableHead>
                  </TableRow>
                </TableHeader>
                {inputQuantityLines.length > 0 &&
                  quantityLineGroup(inputQuantityLines, "input", t("inputMaterials"))}
                {outputQuantityLines.length > 0 &&
                  quantityLineGroup(outputQuantityLines, "output", t("outputProducts"))}
              </Table>

              {/* The output rows already show the yield. This announces it after
                  an edit re-scales the other lines, and stays empty whenever the
                  entries are invalid, the same condition that blocks the POST. */}
              <p role="status" aria-live="polite" className="sr-only">
                {expectedYieldAnnouncement}
              </p>
            </>
          )}

          {errors.plannedQuantity && (
            <p id={plannedQuantityErrorId} role="alert" className="text-sm text-destructive">
              {errors.plannedQuantity}
            </p>
          )}
        </CardContent>
      </Card>

      {errors.root && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <p role="alert" className="text-sm text-destructive">
            {errors.root}
          </p>
        </div>
      )}

      <div className="flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/manufacturing/transformations")}
        >
          {tCommon("cancel")}
        </Button>
        <Button type="submit" disabled={createOrder.isPending}>
          {createOrder.isPending ? t("creatingOrder") : t("createOrder")}
        </Button>
      </div>
    </form>
  );
}
