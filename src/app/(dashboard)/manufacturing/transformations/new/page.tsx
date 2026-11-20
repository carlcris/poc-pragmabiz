"use client";

import { useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import { CreateGuard } from "@/components/permissions/PermissionGuard";
import { RESOURCES } from "@/constants/resources";
import { EmptyStatePanel } from "@/components/shared/EmptyStatePanel";
import { PageHeader } from "@/components/shared/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { TransformationOrderCreateForm } from "@/components/transformations/TransformationOrderCreateForm";
import { usePermissions } from "@/hooks/usePermissions";

export default function NewTransformationOrderPage() {
  const t = useTranslations("transformation");
  const { permissions, error } = usePermissions();

  // The store starts with permissions and error unset and isLoading false before
  // hydration, so the guard would read that gap as a denial. Treat it as pending
  // and keep the skeleton until permissions resolve or the load fails.
  const isPermissionPending = permissions === null && error === null;
  const permissionSkeleton = <Skeleton className="h-64 w-full" />;

  // The header stays put while the permission check resolves and when it
  // denies, so the page never swaps between different shells.
  return (
    <div className="space-y-6">
      <PageHeader title={t("newTransformation")} subtitle={t("createNewOrder")} />
      <CreateGuard
        resource={RESOURCES.STOCK_TRANSFORMATIONS}
        showLoading
        loadingFallback={permissionSkeleton}
        fallback={
          isPermissionPending ? (
            permissionSkeleton
          ) : (
            <EmptyStatePanel
              icon={Lock}
              title={t("createPermissionRequired")}
              description={t("createPermissionRequiredDescription")}
            />
          )
        }
      >
        <TransformationOrderCreateForm />
      </CreateGuard>
    </div>
  );
}
