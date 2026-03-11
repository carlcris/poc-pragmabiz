"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Users,
  FileText,
  DollarSign,
  TrendingUp,
  ArrowRight,
  Package,
  Laptop2,
} from "lucide-react";
import { useCustomers } from "@/hooks/useCustomers";
import { useCurrency } from "@/hooks/useCurrency";
import { MetricCard } from "@/components/shared/MetricCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function SalesPage() {
  const t = useTranslations("salesPage");
  const { data } = useCustomers({ limit: 50 });
  const { formatCurrency } = useCurrency();
  const customers = data?.data || [];

  // Calculate statistics
  const totalCustomers = customers.filter((c) => c.isActive).length;
  const totalRevenue = 0; // Placeholder - needs actual sales data
  const totalCredit = customers
    .filter((c) => c.isActive)
    .reduce((sum, c) => sum + c.currentBalance, 0);
  const pendingOrders = 0; // Placeholder - needs actual orders data

  const stats = [
    {
      title: t("totalCustomers"),
      value: totalCustomers,
      description: t("totalCustomersDescription"),
      icon: Users,
      iconColor: "text-blue-600",
    },
    {
      title: t("totalRevenue"),
      value: formatCurrency(totalRevenue),
      description: t("totalRevenueDescription"),
      icon: DollarSign,
      iconColor: "text-green-600",
    },
    {
      title: t("outstandingCredit"),
      value: formatCurrency(totalCredit),
      description: t("outstandingCreditDescription"),
      icon: TrendingUp,
      iconColor: "text-orange-600",
    },
    {
      title: t("pendingOrders"),
      value: pendingOrders,
      description: t("pendingOrdersDescription"),
      icon: Package,
      iconColor: "text-purple-600",
    },
  ];

  const quickLinks = [
    {
      title: t("pointOfSale"),
      description: t("pointOfSaleDescription"),
      href: "/sales/pos",
      icon: Laptop2,
    },
    {
      title: t("customers"),
      description: t("customersDescription"),
      href: "/sales/customers",
      icon: Users,
    },
    {
      title: t("quotations"),
      description: t("quotationsDescription"),
      href: "/sales/quotations",
      icon: FileText,
    },
    {
      title: t("salesOrders"),
      description: t("salesOrdersDescription"),
      href: "/sales/orders",
      icon: FileText,
    },
    {
      title: t("invoices"),
      description: t("invoicesDescription"),
      href: "/sales/invoices",
      icon: FileText,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <MetricCard
              key={stat.title}
              title={stat.title}
              icon={Icon}
              iconClassName={`h-4 w-4 ${stat.iconColor}`}
              value={String(stat.value)}
              caption={stat.description}
            />
          );
        })}
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="mb-4 text-xl font-semibold">{t("quickAccess")}</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Card key={link.title} className="cursor-pointer transition-shadow hover:shadow-md">
                <Link href={link.href}>
                  <CardHeader>
                    <Icon className="h-8 w-8 text-primary" />
                    <CardTitle className="mt-4">{link.title}</CardTitle>
                    <CardDescription>{link.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="ghost" className="w-full justify-between">
                      {t("goTo")} {link.title}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Link>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
