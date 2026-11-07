"use client";

import { useTranslations } from "next-intl";
import { WarehouseLocationSelect } from "./WarehouseLocationSelect";
import { Label } from "@/components/ui/label";

type PickAllocationScopeProps = {
  warehouseId: string;
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
};

export function PickAllocationScope({
  warehouseId,
  value,
  onValueChange,
  disabled,
}: PickAllocationScopeProps) {
  const t = useTranslations("pickAllocationScope");
  return (
    <div className="space-y-2">
      <Label>{t("title")}</Label>
      <WarehouseLocationSelect
        warehouseId={warehouseId}
        value={value}
        onValueChange={onValueChange}
        allowNone
        disabled={disabled}
      />
      <p className="text-sm text-muted-foreground">{t("description")}</p>
    </div>
  );
}
