"use client";

import { useTranslations } from "next-intl";
import { FontSizeSettings } from "@/components/settings/FontSizeSettings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  const t = useTranslations("preferencesPage");

  return (
    <div className="container mx-auto max-w-4xl p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="space-y-6">
        {/* Display Settings */}
        <Card>
          <CardHeader>
            <CardTitle>{t("displayTitle")}</CardTitle>
            <CardDescription>{t("displayDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <FontSizeSettings />
          </CardContent>
        </Card>

        {/* Future settings sections can be added here */}
        {/* Example:
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>
              Manage your notification preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NotificationSettings />
          </CardContent>
        </Card>
        */}
      </div>
    </div>
  );
}
