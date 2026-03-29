"use client";

import { useTranslations } from "next-intl";
import { SettingsCard } from "@/components/settings/SettingsCard";
import {
  Building2,
  DollarSign,
  Package,
  ShoppingCart,
  GitBranch,
  Plug,
  Shield,
  Store,
} from "lucide-react";
import { RESOURCES } from "@/constants/resources";
import type { SettingsGroup } from "@/types/settings";

export default function SettingsPage() {
  const t = useTranslations("adminSettings.index");

  const settingsGroups: SettingsGroup[] = [
    {
      key: "company",
      title: t("companyTitle"),
      description: t("companyDescription"),
      icon: Building2,
      href: "/admin/settings/company",
      permission: RESOURCES.COMPANY_SETTINGS,
    },
    {
      key: "business_unit",
      title: t("businessUnitTitle"),
      description: t("businessUnitDescription"),
      icon: Store,
      href: "/admin/settings/business-unit",
      permission: RESOURCES.COMPANY_SETTINGS,
    },
    {
      key: "financial",
      title: t("financialTitle"),
      description: t("financialDescription"),
      icon: DollarSign,
      href: "/admin/settings/financial",
      permission: RESOURCES.COMPANY_SETTINGS,
    },
    {
      key: "inventory",
      title: t("inventoryTitle"),
      description: t("inventoryDescription"),
      icon: Package,
      href: "/admin/settings/inventory",
      permission: RESOURCES.COMPANY_SETTINGS,
    },
    {
      key: "pos",
      title: t("posTitle"),
      description: t("posDescription"),
      icon: ShoppingCart,
      href: "/admin/settings/pos",
      permission: RESOURCES.COMPANY_SETTINGS,
    },
    {
      key: "workflow",
      title: t("workflowTitle"),
      description: t("workflowDescription"),
      icon: GitBranch,
      href: "/admin/settings/workflow",
      permission: RESOURCES.COMPANY_SETTINGS,
    },
    {
      key: "integration",
      title: t("integrationTitle"),
      description: t("integrationDescription"),
      icon: Plug,
      href: "/admin/settings/integration",
      permission: RESOURCES.COMPANY_SETTINGS,
    },
    {
      key: "security",
      title: t("securityTitle"),
      description: t("securityDescription"),
      icon: Shield,
      href: "/admin/settings/security",
      permission: RESOURCES.COMPANY_SETTINGS,
    },
  ];

  return (
    <div className="container mx-auto max-w-6xl p-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      {/* Settings Cards Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {settingsGroups.map((group) => (
          <SettingsCard
            key={group.key}
            title={group.title}
            description={group.description}
            icon={group.icon}
            href={group.href}
          />
        ))}
      </div>
    </div>
  );
}
