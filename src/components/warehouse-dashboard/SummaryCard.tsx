import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
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
    <Link href={href} className="block transition-transform hover:scale-105">
      <Card className="cursor-pointer hover:shadow-lg">
        <CardContent className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
          <div className="space-y-1">
            <p className="text-4xl font-bold">{count}</p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};
