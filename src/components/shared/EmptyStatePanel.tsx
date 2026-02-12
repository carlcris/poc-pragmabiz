import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type EmptyStatePanelProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  className?: string;
};

export function EmptyStatePanel({ icon: Icon, title, description, className }: EmptyStatePanelProps) {
  return (
    <div
      className={cn(
        "flex min-h-[240px] flex-col items-center justify-center px-6 py-10 text-center",
        className
      )}
    >
      <Icon className="mb-3 h-10 w-10 text-muted-foreground/55" />
      <p className="max-w-[32rem] text-lg font-medium leading-tight text-muted-foreground sm:text-xl">
        {title}
      </p>
      {description ? (
        <p className="mt-2 max-w-[36rem] text-sm leading-relaxed text-muted-foreground/90">
          {description}
        </p>
      ) : null}
    </div>
  );
}
