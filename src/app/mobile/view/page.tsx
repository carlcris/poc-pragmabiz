"use client";

import { MobileHeader } from "@/components/mobile/MobileHeader";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Users, Package, DollarSign } from "lucide-react";
import Link from "next/link";

const viewSections = [
  {
    title: "Invoices",
    description: "View sales invoices",
    icon: FileText,
    href: "/mobile/view/invoices",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  {
    title: "Customers",
    description: "View customer list",
    icon: Users,
    href: "/mobile/view/customers",
    color: "text-green-600",
    bgColor: "bg-green-50",
  },
  {
    title: "Loaded Items",
    description: "View loaded stock items",
    icon: Package,
    href: "/mobile/view/loaded-items",
    color: "text-purple-600",
    bgColor: "bg-purple-50",
  },
  {
    title: "Commissions",
    description: "View commission details",
    icon: DollarSign,
    href: "/mobile/view/commissions",
    color: "text-orange-600",
    bgColor: "bg-orange-50",
  },
];

export default function MobileViewPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <MobileHeader title="View" />

      <div className="space-y-4 p-4">
        {viewSections.map((section) => {
          const Icon = section.icon;
          return (
            <Link key={section.href} href={section.href}>
              <Card className="active:scale-98 cursor-pointer transition-shadow hover:shadow-md">
                <CardHeader className="flex flex-row items-center space-y-0 pb-3">
                  <div className={`rounded-lg p-3 ${section.bgColor} mr-4`}>
                    <Icon className={`h-6 w-6 ${section.color}`} />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg">{section.title}</CardTitle>
                    <CardDescription className="mt-1 text-sm">
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
