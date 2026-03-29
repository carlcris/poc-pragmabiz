"use client";

import { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface SettingsPageLayoutProps {
  title: string;
  description: string;
  children: ReactNode;
  backHref?: string;
}

export function SettingsPageLayout({
  title,
  description,
  children,
  backHref = "/admin/settings",
}: SettingsPageLayoutProps) {
  const t = useTranslations("adminSettings.layout");

  return (
    <div className="container mx-auto max-w-4xl p-6">
      {/* Back Button */}
      <div className="mb-6">
        <Link href={backHref}>
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {t("backToSettings")}
          </Button>
        </Link>
      </div>

      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-muted-foreground">{description}</p>
      </div>

      {/* Content */}
      <div className="space-y-6">{children}</div>
    </div>
  );
}
