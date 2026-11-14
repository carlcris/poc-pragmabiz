import { cn } from "@/lib/utils";

type OverviewCardProps = {
  titleId: string;
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
};

export const OverviewCard = ({
  titleId,
  title,
  subtitle,
  action,
  className,
  bodyClassName,
  children,
}: OverviewCardProps) => (
  <article
    aria-labelledby={titleId}
    className={cn("flex min-w-0 flex-col rounded-lg border bg-card shadow-sm", className)}
  >
    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 px-4 pb-2 pt-4 sm:px-5">
      <div className="min-w-0 space-y-0.5">
        <h3 id={titleId} className="text-sm font-semibold sm:text-base">
          {title}
        </h3>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {action}
    </div>
    <div className={cn("flex flex-1 flex-col px-4 pb-4 sm:px-5", bodyClassName)}>{children}</div>
  </article>
);
