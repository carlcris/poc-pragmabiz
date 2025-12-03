"use client";

import { MobileHeader } from "@/components/mobile/MobileHeader";
import { Card } from "@/components/ui/card";
import { useUserVanWarehouse } from "@/hooks/useVanWarehouse";
import {
  FileText,
  Users,
  Package,
  DollarSign,
  Settings,
  BarChart3,
  TruckIcon,
  ClipboardList,
  UserCircle,
  Building2,
  Calendar,
  Bell,
} from "lucide-react";
import Link from "next/link";

interface FeatureItem {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  color: string;
  bgColor: string;
}

const features: FeatureItem[] = [
  {
    title: "Invoices",
    icon: FileText,
    href: "/mobile/view/invoices",
    color: "text-blue-600",
    bgColor: "bg-blue-100",
  },
  {
    title: "Customers",
    icon: Users,
    href: "/mobile/view/customers",
    color: "text-green-600",
    bgColor: "bg-green-100",
  },
  {
    title: "Items",
    icon: Package,
    href: "/mobile/view/loaded-items",
    color: "text-purple-600",
    bgColor: "bg-purple-100",
  },
  {
    title: "Commissions",
    icon: DollarSign,
    href: "/mobile/view/commissions",
    color: "text-orange-600",
    bgColor: "bg-orange-100",
  },
  {
    title: "Reports",
    icon: BarChart3,
    href: "/mobile/reports",
    color: "text-indigo-600",
    bgColor: "bg-indigo-100",
  },
  {
    title: "Van Info",
    icon: TruckIcon,
    href: "/mobile/van-info",
    color: "text-cyan-600",
    bgColor: "bg-cyan-100",
  },
  {
    title: "Profile",
    icon: UserCircle,
    href: "/mobile/profile",
    color: "text-pink-600",
    bgColor: "bg-pink-100",
  },
  {
    title: "Settings",
    icon: Settings,
    href: "/mobile/settings",
    color: "text-gray-600",
    bgColor: "bg-gray-100",
  },
];

export default function MorePage() {
  const { data: vanData } = useUserVanWarehouse();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pb-24">
      <MobileHeader
        title="More"
        subtitle="Features & Settings"
        vanName={vanData?.vanWarehouse?.name}
        driverName={vanData?.fullName}
      />

      <div className="p-6">
        {/* Grid of Features */}
        <div className="grid grid-cols-3 gap-4">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Link key={feature.href} href={feature.href}>
                <Card className="aspect-square p-4 hover:shadow-lg transition-all active:scale-95 cursor-pointer border-0 shadow-md">
                  <div className="flex flex-col items-center justify-center text-center h-full space-y-3">
                    <div className={`${feature.bgColor} p-4 rounded-2xl`}>
                      <Icon className={`h-8 w-8 ${feature.color}`} />
                    </div>
                    <div className="font-semibold text-sm text-gray-900">
                      {feature.title}
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div> 
      </div>
    </div>
  );
}
