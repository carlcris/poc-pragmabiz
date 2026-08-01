"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ProtectedRoute } from "@/components/permissions/ProtectedRoute";
import { PageHeader } from "@/components/shared/PageHeader";
import { WarehouseFloorMapEditor } from "@/components/warehouses/WarehouseFloorMapEditor";
import { RESOURCES } from "@/constants/resources";
import { useCanEdit } from "@/hooks/usePermissions";

export default function WarehouseFloorMapPage() {
  const params = useParams<{ id: string }>();
  const t = useTranslations("warehouseFloorMap");
  const canEdit = useCanEdit(RESOURCES.MANAGE_LOCATIONS);

  return (
    <ProtectedRoute resource={RESOURCES.MANAGE_LOCATIONS}>
      <div className="space-y-6">
        <PageHeader title={t("title")} subtitle={t("subtitle")} />
        <WarehouseFloorMapEditor warehouseId={params.id} canEdit={canEdit} />
      </div>
    </ProtectedRoute>
  );
}
