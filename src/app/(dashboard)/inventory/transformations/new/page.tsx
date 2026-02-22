"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useAuthStore } from "@/stores/authStore";
import { useCreateTransformationOrder } from "@/hooks/useTransformationOrders";
import { useTransformationTemplates } from "@/hooks/useTransformationTemplates";
import { useWarehouses } from "@/hooks/useWarehouses";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

export default function NewTransformationOrderPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { t } = useLanguage();
  const companyId = user?.companyId;

  const createOrder = useCreateTransformationOrder();

  const { data: templatesData } = useTransformationTemplates({
    isActive: true,
    limit: 50,
  });

  const { data: warehousesData } = useWarehouses({ limit: 50 });

  const [values, setValues] = useState<FormValues>({
    templateId: "",
    warehouseId: "",
    plannedQuantity: "1",
    orderDate: toDateInputValue(new Date()),
    plannedDate: "",
    notes: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const plannedQuantityNumber = useMemo(() => Number(values.plannedQuantity), [values.plannedQuantity]);

  const validate = (): FormErrors => {
    const nextErrors: FormErrors = {};

    if (!values.templateId) nextErrors.templateId = "Template is required";
    if (!values.warehouseId) nextErrors.warehouseId = "Warehouse is required";
    if (!values.orderDate) nextErrors.orderDate = "Order date is required";
    if (!Number.isFinite(plannedQuantityNumber) || plannedQuantityNumber <= 0) {
      nextErrors.plannedQuantity = "Planned quantity must be greater than 0";
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

    if (!companyId) {
      setErrors({ root: "Company ID is missing. Please try logging in again." });
      return;
    }

    try {
      await createOrder.mutateAsync({
        companyId,
        templateId: values.templateId,
        warehouseId: values.warehouseId,
        plannedQuantity: plannedQuantityNumber,
        orderDate: new Date(`${values.orderDate}T00:00:00`).toISOString(),
        plannedDate: values.plannedDate
          ? new Date(`${values.plannedDate}T00:00:00`).toISOString()
          : undefined,
        notes: values.notes || undefined,
      });

      router.push("/inventory/transformations");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create transformation order";
      setErrors({ root: message });
    }
  };

  const onFieldChange = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined, root: undefined }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/inventory/transformations">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{t.transformation.newTransformation}</h1>
          <p className="text-muted-foreground">{t.transformation.createNewOrder}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.transformation.orderDetails}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t.transformation.transformationTemplate} *</label>
              <Select value={values.templateId} onValueChange={(value) => onFieldChange("templateId", value)}>
                <SelectTrigger>
                  <SelectValue placeholder={t.transformation.selectTemplate} />
                </SelectTrigger>
                <SelectContent>
                  {templatesData?.data.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.template_code} - {template.template_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.templateId && <p className="text-sm text-red-500">{errors.templateId}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t.common.warehouse} *</label>
              <Select value={values.warehouseId} onValueChange={(value) => onFieldChange("warehouseId", value)}>
                <SelectTrigger>
                  <SelectValue placeholder={t.transformation.selectWarehouse} />
                </SelectTrigger>
                <SelectContent>
                  {warehousesData?.data.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.code} - {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.warehouseId && <p className="text-sm text-red-500">{errors.warehouseId}</p>}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t.transformation.plannedQuantity} *</label>
                <Input
                  type="number"
                  step="0.0001"
                  value={values.plannedQuantity}
                  onChange={(event) => onFieldChange("plannedQuantity", event.target.value)}
                />
                {errors.plannedQuantity && <p className="text-sm text-red-500">{errors.plannedQuantity}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t.transformation.orderDate} *</label>
                <Input
                  type="date"
                  value={values.orderDate}
                  onChange={(event) => onFieldChange("orderDate", event.target.value)}
                />
                {errors.orderDate && <p className="text-sm text-red-500">{errors.orderDate}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t.transformation.plannedExecutionDate}</label>
                <Input
                  type="date"
                  value={values.plannedDate}
                  onChange={(event) => onFieldChange("plannedDate", event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t.common.notes}</label>
              <Textarea
                placeholder={`${t.common.notes}...`}
                rows={3}
                value={values.notes}
                onChange={(event) => onFieldChange("notes", event.target.value)}
              />
            </div>

            {errors.root && <p className="text-sm text-red-500">{errors.root}</p>}

            <div className="flex justify-end gap-4">
              <Button type="button" variant="outline" onClick={() => router.push("/inventory/transformations")}>
                {t.common.cancel}
              </Button>
              <Button type="submit" disabled={createOrder.isPending}>
                {createOrder.isPending ? `${t.common.create}...` : t.transformation.createFromTemplate}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
