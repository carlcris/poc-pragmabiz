"use client";

import { useLocale, useTranslations } from "next-intl";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { UserProfileForm } from "@/components/profile/UserProfileForm";
import { useUserProfile } from "@/hooks/useUserProfile";
import { formatLocalDateTime } from "@/lib/format-local-date-time";

export default function ProfilePage() {
  const t = useTranslations("profilePage");
  const locale = useLocale();
  const { data: profile, isLoading, isError } = useUserProfile();

  const accountFields = profile
    ? [
        { label: t("username"), value: profile.username },
        { label: t("email"), value: profile.email },
        { label: t("company"), value: profile.companyName || t("notAvailable") },
        { label: t("memberSince"), value: formatLocalDateTime(profile.createdAt, locale) },
        {
          label: t("lastLogin"),
          value: profile.lastLoginAt
            ? formatLocalDateTime(profile.lastLoginAt, locale)
            : t("notAvailable"),
        },
      ]
    : [];

  return (
    <div className="container mx-auto max-w-4xl p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="space-y-6">
        {isError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t("loadErrorTitle")}</AlertTitle>
            <AlertDescription>{t("loadError")}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{t("accountTitle")}</CardTitle>
            <CardDescription>{t("accountDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 md:grid-cols-2">
              {isLoading
                ? Array.from({ length: 5 }, (_, index) => (
                    <div key={index} className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-5 w-48" />
                    </div>
                  ))
                : accountFields.map((field) => (
                    <div key={field.label} className="space-y-1">
                      <dt className="text-sm text-muted-foreground">{field.label}</dt>
                      <dd className="break-words font-medium">{field.value}</dd>
                    </div>
                  ))}
            </dl>
          </CardContent>
        </Card>

        {profile ? (
          <UserProfileForm profile={profile} />
        ) : (
          isLoading && (
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          )
        )}

        <Card>
          <CardHeader>
            <CardTitle>{t("rolesTitle")}</CardTitle>
            <CardDescription>{t("rolesDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-5 w-56" />
                <Skeleton className="h-5 w-40" />
              </div>
            ) : profile && profile.roles.length > 0 ? (
              <ul className="divide-y">
                {profile.roles.map((role) => (
                  <li key={role.id} className="flex items-center justify-between gap-4 py-2">
                    <span className="font-medium">{role.roleName}</span>
                    <span className="text-sm text-muted-foreground">
                      {role.businessUnitName ?? t("allBusinessUnits")}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t("noRoles")}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
