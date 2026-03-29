"use client";

import { useTranslations } from "next-intl";
import { SettingsPageLayout } from "@/components/settings/SettingsPageLayout";
import { BusinessUnitSettingsForm } from "@/components/settings/forms/BusinessUnitSettingsForm";
import { useSettings } from "@/hooks/settings/useSettings";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function BusinessUnitSettingsPage() {
  const t = useTranslations("adminSettings.pages");
  const { currentBusinessUnit } = useBusinessUnitStore();
  const { data: settings, isLoading, error } = useSettings("business_unit");

  return (
    <SettingsPageLayout
      title={t("businessUnitTitle")}
      description={t("businessUnitDescription", {
        name: currentBusinessUnit?.name || t("yourBusinessUnit"),
      })}
    >
      {!currentBusinessUnit && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t("noBusinessUnitSelectedTitle")}</AlertTitle>
          <AlertDescription>
            {t("noBusinessUnitSelectedDescription")}
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t("errorTitle")}</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : t("businessUnitLoadError")}
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </CardContent>
          </Card>
        </div>
      ) : currentBusinessUnit ? (
        <BusinessUnitSettingsForm initialData={settings} />
      ) : null}
    </SettingsPageLayout>
  );
}
