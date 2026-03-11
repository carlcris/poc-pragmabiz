import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  actionsClassName?: string;
};

export const PageHeader = ({
  title,
  subtitle,
  actions,
  className,
  titleClassName,
  subtitleClassName,
  actionsClassName,
}: PageHeaderProps) => (
  <div
    className={cn(
      "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
      className
    )}
  >
    <div className="min-w-0">
      <h1 className={cn("text-lg font-semibold tracking-tight sm:text-xl", titleClassName)}>{title}</h1>
      {subtitle ? (
        <p className={cn("text-xs text-muted-foreground sm:text-sm", subtitleClassName)}>{subtitle}</p>
      ) : null}
    </div>
    {actions ? (
      <div className={cn("flex flex-col gap-2 sm:flex-row sm:gap-2", actionsClassName)}>
        {actions}
      </div>
    ) : null}
  </div>
);
