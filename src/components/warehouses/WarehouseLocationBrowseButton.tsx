"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ListTree } from "lucide-react";
import { WarehouseLocationTree } from "@/components/warehouses/WarehouseLocationTree";
import { useWarehouseLocationTreeExpansion } from "@/hooks/useWarehouseLocationTreeExpansion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type WarehouseLocationBrowseButtonProps = {
  warehouseId: string;
  warehouseLabel: string;
  value: string;
  disabledId?: string;
  onPick: (locationId: string) => void;
};

// Lets location fields be filled by walking the structure tree instead of searching.
export function WarehouseLocationBrowseButton({
  warehouseId,
  warehouseLabel,
  value,
  disabledId,
  onPick,
}: WarehouseLocationBrowseButtonProps) {
  const t = useTranslations("warehouseLocationsPage");
  const [open, setOpen] = useState(false);
  const treeExpansion = useWarehouseLocationTreeExpansion();

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <ListTree className="mr-2 h-4 w-4" />
        {t("browse")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-dvh overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("browseTitle")}</DialogTitle>
            <DialogDescription>{t("browseDescription")}</DialogDescription>
          </DialogHeader>
          <WarehouseLocationTree
            warehouseId={warehouseId}
            warehouseLabel={warehouseLabel}
            selectedId={value || null}
            expansion={treeExpansion}
            disabledId={disabledId}
            onSelect={(locationId) => {
              onPick(locationId ?? "");
              setOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
