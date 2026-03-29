"use client";

import { useTranslations } from "next-intl";
import { SettingsPageLayout } from "@/components/settings/SettingsPageLayout";
import { WorkflowSettingsForm } from "@/components/settings/forms/WorkflowSettingsForm";
import { useSettings } from "@/hooks/settings/useSettings";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function WorkflowSettingsPage() {
  const t = useTranslations("adminSettings.pages");
  const { data: settings, isLoading, error } = useSettings("workflow");

  return (
    <SettingsPageLayout
      title={t("workflowTitle")}
      description={t("workflowDescription")}
    >
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t("errorTitle")}</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : t("workflowLoadError")}
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
        <WorkflowSettingsForm initialData={settings} />
      )}
    </SettingsPageLayout>
  );
}
