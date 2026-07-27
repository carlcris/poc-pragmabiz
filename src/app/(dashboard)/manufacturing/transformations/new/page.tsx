"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useCreateTransformationOrder } from "@/hooks/useTransformationOrders";
import { useTransformationTemplates } from "@/hooks/useTransformationTemplates";
import { useWarehouses } from "@/hooks/useWarehouses";
import { getApiErrorCode } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TransformationOrderCreateErrorCode } from "@/types/transformation-order";
import type { TransformationTemplateListItemApi } from "@/types/transformation-template";

type FormValues = {
  templateId: string;
  warehouseId: string;
  plannedQuantity: string;
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

type PlannedQuantityLine = {
  key: string;
  direction: "input" | "output";
  itemCode?: string | null;
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

const getPlannedQuantityLines = (
  template?: TransformationTemplateListItemApi
): PlannedQuantityLine[] => {
  if (!template) return [];

  const inputs = [...(template.inputs ?? [])]
    .sort((left, right) => (left.sequence ?? 1) - (right.sequence ?? 1))
    .map((input) => ({
      key: `input:${input.id}`,
      direction: "input" as const,
      itemCode: input.items?.item_code,
      baseQuantity: String(input.quantity),
    }));

  const primaryOutputs = [...(template.outputs ?? [])]
    .sort((left, right) => (left.sequence ?? 1) - (right.sequence ?? 1))
    .map((output) => ({
      key: `primary-output:${output.id}`,
      direction: "output" as const,
      itemCode: output.items?.item_code,
      baseQuantity: String(output.quantity),
    }));

  const additionalOutputs = [...(template.additional_outputs ?? [])]
    .sort((left, right) => left.sequence - right.sequence)
    .map((output) => ({
      key: `additional-output:${output.id}`,
      direction: "output" as const,
      itemCode: output.items?.item_code,
      baseQuantity: String(output.quantity),
    }));

  return [...inputs, ...primaryOutputs, ...additionalOutputs];
};

const getPlannedQuantityValidationError = (
  lines: PlannedQuantityLine[],
  quantityValues: Record<string, string>
): "wholeNumbersOnly" | "invalidRatio" | null => {
  if (lines.length === 0) return null;

  const quantities = lines.map((line) => parsePositiveWholeQuantity(quantityValues[line.key]));
  if (quantities.some((quantity) => quantity === null)) return "wholeNumbersOnly";

  const referenceQuantity = quantities[0];
  if (referenceQuantity === null) return "wholeNumbersOnly";

  const calculation = calculatePlannedQuantities(lines, lines[0], referenceQuantity);
  const hasInvalidRatio =
    !calculation ||
    calculation.quantities.some((quantity, index) => quantity !== quantities[index]);

  return hasInvalidRatio ? "invalidRatio" : null;
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

export default function NewTransformationOrderPage() {
  const router = useRouter();
  const t = useTranslations("transformation");
  const tCommon = useTranslations("common");

  const createOrder = useCreateTransformationOrder();

  const { data: templatesData, isLoading: templatesLoading } = useTransformationTemplates({
    isActive: true,
    limit: 50,
  });

  const { data: warehousesData, isLoading: warehousesLoading } = useWarehouses({ limit: 50 });

  const [values, setValues] = useState<FormValues>({
    templateId: "",
    warehouseId: "",
    plannedQuantity: "1",
    orderDate: toDateInputValue(new Date()),
    plannedDate: "",
    notes: "",
  });
  const [plannedQuantityValues, setPlannedQuantityValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<FormErrors>({});
  const plannedQuantityNumber = useMemo(
    () => Number(values.plannedQuantity),
    [values.plannedQuantity]
  );
  const selectedTemplate = useMemo(
    () => templatesData?.data.find((template) => template.id === values.templateId),
    [templatesData?.data, values.templateId]
  );
  const plannedQuantityLines = useMemo(
    () => getPlannedQuantityLines(selectedTemplate),
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

  const validate = (): FormErrors => {
    const nextErrors: FormErrors = {};

    if (!values.templateId) nextErrors.templateId = t("templateRequired");
    if (!values.warehouseId) nextErrors.warehouseId = t("warehouseRequired");
    if (!values.orderDate) nextErrors.orderDate = t("orderDateRequired");
    if (!Number.isFinite(plannedQuantityNumber) || plannedQuantityNumber <= 0) {
      nextErrors.plannedQuantity = t("plannedQuantityGreaterThanZero");
    }
    const quantityValidationError = getPlannedQuantityValidationError(
      plannedQuantityLines,
      plannedQuantityValues
    );
    if (quantityValidationError === "wholeNumbersOnly") {
      nextErrors.plannedQuantity = t("plannedQuantityWholeNumbersOnly");
    } else if (quantityValidationError === "invalidRatio") {
      nextErrors.plannedQuantity = t("plannedQuantityInvalidRatio");
    }

    return nextErrors;
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      await createOrder.mutateAsync({
        templateId: values.templateId,
        warehouseId: values.warehouseId,
        plannedQuantity: plannedQuantityNumber,
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
    const template = templatesData?.data.find((entry) => entry.id === templateId);
    const quantityLines = getPlannedQuantityLines(template);

    setValues((previous) => ({
      ...previous,
      templateId,
      plannedQuantity: "1",
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

    setValues((previous) => ({
      ...previous,
      plannedQuantity: calculation.scale,
    }));
    setPlannedQuantityValues(
      Object.fromEntries(
        plannedQuantityLines.map((line, index) => [
          line.key,
          calculation.quantities[index].toString(),
        ])
      )
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("newTransformation")} subtitle={t("createNewOrder")} />

      <form onSubmit={onSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("orderDetails")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {t("transformationTemplate")} <span className="text-destructive">*</span>
                </label>
                {templatesLoading ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Select value={values.templateId} onValueChange={onTemplateChange}>
                    <SelectTrigger className={errors.templateId ? "border-destructive" : ""}>
                      <SelectValue placeholder={t("selectTemplate")} />
                    </SelectTrigger>
                    <SelectContent>
                      {templatesData?.data.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.template_code} - {template.template_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {errors.templateId && <p className="text-sm text-destructive">{errors.templateId}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {tCommon("warehouse")} <span className="text-destructive">*</span>
                </label>
                {warehousesLoading ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Select
                    value={values.warehouseId}
                    onValueChange={(value) => onFieldChange("warehouseId", value)}
                  >
                    <SelectTrigger className={errors.warehouseId ? "border-destructive" : ""}>
                      <SelectValue placeholder={t("selectWarehouse")} />
                    </SelectTrigger>
                    <SelectContent>
                      {warehousesData?.data.map((warehouse) => (
                        <SelectItem key={warehouse.id} value={warehouse.id}>
                          {warehouse.code} - {warehouse.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {errors.warehouseId && (
                  <p className="text-sm text-destructive">{errors.warehouseId}</p>
                )}
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {t("orderDate")} <span className="text-destructive">*</span>
                </label>
                <Input
                  type="date"
                  value={values.orderDate}
                  onChange={(event) => onFieldChange("orderDate", event.target.value)}
                  className={errors.orderDate ? "border-destructive" : ""}
                />
                {errors.orderDate && <p className="text-sm text-destructive">{errors.orderDate}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t("plannedExecutionDate")}</label>
                <Input
                  type="date"
                  value={values.plannedDate}
                  onChange={(event) => onFieldChange("plannedDate", event.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {t("plannedQuantity")} <span className="text-destructive">*</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("plannedQuantityRatioHint")}</p>

            {!selectedTemplate ? (
              <div className="rounded-lg border border-dashed bg-muted/30 p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  {t("selectTemplateForPlannedQuantities")}
                </p>
              </div>
            ) : (
              <>
                {inputQuantityLines.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1 w-1 rounded-full bg-blue-500" />
                      <p className="text-sm font-semibold text-foreground">{t("inputMaterials")}</p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {inputQuantityLines.map((line) => (
                        <div key={line.key} className="space-y-2">
                          <label htmlFor={line.key} className="text-sm font-medium">
                            {line.itemCode || t("notAvailable")}
                          </label>
                          <Input
                            id={line.key}
                            type="number"
                            min="1"
                            step="1"
                            value={plannedQuantityValues[line.key] ?? ""}
                            onChange={(event) =>
                              onPlannedQuantityChange(line, event.target.value)
                            }
                            className="font-medium"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {outputQuantityLines.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1 w-1 rounded-full bg-green-500" />
                      <p className="text-sm font-semibold text-foreground">{t("outputProducts")}</p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {outputQuantityLines.map((line) => (
                        <div key={line.key} className="space-y-2">
                          <label htmlFor={line.key} className="text-sm font-medium">
                            {line.itemCode || t("notAvailable")}
                          </label>
                          <Input
                            id={line.key}
                            type="number"
                            min="1"
                            step="1"
                            value={plannedQuantityValues[line.key] ?? ""}
                            onChange={(event) =>
                              onPlannedQuantityChange(line, event.target.value)
                            }
                            className="font-medium"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {errors.plannedQuantity && (
              <p role="alert" className="text-sm text-destructive">
                {errors.plannedQuantity}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tCommon("notes")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder={`${tCommon("notes")}...`}
              rows={4}
              value={values.notes}
              onChange={(event) => onFieldChange("notes", event.target.value)}
            />
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
            {createOrder.isPending ? `${tCommon("create")}...` : t("createFromTemplate")}
          </Button>
        </div>
      </form>
    </div>
  );
}
