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

const toDateInputValue = (value: Date) => {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const transformationOrderCreateErrorCodes = [
  "TRANSFORMATION_CONTEXT_INVALID",
  "TRANSFORMATION_CREATE_FORBIDDEN",
  "TRANSFORMATION_PLANNED_QUANTITY_INVALID",
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
  const [errors, setErrors] = useState<FormErrors>({});
  const plannedQuantityNumber = useMemo(
    () => Number(values.plannedQuantity),
    [values.plannedQuantity]
  );

  const validate = (): FormErrors => {
    const nextErrors: FormErrors = {};

    if (!values.templateId) nextErrors.templateId = t("templateRequired");
    if (!values.warehouseId) nextErrors.warehouseId = t("warehouseRequired");
    if (!values.orderDate) nextErrors.orderDate = t("orderDateRequired");
    if (!Number.isFinite(plannedQuantityNumber) || plannedQuantityNumber <= 0) {
      nextErrors.plannedQuantity = t("plannedQuantityGreaterThanZero");
    }

    return nextErrors;
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
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

  return (
    <div className="space-y-6">
      <PageHeader title={t("newTransformation")} subtitle={t("createNewOrder")} />

      <Card>
        <CardHeader>
          <CardTitle>{t("orderDetails")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("transformationTemplate")} *</label>
              {templatesLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select
                  value={values.templateId}
                  onValueChange={(value) => onFieldChange("templateId", value)}
                >
                  <SelectTrigger>
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
              {errors.templateId && <p className="text-sm text-red-500">{errors.templateId}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{tCommon("warehouse")} *</label>
              {warehousesLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select
                  value={values.warehouseId}
                  onValueChange={(value) => onFieldChange("warehouseId", value)}
                >
                  <SelectTrigger>
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
              {errors.warehouseId && <p className="text-sm text-red-500">{errors.warehouseId}</p>}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("plannedQuantity")} *</label>
                <Input
                  type="number"
                  step="0.0001"
                  value={values.plannedQuantity}
                  onChange={(event) => onFieldChange("plannedQuantity", event.target.value)}
                />
                {errors.plannedQuantity && (
                  <p className="text-sm text-red-500">{errors.plannedQuantity}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t("orderDate")} *</label>
                <Input
                  type="date"
                  value={values.orderDate}
                  onChange={(event) => onFieldChange("orderDate", event.target.value)}
                />
                {errors.orderDate && <p className="text-sm text-red-500">{errors.orderDate}</p>}
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

            <div className="space-y-2">
              <label className="text-sm font-medium">{tCommon("notes")}</label>
              <Textarea
                placeholder={`${tCommon("notes")}...`}
                rows={3}
                value={values.notes}
                onChange={(event) => onFieldChange("notes", event.target.value)}
              />
            </div>

            {errors.root && (
              <p role="alert" className="text-sm text-red-500">
                {errors.root}
              </p>
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
        </CardContent>
      </Card>
    </div>
  );
}
