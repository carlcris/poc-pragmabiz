import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type MetricCardProps = {
  title: string;
  icon: LucideIcon;
  value?: string;
  caption?: string;
  isLoading?: boolean;
  skeletonCaption?: boolean;
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
  iconClassName = "h-4 w-4 text-muted-foreground",
  valueClassName = "text-2xl font-bold",
}: MetricCardProps) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className={iconClassName} />
    </CardHeader>
    <CardContent className="flex min-h-[72px] flex-col justify-between gap-2">
      <div className={valueClassName}>
        {isLoading ? <Skeleton className="h-8 w-24" /> : value ?? "-"}
      </div>
      {caption ? (
        <div className="min-h-[16px]">
          {isLoading && skeletonCaption ? (
            <Skeleton className="h-4 w-20" />
          ) : (
            <p className="text-xs text-muted-foreground">{caption}</p>
          )}
        </div>
      ) : null}
    </CardContent>
  </Card>
);
