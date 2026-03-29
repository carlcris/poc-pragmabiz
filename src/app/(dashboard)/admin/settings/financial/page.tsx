"use client";

import { useTranslations } from "next-intl";
import { SettingsPageLayout } from "@/components/settings/SettingsPageLayout";
import { FinancialSettingsForm } from "@/components/settings/forms/FinancialSettingsForm";
import { useSettings } from "@/hooks/settings/useSettings";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function FinancialSettingsPage() {
  const t = useTranslations("adminSettings.pages");
  const { data: settings, isLoading, error } = useSettings("financial");

  return (
    <SettingsPageLayout
      title={t("financialTitle")}
      description={t("financialDescription")}
    >
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t("errorTitle")}</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : t("financialLoadError")}
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
      ) : (
        <FinancialSettingsForm initialData={settings} />
      )}
    </SettingsPageLayout>
  );
}
