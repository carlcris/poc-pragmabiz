import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon, ArrowUpRight } from "lucide-react";
import Link from "next/link";

type SummaryCardProps = {
  title: string;
  count: number;
  subtitle: string;
  icon: LucideIcon;
  iconColor: string;
  href: string;
};

export const SummaryCard = ({
  title,
  count,
  subtitle,
  icon: Icon,
  iconColor,
  href,
}: SummaryCardProps) => {
  return (
    <Link href={href} className="group block">
      <Card className="relative overflow-hidden border border-gray-200 bg-white transition-all duration-200 hover:border-purple-300 hover:shadow-lg">
        <CardContent className="p-6">
          {/* Icon Badge */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 shadow-sm">
              <Icon className={`h-6 w-6 ${iconColor}`} />
            </div>
            <ArrowUpRight className="h-5 w-5 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100" />
          </div>

          {/* Title */}
          <h3 className="mb-1 text-sm font-medium text-gray-600">{title}</h3>

          {/* Count */}
          <div className="mb-2 flex items-baseline gap-2">
            <p className="text-3xl font-bold text-gray-900">{count}</p>
          </div>

          {/* Subtitle */}
          <p className="text-xs text-gray-500">{subtitle}</p>

          {/* Bottom accent line */}
          <div className="absolute bottom-0 left-0 h-1 w-0 bg-gradient-to-r from-purple-500 to-purple-600 transition-all duration-300 group-hover:w-full" />
        </CardContent>
      </Card>
    </Link>
  );
};
