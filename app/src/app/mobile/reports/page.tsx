"use client";

import { MobileHeader } from "@/components/mobile/MobileHeader";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Package, ArrowRightLeft } from "lucide-react";
import Link from "next/link";

const reportSections = [
  {
    title: "Inventory Movement Summary",
    description: "Track stock transfers and movements",
    icon: ArrowRightLeft,
    href: "/mobile/reports/inventory-movement",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  {
    title: "Sales Summary",
    description: "View sales performance reports",
    icon: TrendingUp,
    href: "/mobile/reports/sales-summary",
    color: "text-green-600",
    bgColor: "bg-green-50",
  },
  {
    title: "Stock Levels",
    description: "Current inventory levels",
    icon: Package,
    href: "/mobile/reports/stock-levels",
    color: "text-purple-600",
    bgColor: "bg-purple-50",
  },
];

export default function MobileReportsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <MobileHeader title="Reports" showBack backHref="/mobile/more" />

      <div className="p-4 space-y-4">
        {reportSections.map((section) => {
          const Icon = section.icon;
          return (
            <Link key={section.href} href={section.href}>
              <Card className="hover:shadow-md transition-shadow active:scale-98 cursor-pointer">
                <CardHeader className="flex flex-row items-center space-y-0 pb-3">
                  <div className={`p-3 rounded-lg ${section.bgColor} mr-4`}>
                    <Icon className={`h-6 w-6 ${section.color}`} />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg">{section.title}</CardTitle>
                    <CardDescription className="text-sm mt-1">
                      {section.description}
                    </CardDescription>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
