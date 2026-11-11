import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type MetricCardProps = {
  title: string;
  icon: LucideIcon;
  value?: string;
  caption?: ReactNode;
  isLoading?: boolean;
  skeletonCaption?: boolean;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  iconClassName?: string;
  valueClassName?: string;
};

export const MetricCard = ({
  title,
  icon: Icon,
  value,
  caption,
  isLoading = false,
  skeletonCaption = false,
  className,
  headerClassName,
  contentClassName,
  iconClassName = "h-4 w-4 text-muted-foreground",
  valueClassName = "text-2xl font-bold",
}: MetricCardProps) => (
  <Card className={className}>
    <CardHeader
      className={cn("flex flex-row items-center justify-between space-y-0 pb-2", headerClassName)}
    >
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className={iconClassName} />
    </CardHeader>
    <CardContent
      className={cn("flex min-h-[72px] flex-col justify-between gap-2", contentClassName)}
    >
      <div className={valueClassName}>
        {isLoading ? <Skeleton className="h-8 w-24" /> : (value ?? "-")}
      </div>
      {caption || skeletonCaption ? (
        <div className="min-h-[16px]">
          {isLoading && skeletonCaption ? (
            <Skeleton className="h-4 w-20" />
          ) : (
            <p className="text-xs text-muted-foreground">{caption ?? ""}</p>
          )}
        </div>
      ) : null}
    </CardContent>
  </Card>
);
