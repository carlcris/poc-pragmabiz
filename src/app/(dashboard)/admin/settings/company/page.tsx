"use client";

import { useTranslations } from "next-intl";
import { SettingsPageLayout } from "@/components/settings/SettingsPageLayout";
import { CompanySettingsForm } from "@/components/settings/forms/CompanySettingsForm";
import { GeneratedCodePaddingForm } from "@/components/settings/forms/GeneratedCodePaddingForm";
import { useSettings } from "@/hooks/settings/useSettings";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function CompanySettingsPage() {
  const t = useTranslations("adminSettings.pages");
  const { data: settings, isLoading, error } = useSettings("company");

  return (
    <SettingsPageLayout title={t("companyTitle")} description={t("companyDescription")}>
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t("errorTitle")}</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : t("companyLoadError")}
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <Skeleton className="h-5 w-48" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Skeleton className="h-10 w-full sm:w-48" />
                <Skeleton className="h-10 w-full sm:w-48" />
              </div>
            </CardContent>
          </Card>
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
      ) : settings ? (
        <>
          <GeneratedCodePaddingForm settings={settings} />
          <CompanySettingsForm initialData={settings} />
        </>
      ) : null}
    </SettingsPageLayout>
  );
}
