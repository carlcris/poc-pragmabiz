import { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface KPICardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  iconColor?: string;
  trend?: {
    value: number;
    label: string;
    isPositive?: boolean;
  };
  isLoading?: boolean;
}

export function KPICard({
  title,
  value,
  description,
  icon: Icon,
  iconColor = "text-primary",
  trend,
  isLoading = false,
}: KPICardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={cn("h-4 w-4", iconColor)} />
      </CardHeader>
      <CardContent className="flex min-h-[72px] flex-col justify-between gap-2">
        <div className="text-2xl font-bold">
          {isLoading ? <Skeleton className="h-8 w-32" /> : value}
        </div>
        {description ? (
          <div className="min-h-[16px]">
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        ) : null}
        {trend && (
          <div className="mt-2 flex items-center gap-1">
            <span
              className={cn(
                "text-xs font-medium",
                trend.isPositive !== false ? "text-green-600" : "text-red-600"
              )}
            >
              {isLoading ? <Skeleton className="h-4 w-12" /> : `${trend.value > 0 ? "+" : ""}${trend.value}%`}
            </span>
            <span className="text-xs text-muted-foreground">{trend.label}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
