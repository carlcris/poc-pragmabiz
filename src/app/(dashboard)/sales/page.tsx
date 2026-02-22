"use client";

import Link from "next/link";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function SalesPage() {
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
      title: "Total Customers",
      value: totalCustomers,
      description: "Active customer accounts",
      icon: Users,
      iconColor: "text-blue-600",
    },
    {
      title: "Total Revenue",
      value: formatCurrency(totalRevenue),
      description: "This month",
      icon: DollarSign,
      iconColor: "text-green-600",
    },
    {
      title: "Outstanding Credit",
      value: formatCurrency(totalCredit),
      description: "Customer balances",
      icon: TrendingUp,
      iconColor: "text-orange-600",
    },
    {
      title: "Pending Orders",
      value: pendingOrders,
      description: "Awaiting fulfillment",
      icon: Package,
      iconColor: "text-purple-600",
    },
  ];

  const quickLinks = [
    {
      title: "Point of Sale",
      description: "Quick checkout for walk-in customers",
      href: "/sales/pos",
      icon: Laptop2,
    },
    {
      title: "Customers",
      description: "Manage customer accounts",
      href: "/sales/customers",
      icon: Users,
    },
    {
      title: "Quotations",
      description: "Create and manage quotations",
      href: "/sales/quotations",
      icon: FileText,
    },
    {
      title: "Sales Orders",
      description: "Process sales orders",
      href: "/sales/orders",
      icon: FileText,
    },
    {
      title: "Invoices",
      description: "Generate and track invoices",
      href: "/sales/invoices",
      icon: FileText,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Sales Management</h1>
        <p className="text-muted-foreground">Manage customers, orders, quotations, and invoices</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <Icon className={`h-4 w-4 ${stat.iconColor}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="mb-4 text-xl font-semibold">Quick Access</h2>
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
                      Go to {link.title}
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
