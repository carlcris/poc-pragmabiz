"use client";

import { useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ProtectedRoute } from "@/components/permissions/ProtectedRoute";
import { PageHeader } from "@/components/shared/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { WarehouseFloorMapEditor } from "@/components/warehouses/WarehouseFloorMapEditor";
import { GRANULAR_CAPABILITIES } from "@/constants/granular-permissions";
import { RESOURCES } from "@/constants/resources";
import { useGranularCapabilities } from "@/hooks/useGranularCapabilities";
import { useCanEdit } from "@/hooks/usePermissions";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";

export default function WarehouseFloorMapPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations("warehouseFloorMap");
  const currentBusinessUnitId = useBusinessUnitStore(
    (state) => state.currentBusinessUnit?.id ?? null
  );
  const routeBusinessUnitIdRef = useRef<string | null>(null);
  if (!routeBusinessUnitIdRef.current && currentBusinessUnitId) {
    routeBusinessUnitIdRef.current = currentBusinessUnitId;
  }
  const hasBusinessUnitChanged = Boolean(
    routeBusinessUnitIdRef.current &&
    currentBusinessUnitId &&
    routeBusinessUnitIdRef.current !== currentBusinessUnitId
  );
  const canEditWarehouses = useCanEdit(RESOURCES.WAREHOUSES);
  const floorMapCapability = GRANULAR_CAPABILITIES.WAREHOUSE_FLOOR_MAP_MANAGE;
  const { data: capabilities = {}, isLoading: isCapabilityLoading } = useGranularCapabilities(
    [floorMapCapability],
    "edit"
  );
  const canEdit = canEditWarehouses && capabilities[floorMapCapability] === true;

  useEffect(() => {
    if (hasBusinessUnitChanged) {
      router.replace("/inventory/warehouses");
    }
  }, [hasBusinessUnitChanged, router]);

  if (hasBusinessUnitChanged || !currentBusinessUnitId) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("title")} subtitle={t("subtitle")} />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <ProtectedRoute resource={RESOURCES.WAREHOUSES}>
      <div className="space-y-6">
        <PageHeader title={t("title")} subtitle={t("subtitle")} />
        {isCapabilityLoading ? (
          <Skeleton className="h-96 w-full" />
        ) : (
          <WarehouseFloorMapEditor
            businessUnitId={currentBusinessUnitId}
            warehouseId={params.id}
            canEdit={canEdit}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}
