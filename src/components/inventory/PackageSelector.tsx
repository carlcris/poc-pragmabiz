"use client";

import { Input } from "@/components/ui/input";
import { FormLabel } from "@/components/ui/form";

type PackageSelectorProps = {
  itemId: string;
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  quantity?: number;
  label?: string;
  required?: boolean;
  disabled?: boolean;
};

export function PackageSelector({ label = "Unit", required = false }: PackageSelectorProps) {
  return (
    <div className="space-y-2">
      <FormLabel>
        {label}
        {required ? " *" : ""}
      </FormLabel>
      <Input value="Item UOM" disabled />
    </div>
  );
}

type CompactPackageSelectorProps = {
  itemId: string;
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  label?: string;
};

export function CompactPackageSelector({ label = "Unit" }: CompactPackageSelectorProps) {
  return (
    <div className="space-y-1">
      <FormLabel>{label}</FormLabel>
      <Input value="Item UOM" disabled />
    </div>
  );
}
